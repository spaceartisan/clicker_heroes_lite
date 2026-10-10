"use strict";
// Pure, unit-testable session primitives. Backend owns all lease decisions.
const crypto = require("node:crypto");
const SESSION_LEASE_MS = 120000;
const MAX_SAVE_BYTES = 600000;
const MAX_STAGE = 1e12;

function hashToken(token) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    throw Object.assign(new Error("Invalid session token."),{code:"invalid-argument"});
  }
  return crypto.createHash("sha256").update(token,"utf8").digest("hex");
}
function safeEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string"||
     !/^[0-9a-f]{64}$/.test(a)||!/^[0-9a-f]{64}$/.test(b))return false;
  return crypto.timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
function checkAccount(request) {
  const uid=request?.auth?.uid;
  const provider=request?.auth?.token?.firebase?.sign_in_provider;
  if(typeof uid!=="string"||!uid||provider==="anonymous") {
    throw Object.assign(new Error("Registered Firebase account required."),{code:"unauthenticated"});
  }
  return uid;
}
function checkLabel(value) {
  return typeof value==="string"&&value.length>=1&&value.length<=48 &&
    /^[\p{L}\p{N} ._()-]+$/u.test(value)?value:"Device";
}
function isLive(record,now){
  return Boolean(record&&Number.isFinite(record.leaseUntilMs)&&record.leaseUntilMs>now);
}
function ownsSession(record,hash,now){
  return isLive(record,now)&&safeEqual(record.tokenHash,hash);
}
function claimDecision(existing,tokenHash,now,takeover){
  if(ownsSession(existing,tokenHash,now)){
    return {status:"active",epoch:existing.epoch,renew:true};
  }
  if(isLive(existing,now)&&!takeover){
    return {status:"occupied",expiresInMs:Math.max(0,existing.leaseUntilMs-now)};
  }
  return {status:"active",epoch:Math.max(0,Number(existing?.epoch)||0)+1,renew:false};
}
function validateSave(save){
  if(!save||typeof save!=="object"||Array.isArray(save))return false;
  if(save.schemaVersion!==2||save.seasonId!=="dynasty-ii")return false;
  const stage=Number(save.maxLevel),hero=Number(save.playerLevel),gold=Number(save.gold);
  if(!Number.isFinite(stage)||stage<1||stage>MAX_STAGE||
     !Number.isFinite(hero)||hero<1||hero>MAX_STAGE||
     !Number.isFinite(gold)||gold<0||gold>1e300)return false;
  const current=Number(save.currentLevel),peak=Number(save.bestSeasonStage||save.maxLevel);
  if(!Number.isFinite(current)||current<1||current>stage||
     !Number.isFinite(peak)||peak<stage||peak>MAX_STAGE)return false;
  try {
    return Buffer.byteLength(JSON.stringify(save),"utf8")<=MAX_SAVE_BYTES;
  }catch(_){return false}
}
function validateRevision(revision){
  return Number.isSafeInteger(revision)&&revision>=0&&revision<Number.MAX_SAFE_INTEGER;
}
function scoreSignal(prior,next,elapsedMs){
  // Triage only. This is NOT authoritative validation: client-reported
  // combat and stats can be edited. Never auto-ban or auto-verify scores.
  const oldStage=Math.max(0,Number(prior?.bestSeasonStage||prior?.maxLevel)||0);
  const newStage=Math.max(0,Number(next.bestSeasonStage||next.maxLevel)||0);
  const increase=Math.max(0,newStage-oldStage);
  const elapsed=Math.max(0,elapsedMs||0);
  if(increase>1000000&&elapsed<60000)return "large_stage_jump";
  return null;
}
module.exports={SESSION_LEASE_MS,MAX_SAVE_BYTES,MAX_STAGE,hashToken,safeEqual,
  checkAccount,checkLabel,isLive,ownsSession,claimDecision,validateSave,validateRevision,scoreSignal};
