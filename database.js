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

    lastSubmittedScore = maxLevel; // Update last submitted score
}



function showLeaderboard() {
    const scrollDiv = document.getElementById("leaderboard-scroll");
    scrollDiv.innerHTML = "<p>Loading leaderboard...</p>";

    if (leaderboardUnsub) leaderboardUnsub();

    leaderboardUnsub = db.collection("scores")
        .orderBy("score", "desc")
        .limit(50)
        .onSnapshot(snapshot => {
            const entries = [];
            let i = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.name || "Unnamed Hero";
                const score = typeof data.score === "number" ? data.score : 0;
                const isPlayer = name === playerName;

                const displayName = isPlayer ? `🛡️ ${name}` : name;
                const playerClass = isPlayer ? 'highlight-player' : '';
                entries.push(`<p class="${playerClass}">${++i}. ${displayName} — Level ${score}</p>`);
            });
            scrollDiv.innerHTML = entries.join("") || "<p>No entries yet.</p>";
        }, error => {
            console.error("Error fetching leaderboard:", error);
            scrollDiv.innerHTML = "<p>Error loading leaderboard.</p>";
        });

    document.getElementById("leaderboard-popup").style.display = "flex";
}



function closeLeaderboard() {
    document.getElementById("leaderboard-popup").style.display = "none";
    leaderboardUnsub = null; // Unsubscribe from the snapshot listener
}

function sendMessage() {
    if (!nameConfirm) {
        messageStatusSpan.textContent = "❌ Please confirm your name first in leaderboard.";
        messageStatusSpan.style.color = "red";
        return;
    }
    const msg = messageBody.value.trim(); // or your desired metric

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
                const entries = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.timestamp) return;

                    const name = data.name || "Unnamed Hero";
                    const msg = typeof data.msg === "string" ? data.msg : "No message";
                    const time = data.timestamp.toDate().toLocaleTimeString();
                    entries.push(`<p><strong>${name}</strong> @ ${time}: ${msg}</p>`);
                });
                scrollDiv.innerHTML = entries.join("") || "<p>No entries yet.</p>";
            }, error => {
                console.error("Error loading messages:", error);
                scrollDiv.innerHTML = "<p>Error loading message board.</p>";
            });
    }
    document.getElementById("message-popup").style.display = "flex";
}


function closeMessage() {
    document.getElementById("message-popup").style.display = "none";
    messageUnsub = null; // Unsubscribe from the snapshot listener
}

function disableNameInput() {
    console.log("Name confirmed:", playerName);
    nameInput.disabled = true;
    nameConfirmButton.disabled = true;
    statusSpan.textContent = "✔️ Name confirmed!";
    statusSpan.style.color = "#0f0";
}

function confirmName() {
    localStorage.setItem("playerName", playerName);
    localStorage.setItem("nameConfirm", true);
    const name = nameInput.value.trim();
    if (name.length === 0) {
        statusSpan.textContent = "❌ Please enter a valid name.";
        statusSpan.style.color = "red";
        return;
    }

    db.collection("scores").doc(name).get().then(doc => {
        if (doc.exists) {
            statusSpan.textContent = "❌ Name is already taken.";
            statusSpan.style.color = "red";
            return;
        } else {
            nameConfirm = true;
            playerName = name;
            submitScore();
            // Save to localStorage
            disableNameInput();
        }
    });
}