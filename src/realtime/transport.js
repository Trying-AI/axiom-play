import { REALTIME_CONFIG, validateRealtimeConfig } from './config.js';
import { isRoomId, toMeta, resultProof } from './protocol.js';
import { getAdapter } from './adapters/index.js';

export class RevisionConflict extends Error {
  constructor() { super('This board changed in another tab. The latest saved board has been restored.'); this.name = 'RevisionConflict'; }
}
export async function createRealtimeTransport({ client, config = REALTIME_CONFIG }) {
  validateRealtimeConfig(config);
  await client.initialize();
  if (!client.getSnapshot().user) throw new Error('Sign in to Axiom before opening an online room.');
  const [apps, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js'),
  ]);
  const app = apps.getApp('axiom-auth');
  if (app.options.projectId !== config.projectId) throw new Error('The signed-in account uses a different Firebase project.');
  sdk.forceWebSockets();
  return createDatabaseTransport({ sdk, db: sdk.getDatabase(app, config.databaseURL), account: () => client.getSnapshot().user, namespace: config.namespace });
}
// Dependency injection is used by the isolated emulator fixture. Production always
// enters through the exact project and endpoint guard above; there is no fallback.
export function createDatabaseTransport({ sdk, db, account, namespace = 'multiplayerV1' }) {
  const { ref, onValue, get, set, update, remove, onDisconnect, serverTimestamp, runTransaction, query, orderByChild, limitToLast } = sdk;
  let connected = false, disposed = false, clockOffset = 0;
  const cleanup = new Set(), handles = new Set(), rematchRequests = new Map();
  const path = leaf => `${namespace}/${leaf}`;
  const at = leaf => ref(db, path(leaf));
  function uid() { const value = account()?.uid; if (!value || /[.#$\[\]/]/u.test(value)) throw new Error('Sign in to Axiom to continue.'); return value; }
  function roomId(value) { if (!isRoomId(value)) throw new Error('Paste a valid room invitation or room ID.'); return value; }
  function watch(target, next, fail) {
    const stop = onValue(target, snap => next(snap.val()), fail); cleanup.add(stop);
    return () => { stop(); cleanup.delete(stop); };
  }
  const isDenied = error => /permission[_ -]?denied/iu.test(String(error?.code || '') + ' ' + String(error?.message || ''));
  function requireConnection() { if (disposed || !connected) throw new Error('The database is disconnected. Wait for it to reconnect, then try again.'); }
  async function readControl(id) { return (await get(at(`rooms/${roomId(id)}/control`))).val(); }
  async function saveHistory(id, control) {
    const target = at(`history/${uid()}/${id}`);
    if ((await get(target)).exists()) return;
    const record = { game: control.game, difficulty: control.difficulty, createdAt: control.createdAt };
    try { await set(target, record); }
    catch (error) {
      // History is immutable. Another tab may have saved the same record after
      // our initial read, so verify the accepted record before treating it as a failure.
      let saved;
      try { saved = (await get(target)).val(); } catch { throw error; }
      if (!saved || Object.keys(record).some(key => saved[key] !== record[key])) throw error;
    }
  }
  async function claimProfile(id, cooldownMs = 0) {
    const previous = (await get(at(`profiles/${uid()}`))).val();
    if ((previous?.count || 0) >= 100) throw new Error('You have used this beta’s 100 room participations. Your saved rooms are still available.');
    const cooldown = (previous?.claimedAt || 0) + cooldownMs - (Date.now() + clockOffset);
    if (cooldownMs && cooldown > 0) throw new Error(`Please wait ${Math.ceil(cooldown / 1000)} seconds before requesting a rematch.`);
    if (previous?.activeMatchId && previous.activeMatchId !== id) {
      let active;
      try { active = await readControl(previous.activeMatchId); } catch (error) { if (!isDenied(error)) throw error; }
      const deadline = active ? Math.min(active.createdAt + 3600000, active.startedAt ? active.startedAt + 1803000 : Infinity) : 0;
      if (active?.status !== 'closed' && active && Date.now() + clockOffset < deadline && !(await get(at(`rooms/${previous.activeMatchId}/result`))).exists()) throw new Error('End your previous active room before starting or joining another. Open it from your saved rooms below.');
    }
    return { activeMatchId: id, count: (previous?.count || 0) + 1, claimedAt: serverTimestamp() };
  }
  async function choosePuzzle(game, difficulty, excludedId) {
    getAdapter(game);
    if (!['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('Choose a valid level.');
    const list = (await get(at(`catalogIndex/${game}/${difficulty}`))).val();
    const choices = Object.values(list || {}).filter(value => typeof value === 'string' && value !== excludedId);
    if (!choices.length) throw new Error('Puzzles for this level are not available yet. Try again later.');
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    return choices[random[0] % choices.length];
  }
  async function createMatch({ game, difficulty }) {
    const puzzleId = await choosePuzzle(game, difficulty);
    const id = crypto.randomUUID(), profile = await claimProfile(id);
    const control = { schemaVersion: 1, gameVersion: 1, game, difficulty, puzzleId, hostUid: uid(), guestUid: '', readyHost: false, readyGuest: false, status: 'waiting', createdAt: serverTimestamp(), startedAt: 0, closedAt: 0 };
    await update(ref(db), { [path(`rooms/${id}/control`)]: control, [path(`profiles/${uid()}`)]: profile, [path(`invites/${id}`)]: { game, difficulty, createdAt: serverTimestamp() } });
    const saved = await readControl(id); await saveHistory(id, saved);
    return { matchId: id, code: id };
  }
  async function requestRematch(id) {
    const pointerRef = at(`rooms/${id}/rematch`);
    const pointer = (await get(pointerRef)).val();
    if (pointer) return joinMatch({ code: pointer.roomId });
    try {
      const [previous, result] = await Promise.all([readControl(id), get(at(`rooms/${id}/result`)).then(snapshot => snapshot.val())]);
      if (!previous || ![previous.hostUid, previous.guestUid].includes(uid())) throw new Error('You are not a participant in this room.');
      if (!result) throw new Error('Finish this match before requesting a rematch.');
      if (Date.now() + clockOffset >= result.finishedAt + 60000) throw new Error('The rematch window has ended. Create a new room from multiplayer.');
      const puzzleId = await choosePuzzle(previous.game, previous.difficulty, previous.puzzleId);
      const nextId = crypto.randomUUID(), profile = await claimProfile(nextId, 10000);
      const control = { schemaVersion: 1, gameVersion: 1, game: previous.game, difficulty: previous.difficulty, puzzleId, previousRoomId: id, hostUid: uid(), guestUid: '', readyHost: false, readyGuest: false, status: 'waiting', createdAt: serverTimestamp(), startedAt: 0, closedAt: 0 };
      // The server accepts exactly one new room for this completed match. Its
      // empty guest seat is reserved by rules for the original opponent.
      await update(ref(db), {
        [path(`rooms/${nextId}/control`)]: control,
        [path(`profiles/${uid()}`)]: profile,
        [path(`invites/${nextId}`)]: { game: control.game, difficulty: control.difficulty, createdAt: serverTimestamp() },
        [path(`rooms/${id}/rematch`)]: { roomId: nextId, requestedBy: uid(), createdAt: serverTimestamp() },
      });
      await saveHistory(nextId, await readControl(nextId));
      return { matchId: nextId, code: nextId };
    } catch (error) {
      // Another tab or the opponent may have won the atomic creation race. Join
      // that one room rather than opening a second match or charging twice.
      let accepted;
      try { accepted = (await get(pointerRef)).val(); } catch { throw error; }
      if (accepted) return joinMatch({ code: accepted.roomId });
      throw error;
    }
  }
  function rematch({ matchId }) {
    const id = roomId(matchId);
    if (!rematchRequests.has(id)) {
      const pending = requestRematch(id).finally(() => { rematchRequests.delete(id); });
      rematchRequests.set(id, pending);
    }
    return rematchRequests.get(id);
  }
  async function joinMatch({ code }) {
    const id = roomId(code);
    // An existing participant may resume without consuming another beta claim.
    const [profileSnapshot, historySnapshot] = await Promise.all([get(at(`profiles/${uid()}`)), get(at(`history/${uid()}/${id}`))]);
    if (profileSnapshot.val()?.activeMatchId === id || historySnapshot.exists()) {
      const existing = await readControl(id);
      if (existing && [existing.hostUid, existing.guestUid].includes(uid())) { await saveHistory(id, existing); return { matchId: id, code: id }; }
    }
    const invite = (await get(at(`invites/${id}`))).val();
    if (!invite) throw new Error('That invitation was not found. Check the full room link.');
    if (Date.now() + clockOffset >= invite.createdAt + 3600000) throw new Error('That invitation has expired. Ask your friend for a new room.');
    const profile = await claimProfile(id);
    try { await update(ref(db), { [path(`rooms/${id}/control/guestUid`)]: uid(), [path(`profiles/${uid()}`)]: profile }); }
    catch (error) {
      // Two tabs of the reserved opponent can accept the same rematch at once.
      // A committed seat is resumable without a second participation claim.
      let accepted;
      try { accepted = await readControl(id); } catch { throw error; }
      if (!accepted || ![accepted.hostUid, accepted.guestUid].includes(uid())) throw error;
      await saveHistory(id, accepted); return { matchId: id, code: id };
    }
    const saved = await readControl(id); await saveHistory(id, saved);
    return { matchId: id, code: id };
  }
  async function startIfReady(id, expected) {
    if (expected?.status !== 'waiting' || !expected.readyHost || !expected.readyGuest || !expected.guestUid) return;
    await runTransaction(at(`rooms/${id}/control`), current => {
      const value = current || expected;
      if (value.status !== 'waiting' || !value.readyHost || !value.readyGuest || !value.guestUid) return;
      return { ...value, status: 'playing', startedAt: serverTimestamp() };
    }, { applyLocally: false });
  }
  async function setReady({ matchId, ready }) {
    const id = roomId(matchId), control = await readControl(id);
    if (!control || ![control.hostUid, control.guestUid].includes(uid())) throw new Error('You are not a participant in this room.');
    await set(at(`rooms/${id}/control/${control.hostUid === uid() ? 'readyHost' : 'readyGuest'}`), Boolean(ready));
    await startIfReady(id, await readControl(id));
  }
  async function revealPuzzle(id, control) {
    await set(at(`grants/${uid()}/${control.puzzleId}`), id);
    const puzzle = (await get(at(`catalog/${control.puzzleId}`))).val();
    if (!getAdapter(control.game).validPuzzle(puzzle)) throw new Error('This room has an unsupported puzzle.');
    return puzzle;
  }
  async function submitResult({ matchId, revision }) {
    const id = roomId(matchId), control = await readControl(id), own = (await get(at(`rooms/${id}/states/${uid()}`))).val();
    if (!own || own.revision !== revision) throw new RevisionConflict();
    const puzzle = await revealPuzzle(id, control);
    if (!getAdapter(control.game).complete(puzzle, own.board)) throw new Error('Complete your board before submitting.');
    const proposed = { winnerUid: uid(), finishedAt: serverTimestamp(), revision, proof: resultProof(control.game, puzzle, own.board) };
    try {
      const result = await runTransaction(at(`rooms/${id}/result`), current => current ? undefined : proposed, { applyLocally: false });
      return { result: result.snapshot.val() };
    } catch (error) {
      // The other valid board may have committed while this claim was in flight.
      const winner = (await get(at(`rooms/${id}/result`))).val();
      if (winner) return { result: winner };
      throw error;
    }
  }
  async function leaveMatch({ matchId }) {
    const id = roomId(matchId), expected = await readControl(id);
    await runTransaction(at(`rooms/${id}/control`), current => {
      const value = current || expected; if (!value || value.status === 'closed') return;
      return { ...value, status: 'closed', closedAt: serverTimestamp() };
    }, { applyLocally: false });
  }
  const operations = { createMatch, joinMatch, rematch, setReady, submitResult, leaveMatch };
  const connectionStop = watch(ref(db, '.info/connected'), online => { connected = online === true; });
  return {
    get connected() { return connected; },
    watchConnection(next) { return watch(ref(db, '.info/connected'), online => next(online === true)); },
    watchClock(next) { return watch(ref(db, '.info/serverTimeOffset'), value => { clockOffset = typeof value === 'number' ? value : 0; next(clockOffset); }); },
    async call(name, input) { uid(); requireConnection(); if (!Object.hasOwn(operations, name)) throw new Error('Unknown room action.'); return operations[name](input); },
    watchHistory(next, fail) {
      return watch(query(at(`history/${uid()}`), orderByChild('createdAt'), limitToLast(20)), records => next(Object.fromEntries(Object.entries(records || {}).map(([id, value]) => [id, { ...value, matchId: id, code: id }]))), fail);
    },
    openMatch(matchId, callbacks) {
      const id = roomId(matchId), self = uid(), base = `rooms/${id}`;
      let alive = true, control = null, puzzleLoading = false, puzzleLoaded = false, startPending = false, presenceRef = null, disconnectAction = null, presenceGeneration = 0, presencePending = false, finished = false;
      const stops = [], memberStops = new Map();
      const fail = error => { if (alive) callbacks.error?.(error); };
      const subscribe = (leaf, callback) => stops.push(watch(at(`${base}/${leaf}`), value => { if (alive) callback?.(value); }, fail));
      async function registerPresence() {
        if (!alive || !connected || finished || presenceRef || presencePending || !control || !['waiting', 'playing'].includes(control.status) || Date.now() + clockOffset >= control.createdAt + 3600000) return;
        const generation = ++presenceGeneration, first = Math.floor(Math.random() * 8);
        presencePending = true;
        try {
          for (let attempt = 0; attempt < 8; attempt++) {
            if (!alive || !connected || generation !== presenceGeneration) return;
            const nonce = crypto.randomUUID(), slot = at(`${base}/presence/${self}/${(first + attempt) % 8}`), target = sdk.child(slot, nonce), disconnect = onDisconnect(target);
            await disconnect.remove();
            if (!alive || generation !== presenceGeneration) { await disconnect.cancel(); return; }
            let result;
            try {
              result = await runTransaction(slot, current => current?.[current.active] ? undefined : { active: nonce, [nonce]: { online: true, connectedAt: serverTimestamp() } }, { applyLocally: false });
            } catch (error) { await disconnect.cancel(); throw error; }
            if (!result.committed) { await disconnect.cancel(); continue; }
            if (!alive || generation !== presenceGeneration) { await remove(target); await disconnect.cancel(); return; }
            presenceRef = target; disconnectAction = disconnect; return;
          }
          callbacks.presenceError?.(new Error('Presence is available in up to eight tabs at a time.'));
        } catch (error) { if (alive) callbacks.presenceError?.(error); }
        finally { presencePending = false; }
      }
      async function loadPuzzle() {
        if (!alive || puzzleLoading || puzzleLoaded || !control?.startedAt) return;
        puzzleLoading = true;
        try {
          const puzzle = await revealPuzzle(id, control);
          if (!alive) return;
          puzzleLoaded = true; callbacks.puzzle?.(puzzle);
          const target = at(`${base}/states/${self}`), state = (await get(target)).val();
          if (state || !alive || control.status !== 'playing' || finished || (await get(at(`${base}/result`))).exists()) return;
          const meta = toMeta(control, id);
          if (Date.now() + clockOffset >= meta.deadline) return;
          await runTransaction(target, current => current ? undefined : { board: getAdapter(control.game).initialBoard(puzzle), revision: 0, moves: 0, updatedAt: serverTimestamp() }, { applyLocally: false });
        } catch (error) {
          puzzleLoaded = false;
          if (alive) {
            // A finish can race the initial board write; finished rooms may have
            // no saved board for a participant who disconnected at the start.
            try { if ((await get(at(`${base}/result`))).exists()) return; } catch { /* Preserve the original read/write error. */ }
            callbacks.recoverableError?.(error);
          }
        }
        finally { puzzleLoading = false; }
      }
      subscribe('control', value => {
        control = value;
        const meta = toMeta(value, id); callbacks.meta?.(meta);
        const members = Object.keys(meta?.members || {});
        for (const [member, removers] of memberStops) if (!members.includes(member)) { removers.forEach(fn => fn()); memberStops.delete(member); }
        for (const member of members) if (!memberStops.has(member)) memberStops.set(member, [watch(at(`${base}/summaries/${member}`), summary => { if (alive) callbacks.summary?.(member, summary); }, fail), watch(at(`${base}/presence/${member}`), sessions => { if (alive) callbacks.presence?.(member, Object.fromEntries(Object.values(sessions || {}).filter(slot => slot?.active && slot[slot.active]).map(slot => [slot.active, slot[slot.active]]))); }, fail)]);
        void registerPresence(); void loadPuzzle();
        if (value?.readyHost && value?.readyGuest && value.status === 'waiting' && connected && !startPending) {
          startPending = true; void startIfReady(id, value).catch(fail).finally(() => { startPending = false; });
        }
      });
      subscribe(`states/${self}`, callbacks.state);
      subscribe('result', value => { finished = Boolean(value); callbacks.result?.(value); });
      subscribe('rematch', callbacks.rematch);
      stops.push(watch(ref(db, '.info/connected'), online => {
        if (online) { void registerPresence(); void loadPuzzle(); }
        else { presenceGeneration++; presenceRef = null; disconnectAction = null; }
      }));
      const handle = {
        async readState() { return (await get(at(`${base}/states/${self}`))).val(); },
        async saveState(board, expected, progress) {
          requireConnection(); if (!alive) throw new Error('This room has been closed.');
          const result = await runTransaction(at(`${base}/states/${self}`), current => {
            const value = current || expected;
            if (value.revision !== expected.revision || value.moves !== expected.moves) return;
            return { board: [...board], revision: expected.revision + 1, moves: expected.moves + 1, updatedAt: serverTimestamp() };
          }, { applyLocally: false });
          if (!result.committed) throw new RevisionConflict();
          const saved = result.snapshot.val(); let summarySaved = true;
          try { await set(at(`${base}/summaries/${self}`), { progress, revision: saved.revision, moves: saved.moves, updatedAt: serverTimestamp() }); } catch { summarySaved = false; }
          return { state: saved, summarySaved };
        },
        async close() {
          if (!alive) return; alive = false; presenceGeneration++;
          stops.forEach(fn => fn()); for (const removers of memberStops.values()) removers.forEach(fn => fn()); memberStops.clear(); handles.delete(handle);
          if (presenceRef && connected) { try { await remove(presenceRef); await disconnectAction?.cancel(); } catch { /* Registered onDisconnect remains the fallback. */ } }
          presenceRef = null; disconnectAction = null;
        },
      };
      handles.add(handle); return handle;
    },
    async destroy() { if (disposed) return; disposed = true; await Promise.all([...handles].map(handle => handle.close())); connectionStop(); for (const stop of cleanup) stop(); cleanup.clear(); },
  };
}
