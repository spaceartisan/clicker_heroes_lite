// v1.10.0 — explicitly published UID-owned Season II account rankings.
// Separate from historical name-based rankings; client-reported, NOT anti-cheat verified.
const ACCOUNT_RANKING_MAX_STAGE=1000000000000;
let accountRankingBusy=false;
let accountRankingLoadedUid=null;
let accountRankingLookupSerial=0;
function accountRankingUser(){
    if(typeof firebase.auth!=="function")return null;
    const user=firebase.auth().currentUser;
    return user&&!user.isAnonymous?user:null;
}
function accountRankingStatus(message,isError=false){
    const node=document.getElementById("account-ranking-status");
    if(node){
        node.textContent=message;
        node.classList.toggle("account-error",isError);
    }
}
function accountRankingNameValid(name){
    return typeof name==="string" &&
        /^[A-Za-z0-9 _.-]{1,20}$/.test(name) &&
        name.trim().length>=1 && name.trim()===name;
}
function accountRankingCurrentScore(){
    const peak=Math.floor(Number(currentDynastyPeak())||1);
    return Math.min(ACCOUNT_RANKING_MAX_STAGE,Math.max(1,peak));
}
function accountRankingRecordValid(value,uid){
    return Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&
        value.ownerUid===uid&&value.schemaVersion===1&&
        value.seasonId===GAME_SEASON_ID &&
        Number.isSafeInteger(value.score)&&value.score>=1&&
        value.score<=ACCOUNT_RANKING_MAX_STAGE &&
        accountRankingNameValid(value.name));
}
function accountRankingShowControls(){
    const user=accountRankingUser();
    const publish=document.getElementById("account-ranking-publish");
    const name=document.getElementById("account-ranking-name");
    if(publish)publish.disabled=!user||accountRankingBusy;
    if(name)name.disabled=!user||accountRankingBusy;
    if(!user){
        accountRankingStatus("Sign in with Email/Password or Google in Game Config to publish an account-owned ranking.");
        return;
    }
    if(accountRankingLoadedUid===user.uid)return;
    accountRankingLoadedUid=user.uid;
    if(name)name.value="";
    accountRankingStatus("Checking your account ranking...");
    const request=++accountRankingLookupSerial;
    db.collection(GAME_ACCOUNT_SCORE_COLLECTION).doc(user.uid).get({source:"server"})
        .then(snapshot=>{
            if(request!==accountRankingLookupSerial||accountRankingUser()?.uid!==user.uid)return;
            if(snapshot.exists){
                const record=snapshot.data();
                if(!accountRankingRecordValid(record,user.uid)){
                    accountRankingStatus("Existing ranking has an invalid format. It was not changed.",true);
                    return;
                }
                if(name&&!name.value)name.value=record.name;
                accountRankingStatus("Your account ranking: stage "+record.score.toLocaleString()+
                    ". Publishing can change your name and increase your score, never lower it.");
            }else{
                if(name&&!name.value&&typeof playerName==="string" &&
                    accountRankingNameValid(playerName))name.value=playerName;
                accountRankingStatus("No account ranking yet. Choose a public name and explicitly publish your current Season II stage.");
            }
        }).catch(error=>{
            if(request!==accountRankingLookupSerial||accountRankingUser()?.uid!==user.uid)return;
            accountRankingStatus(error&&error.code==="permission-denied"?
                "Account ranking rules are not published yet. Existing scores and local progress are safe.":
                "Could not check the account ranking. You may retry publishing when Firebase is reachable.",true);
        });
}
function accountRankingAuthChanged(){
    ++accountRankingLookupSerial;
    accountRankingLoadedUid=null;
    if(leaderboardSelectedSeason==="accounts"&&
        document.getElementById("leaderboard-popup")?.style.display==="flex"){
        switchLeaderboardSeason("accounts");
    }else if(typeof accountRankingShowControls==="function"){
        // Keep a closed panel clean without starting a cloud read.
        const user=accountRankingUser();
        const publish=document.getElementById("account-ranking-publish");
        if(publish)publish.disabled=!user||accountRankingBusy;
    }
}
async function publishAccountRanking(){
    if(accountRankingBusy)return false;
    const user=accountRankingUser();
    if(!user){
        accountRankingStatus("Sign into a player account first. Guest progress remains local.",true);
        return false;
    }
    const input=document.getElementById("account-ranking-name");
    const label=input?input.value.trim():"";
    if(!accountRankingNameValid(label)){
        accountRankingStatus("Use 1–20 English letters, numbers, spaces, _, . or - for the public display name.",true);
        return false;
    }
    const score=accountRankingCurrentScore();
    accountRankingBusy=true;
    accountRankingShowControls();
    accountRankingStatus("Publishing account stage "+score.toLocaleString()+"...");
    try{
        const ref=db.collection(GAME_ACCOUNT_SCORE_COLLECTION).doc(user.uid);
        const result=await db.runTransaction(async transaction=>{
            const snapshot=await transaction.get(ref);
            if(accountRankingUser()?.uid!==user.uid)
                throw new Error("Account changed while publishing. Nothing was submitted.");
            const prior=snapshot.exists?snapshot.data():null;
            if(prior&&!accountRankingRecordValid(prior,user.uid))
                throw new Error("Existing account ranking is malformed. Refusing to overwrite it.");
            const highest=prior?Math.max(score,prior.score):score;
            transaction.set(ref,{
                ownerUid:user.uid,
                schemaVersion:1,
                seasonId:GAME_SEASON_ID,
                name:label,
                score:highest,
                timestamp:firebase.firestore.FieldValue.serverTimestamp()
            });
            return highest;
        });
        if(accountRankingUser()?.uid!==user.uid)
            throw new Error("Account changed after submission; refresh your ranking.");
        accountRankingLoadedUid=user.uid;
        accountRankingStatus("Published to your account: stage "+result.toLocaleString()+
            ". Linked to your Firebase UID; browser-reported score.");
        return true;
    }catch(error){
        accountRankingStatus(error&&error.code==="permission-denied"?
            "Firebase rejected the account score. Publish the owner-only ranking rules before trying again.":
            (error&&error.message?String(error.message).slice(0,180):
                "Could not publish. No existing leaderboard entry was removed."),true);
        return false;
    }finally{
        accountRankingBusy=false;
        accountRankingShowControls();
    }
}
document.addEventListener("DOMContentLoaded",()=>{
    const button=document.getElementById("account-ranking-publish");
    if(button)button.disabled=!accountRankingUser();
});
