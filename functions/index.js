"use strict";
// Firebase Functions v2: server-owned session leases and cloud checkpoints.
// No client-supplied value is trusted as a verified leaderboard score.
const admin=require("firebase-admin");
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const core=require("./session-core");
admin.initializeApp();
const db=admin.firestore();
const {FieldValue}=admin.firestore;
const REGION="us-central1";
const callable={region:REGION,maxInstances:20,timeoutSeconds:30};
function fail(error){
  if(error instanceof HttpsError)throw error;
  const codes=["unauthenticated","invalid-argument","failed-precondition","aborted","resource-exhausted"];
  const name=codes.includes(error?.code)?error.code:"internal";
  if(name==="internal")console.error("Session backend error",error);
  throw new HttpsError(name,name==="internal"?"Session service unavailable. Please retry.":error.message);
}
function validateIdentity(request) {
  const uid=core.checkAccount(request);
  const hash=core.hashToken(request.data?.token);
  return {uid,hash};
}
function sessionDoc(uid){return db.collection("player_sessions").doc(uid)}
function saveDoc(uid){return db.collection("player_saves").doc(uid)}
function runCallable(task){return onCall(callable,async request=>{
  try{return await task(request)}catch(error){return fail(error)}
})}
exports.claimPlayerSession=runCallable(async request=>{
  const {uid,hash}=validateIdentity(request);
  const takeover=request.data?.takeover===true;
  const label=core.checkLabel(request.data?.label);
  return db.runTransaction(async tx=>{
    const ref=sessionDoc(uid),snap=await tx.get(ref);
    const old=snap.exists?snap.data():null,now=Date.now();
    const decision=core.claimDecision(old,hash,now,takeover);
    if(decision.status==="occupied")
      return {status:"occupied",expiresInMs:decision.expiresInMs,
        deviceLabel:core.checkLabel(old?.deviceLabel)};
    if(decision.renew&&old.leaseUntilMs-now>core.SESSION_LEASE_MS-30000)
      return {status:"active",epoch:decision.epoch,leaseMs:old.leaseUntilMs-now};
    tx.set(ref,{
      ownerUid:uid,tokenHash:hash,epoch:decision.epoch,
      deviceLabel:label,leaseUntilMs:now+core.SESSION_LEASE_MS,
      // Preserve per-UID checkpoint throttling even after an explicit takeover.
      lastCheckpointAtMs:Number.isFinite(old?.lastCheckpointAtMs)?old.lastCheckpointAtMs:0,
      updatedAt:FieldValue.serverTimestamp()
    });
    return {status:"active",epoch:decision.epoch,leaseMs:core.SESSION_LEASE_MS};
  });
});
exports.pingPlayerSession=runCallable(async request=>{
  const {uid,hash}=validateIdentity(request);
  return db.runTransaction(async tx=>{
    const ref=sessionDoc(uid),snap=await tx.get(ref),now=Date.now();
    const record=snap.exists?snap.data():null;
    if(!core.ownsSession(record,hash,now))
      return {status:"lost",reason:core.isLive(record,now)?"other_device":"expired"};
    if(record.leaseUntilMs-now>core.SESSION_LEASE_MS-30000)
      return {status:"active",epoch:record.epoch,leaseMs:record.leaseUntilMs-now};
    tx.update(ref,{leaseUntilMs:now+core.SESSION_LEASE_MS,
      updatedAt:FieldValue.serverTimestamp()});
    return {status:"active",epoch:record.epoch,leaseMs:core.SESSION_LEASE_MS};
  });
});
exports.releasePlayerSession=runCallable(async request=>{
  const {uid,hash}=validateIdentity(request);
  return db.runTransaction(async tx=>{
    const ref=sessionDoc(uid),snap=await tx.get(ref);
    if(!snap.exists||!core.safeEqual(snap.data().tokenHash,hash))
      return {status:"lost"};
    tx.update(ref,{leaseUntilMs:0,updatedAt:FieldValue.serverTimestamp()});
    return {status:"released"};
  });
});
exports.checkpointPlayerSession=runCallable(async request=>{
  const {uid,hash}=validateIdentity(request);
  const save=request.data?.save;
  const expected=request.data?.expectedRevision;
  if(!core.validateSave(save)||!core.validateRevision(expected))
    throw Object.assign(new Error("Invalid save or expected revision."),{code:"invalid-argument"});
  return db.runTransaction(async tx=>{
    const sessionRef=sessionDoc(uid),saveRef=saveDoc(uid);
    const [sessionSnap,saveSnap]=await Promise.all([tx.get(sessionRef),tx.get(saveRef)]);
    const now=Date.now(),session=sessionSnap.exists?sessionSnap.data():null;
    if(!core.ownsSession(session,hash,now))
      throw Object.assign(new Error("Another device owns this session. Checkpoint rejected."),
        {code:"failed-precondition"});
    const before=saveSnap.exists?saveSnap.data():null;
    const revision=before?Number(before.revision):0;
    if(!core.validateRevision(revision)||revision!==expected)
      throw Object.assign(new Error("Cloud revision changed. Review the latest save before uploading."),
        {code:"aborted"});
    if(Number.isFinite(session.lastCheckpointAtMs)&&
        now-session.lastCheckpointAtMs<15000)
      throw Object.assign(new Error("Checkpoint rate limit: retry shortly."),
        {code:"resource-exhausted"});
    const prevSave=before?.save;
    const signal=prevSave&&core.scoreSignal(prevSave,save,
      before?.updatedAt?.toMillis?now-before.updatedAt.toMillis():0);
    tx.set(saveRef,{
      ownerUid:uid,schemaVersion:1,seasonId:"dynasty-ii",
      revision:revision+1,updatedAt:FieldValue.serverTimestamp(),save
    });
    tx.update(sessionRef,{leaseUntilMs:now+core.SESSION_LEASE_MS,
      lastCheckpointAtMs:now,updatedAt:FieldValue.serverTimestamp()});
    if(signal){
      const reviewRef=db.collection("session_review").doc();
      tx.create(reviewRef,{ownerUid:uid,signal,fromStage:Number(prevSave?.maxLevel)||0,
        toStage:Number(save.maxLevel),createdAt:FieldValue.serverTimestamp()});
    }
    return {status:"saved",revision:revision+1,
      reviewPending:Boolean(signal),scoreVerified:false};
  });
});
