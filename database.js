firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function showAutosaveIndicator() {
    const indicator = document.getElementById("autosave-indicator");
    indicator.style.visibility = "visible";
    indicator.style.opacity = "1";

    setTimeout(() => {
        indicator.style.opacity = "0";
        indicator.style.visibility = "hidden";
    }, 1500);
}


function getTotalAutoDamage() {
    return hiredMercenaries.reduce((sum, m) => {
        const base = m.level * safePowerOfTwo(m.gearLevel);
        const speed = m.attackSpeedLevel || 1;
        return sum + (base * speed / 2); // assuming 2s base interval
    }, 0);
}





function deleteSave() {
    if (confirm("Are you sure you want to delete your save?")) {
        localStorage.removeItem("clickerHeroSave");
        alert("Save deleted.");
        location.reload();
    }
}



// Score writes are coalesced and rate-limited. Mobile autosaves must not cause
// repeated Firestore writes, and an in-flight older score must never mark a
// newer, unsent stage as synchronized.
const SCORE_UPLOAD_INTERVAL_MS = 120000;
const SCORE_FAILURE_RETRY_MS = 300000;
const SCORE_MANUAL_RETRY_MS = 10000;
let lastScoreUploadAttempt = -Infinity;
let scoreUploadPending = false;
let scoreUploadRetryAt = 0;
let nameRegistrationPending = false;

function updateScoreSyncStatus(message, isError = false) {
    const status = document.getElementById("leaderboard-sync-status");
    if (status) {
        status.textContent = message;
        status.classList.toggle("sync-error", isError);
    }
}

function submitScore(manual = false) {
    if (!nameConfirm) {
        if (manual) updateScoreSyncStatus("Choose and confirm a name first.");
        return false;
    }
    const score = Math.max(1, Math.floor(currentDynastyPeak()));
    if (score <= lastSubmittedScore) {
        if (manual) updateScoreSyncStatus("Your Season II score is up to date.");
        return false;
    }
    if (scoreUploadPending) {
        if (manual) updateScoreSyncStatus("Score upload already in progress.");
        return false;
    }
    const now = Date.now();
    const interval = manual ? SCORE_MANUAL_RETRY_MS : SCORE_UPLOAD_INTERVAL_MS;
    if (now - lastScoreUploadAttempt < interval ||
        (!manual && now < scoreUploadRetryAt)) {
        if (manual) updateScoreSyncStatus("Please wait a few seconds before retrying.");
        return false;
    }
    scoreUploadPending = true;
    lastScoreUploadAttempt = now;
    updateScoreSyncStatus("Synchronizing Season II stage " + score + "...");
    let writePromise;
    try {
        writePromise = db.collection(GAME_SCORE_COLLECTION).doc(playerName).set({
            name: playerName,
            score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        scoreUploadPending = false;
        scoreUploadRetryAt = now + SCORE_FAILURE_RETRY_MS;
        updateScoreSyncStatus("Could not reach the leaderboard. Try again later.", true);
        console.error("Leaderboard upload could not start:", error);
        return false;
    }
    Promise.resolve(writePromise).then(() => {
        scoreUploadPending = false;
        scoreUploadRetryAt = 0;
        lastSubmittedScore = Math.max(lastSubmittedScore, score);
        // Update only the confirmed score field: this does not trigger an
        // additional save/score write or overwrite live gameplay state.
        try {
            const saved = inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
            if (isCurrentSeasonSave(saved) && saved.playerName === playerName) {
                saved.lastSubmittedScore = Math.max(saved.lastSubmittedScore || 0, lastSubmittedScore);
                localStorage.setItem("clickerHeroSave", JSON.stringify(saved));
            }
        } catch (error) {
            console.warn("Leaderboard synced but score could not be cached locally:", error);
        }
        statusSpan.textContent = "✔️ Score synchronized!";
        statusSpan.style.color = "#7fcf91";
        updateScoreSyncStatus("Synced through stage " + score + ".");
    }).catch(error => {
        scoreUploadPending = false;
        scoreUploadRetryAt = Date.now() + SCORE_FAILURE_RETRY_MS;
        statusSpan.textContent = "❌ Score not uploaded.";
        statusSpan.style.color = "#e6a99d";
        updateScoreSyncStatus(
            "Score saved locally. Online sync failed; retry below. " +
            (error && error.code === "permission-denied"
                ? "The game owner may need to update Firebase permissions."
                : "Check your connection."), true);
        console.warn("Season II leaderboard upload failed:", error);
    });
    return true;
}

function showLeaderboard() {
    const scrollDiv = document.getElementById("leaderboard-scroll");
    if (nameConfirm) {
        updateScoreSyncStatus(scoreUploadPending ? "Score upload in progress." :
            currentDynastyPeak() > lastSubmittedScore
                ? "You have unsynchronized progress. You can retry below."
                : "Score synchronized through stage " + lastSubmittedScore + ".");
    } else {
        updateScoreSyncStatus("Confirm a name to join the Season II rankings.");
    }
    scrollDiv.textContent = "Loading Season II leaderboard...";

    if (leaderboardUnsub) leaderboardUnsub();

    leaderboardUnsub = db.collection(GAME_SCORE_COLLECTION)
        .orderBy("score", "desc")
        .limit(50)
        .onSnapshot(snapshot => {
            const fragment = document.createDocumentFragment();
            let i = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = typeof data.name === "string" ? data.name : "Unnamed Hero";
                const score = Number.isFinite(data.score) ? data.score : 0;
                const isPlayer = name === playerName;
                const line = document.createElement("p");
                if (isPlayer) line.classList.add("highlight-player");
                line.textContent = `${++i}. ${isPlayer ? "🛡️ " : ""}${name} — Level ${score}`;
                fragment.appendChild(line);
            });
            scrollDiv.replaceChildren(fragment);
            if (i === 0) scrollDiv.textContent = "No entries yet.";
        }, error => {
            console.error("Error fetching leaderboard:", error);
            scrollDiv.textContent = "Season II leaderboard unavailable. Check your connection or Firebase rules.";
            updateScoreSyncStatus("Could not load online rankings. Your local save is safe.", true);
        });

    document.getElementById("leaderboard-popup").style.display = "flex";
}



function closeLeaderboard() {
    document.getElementById("leaderboard-popup").style.display = "none";
    if (typeof leaderboardUnsub === "function") leaderboardUnsub();
    leaderboardUnsub = null;
}

function sendMessage() {
    if (!nameConfirm) {
        messageStatusSpan.textContent = "❌ Please confirm your name first in leaderboard.";
        messageStatusSpan.style.color = "red";
        return;
    }
    const msg = messageBody.value.trim();
    if (!msg || msg.length > 99) {
        messageStatusSpan.textContent = "Enter a message of 1–99 characters.";
        messageStatusSpan.style.visibility = "visible";
        messageStatusSpan.style.opacity = "1";
        return;
    }

    db.collection("message").add({
        name: playerName,
        msg: msg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        messageStatusSpan.textContent = "✔️ Message Send!";
        messageStatusSpan.style.color = "#0f0";
    }).catch((error) => {
        console.error("Error writing message: ", error);
        messageStatusSpan.textContent = "❌ Failed to send. Try again.";
        messageStatusSpan.style.color = "red";
    });
    messageBody.value = ""; // Clear input after sending
    messageStatusSpan.style.visibility = "visible";
    messageStatusSpan.style.opacity = "1";

    setTimeout(() => {
        messageStatusSpan.style.opacity = "0";
        messageStatusSpan.style.visibility = "hidden";
    }, 1500);
}

function showMessage() {
    const scrollDiv = document.getElementById("message-scroll");
    scrollDiv.innerHTML = "<p>Loading message board...</p>";

    if (!messageUnsub) {
        messageUnsub = db.collection("message")
            .orderBy("timestamp", "desc")
            .limit(50)
            .onSnapshot(snapshot => {
                const fragment = document.createDocumentFragment();
                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.timestamp || typeof data.timestamp.toDate !== "function") return;
                    const name = typeof data.name === "string" ? data.name : "Unnamed Hero";
                    const msg = typeof data.msg === "string" ? data.msg : "No message";
                    const time = data.timestamp.toDate().toLocaleTimeString();
                    const line = document.createElement("p");
                    const author = document.createElement("strong");
                    author.textContent = name;
                    line.append(author, document.createTextNode(` @ ${time}: ${msg}`));
                    fragment.appendChild(line);
                    count++;
                });
                scrollDiv.replaceChildren(fragment);
                if (count === 0) scrollDiv.textContent = "No entries yet.";
            }, error => {
                console.error("Error loading messages:", error);
                scrollDiv.innerHTML = "<p>Error loading message board.</p>";
            });
    }
    document.getElementById("message-popup").style.display = "flex";
}


function closeMessage() {
    document.getElementById("message-popup").style.display = "none";
    if (typeof messageUnsub === "function") messageUnsub();
    messageUnsub = null;
}

function disableNameInput() {
    console.log("Name confirmed:", playerName);
    nameInput.disabled = true;
    nameConfirmButton.disabled = true;
    statusSpan.textContent = "✔️ Name confirmed!";
    statusSpan.style.color = "#0f0";
}

function confirmName() {
    if (nameRegistrationPending || nameConfirm) return;
    const requestedName = nameInput.value.trim();
    if (!/^[\p{L}\p{N} _.-]{1,20}$/u.test(requestedName)) {
        statusSpan.textContent = "❌ Use 1–20 letters, numbers, spaces, _, . or -.";
        statusSpan.style.color = "#e6a99d";
        statusSpan.style.visibility = "visible";
        statusSpan.style.opacity = "1";
        return;
    }

    nameRegistrationPending = true;
    nameConfirmButton.disabled = true;
    statusSpan.textContent = "Checking Season II name...";
    statusSpan.style.color = "#e7c98f";
    statusSpan.style.visibility = "visible";
    statusSpan.style.opacity = "1";
    const stageAtRegistration = Math.max(1, Math.floor(currentDynastyPeak()));
    let record;
    try {
        record = db.collection(GAME_SCORE_COLLECTION).doc(requestedName);
    } catch (error) {
        nameRegistrationPending = false;
        nameConfirmButton.disabled = false;
        updateScoreSyncStatus("Leaderboard unavailable. Try again later.", true);
        return;
    }

    record.get().then(doc => {
        if (doc.exists) {
            statusSpan.textContent = "❌ Name is already taken this season.";
            statusSpan.style.color = "#e6a99d";
            return null;
        }
        return record.set({
            name: requestedName,
            score: stageAtRegistration,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            playerName = requestedName;
            nameConfirm = true;
            lastSubmittedScore = stageAtRegistration;
            lastScoreUploadAttempt = Date.now();
            scoreUploadRetryAt = 0;
            localStorage.setItem("playerName", requestedName);
            localStorage.setItem("nameConfirm", "true");
            disableNameInput();
            saveGame();
            updateScoreSyncStatus("Season II name and stage registered.");
        });
    }).catch(error => {
        statusSpan.textContent = "❌ Couldn't register name. Try again.";
        statusSpan.style.color = "#e6a99d";
        updateScoreSyncStatus(error && error.code === "permission-denied"
            ? "Firebase denied Season II registration. The game owner must review its rules."
            : "Unable to register. Check your connection and retry.", true);
        console.warn("Season II registration failed:", error);
    }).finally(() => {
        nameRegistrationPending = false;
        if (!nameConfirm) nameConfirmButton.disabled = false;
    });
}
