import {localDay} from './lib.js';
const key = 'axiom.progress.v1';
export function readProgress(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage.getItem(key));
    if (!value || value.version !== 1 || !Array.isArray(value.sessions)) return {version:1,sessions:[]};
    return {version:1,sessions:value.sessions.filter(s => s && typeof s === 'object' && typeof s.game === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.day) && Number.isFinite(s.seconds) && s.seconds >= 0).slice(-200).map(s=>({...s,hints:Number.isFinite(s.hints)&&s.hints>=0?Math.floor(s.hints):0}))};
  } catch {return {version:1,sessions:[]};}
}
export function recordSession(session, storage) {
  try {storage ??= globalThis.localStorage;} catch {return false;}
  const data = readProgress(storage);
  data.sessions.push({...session,day:localDay(),at:Date.now()});
  data.sessions = data.sessions.slice(-200);
  try {storage.setItem(key,JSON.stringify(data)); return true;} catch {return false;}
}
export function clearProgress(storage) {(storage ?? globalThis.localStorage).removeItem(key);}
export function getStats(sessions, now = new Date()) {
  const today = localDay(now);
  const days = new Set(sessions.map(s => s.day));
  const day = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  if (!days.has(today)) day.setDate(day.getDate()-1);
  let streak = 0;
  while(days.has(localDay(day))) {streak++; day.setDate(day.getDate()-1);}
  return {completed:sessions.length,minutes:Math.round(sessions.reduce((sum,s)=>sum+s.seconds,0)/60),streak,today:sessions.filter(s=>s.day===today).length};
}
