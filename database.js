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
        const base = m.level * (2 ** m.gearLevel);
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



function submitScore() {
    if (!nameConfirm || maxLevel <= lastSubmittedScore) {
        return;
    }
    const score = maxLevel; // or your desired metric

    db.collection("scores").doc(playerName).set({
        name: playerName,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        statusSpan.textContent = "✔️ Name and score saved!";
        statusSpan.style.color = "#0f0";
        localStorage.setItem("playerName", playerName);
        lastSubmittedScore = maxLevel;
        nameInput.disabled = true;
    }).catch((error) => {
        console.error("Error writing to leaderboard: ", error);
        statusSpan.textContent = "❌ Failed to save. Try again.";
        statusSpan.style.color = "red";
    });
    statusSpan.style.visibility = "visible";
    statusSpan.style.opacity = "1";

    setTimeout(() => {
        statusSpan.style.opacity = "0";
        statusSpan.style.visibility = "hidden";
    }, 1500);

    // Only mark the score submitted after Firestore confirms the write.
}



function showLeaderboard() {
    const scrollDiv = document.getElementById("leaderboard-scroll");
    scrollDiv.innerHTML = "<p>Loading leaderboard...</p>";

    if (leaderboardUnsub) leaderboardUnsub();

    leaderboardUnsub = db.collection("scores")
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
            scrollDiv.innerHTML = "<p>Error loading leaderboard.</p>";
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
    const name = nameInput.value.trim();
    if (!/^[\\p{L}\\p{N} _.-]{1,20}$/u.test(name)) {
        statusSpan.textContent = "❌ Use 1–20 letters, numbers, spaces, _, . or -.";
        statusSpan.style.color = "red";
        statusSpan.style.visibility = "visible";
        statusSpan.style.opacity = "1";
        return;
    }

    db.collection("scores").doc(name).get().then(doc => {
        if (doc.exists) {
            statusSpan.textContent = "❌ Name is already taken.";
            statusSpan.style.color = "red";
            statusSpan.style.visibility = "visible";
            statusSpan.style.opacity = "1";
            return;
        } else {
            nameConfirm = true;
            playerName = name;
            localStorage.setItem("playerName", name);
            localStorage.setItem("nameConfirm", "true");
            // Submit the first level too, so the name is actually reserved.
            lastSubmittedScore = -1;
            submitScore();
            // Save to localStorage
            disableNameInput();
        }
    });
}