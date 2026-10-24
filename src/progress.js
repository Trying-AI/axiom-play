import {localDay} from './lib.js';
const key = 'axiom.progress.v1';
let activeOwner = null;

function storageKey(owner) {
  if (owner === null) return key;
  if (typeof owner !== 'string' || !owner.length) throw new TypeError('A progress owner must be a nonempty account ID or null.');
  return `${key}.user.${encodeURIComponent(owner)}`;
}

// Account IDs choose a local storage namespace; they do not authenticate a user.
export function setProgressOwner(owner) {
  storageKey(owner);
  activeOwner = owner;
}
export function getProgressOwner() {return activeOwner;}

function readStoredProgress(storage, owner) {
  const value = JSON.parse(storage.getItem(storageKey(owner)));
  if (!value || value.version !== 1 || !Array.isArray(value.sessions)) return {version:1,sessions:[]};
  return {version:1,sessions:value.sessions.filter(s => s && typeof s === 'object' && typeof s.game === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.day) && Number.isFinite(s.seconds) && s.seconds >= 0).slice(-200).map(s=>({...s,hints:Number.isFinite(s.hints)&&s.hints>=0?Math.floor(s.hints):0}))};
}

export function readProgress(storage, owner = activeOwner) {
  try {
    storage ??= globalThis.localStorage;
    return readStoredProgress(storage, owner);
  } catch {return {version:1,sessions:[]};}
}
// Capture getProgressOwner() at game start and pass it here if auth can change mid-game.
export function recordSession(session, storage, owner = activeOwner) {
  try {storage ??= globalThis.localStorage;} catch {return false;}
  const data = readProgress(storage, owner);
  data.sessions.push({...session,day:localDay(),at:Date.now()});
  data.sessions = data.sessions.slice(-200);
  try {storage.setItem(storageKey(owner),JSON.stringify(data)); return true;} catch {return false;}
}
export function clearProgress(storage, owner = activeOwner) {(storage ?? globalThis.localStorage).removeItem(storageKey(owner));}
export function getGuestProgress(storage) {return readProgress(storage, null);}

function sessionIdentity(session) {
  return JSON.stringify(Object.keys(session).sort().map(name=>[name,session[name]]));
}

// Explicit opt-in copy only: signing in never imports or deletes guest history.
export function importGuestProgress(storage, owner = activeOwner) {
  if (owner === null) return {ok:false,imported:0};
  try {
    storage ??= globalThis.localStorage;
    const data = readStoredProgress(storage, owner);
    const guest = readStoredProgress(storage, null);
    const sessions = new Map(data.sessions.map(session=>[sessionIdentity(session),session]));
    const added = new Set();
    for (const session of guest.sessions) {
      const id = sessionIdentity(session);
      if (!sessions.has(id)) {sessions.set(id,session);added.add(id);}
    }
    const combined = [...sessions.entries()].sort(([,a],[,b])=>a.day.localeCompare(b.day)||(Number.isFinite(a.at)?a.at:0)-(Number.isFinite(b.at)?b.at:0)).slice(-200);
    const imported = combined.filter(([id])=>added.has(id)).length;
    if (imported) storage.setItem(storageKey(owner),JSON.stringify({version:1,sessions:combined.map(([,session])=>session)}));
    return {ok:true,imported};
  } catch {return {ok:false,imported:0};}
}
export function getStats(sessions, now = new Date()) {
  const today = localDay(now);
  const days = new Set(sessions.map(s => s.day));
  const day = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  if (!days.has(today)) day.setDate(day.getDate()-1);
  let streak = 0;
  while(days.has(localDay(day))) {streak++; day.setDate(day.getDate()-1);}
  return {completed:sessions.length,minutes:Math.round(sessions.reduce((sum,s)=>sum+s.seconds,0)/60),streak,today:sessions.filter(s=>s.day===today).length};
}
