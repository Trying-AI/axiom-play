import { adapters, getAdapter, multiplayerGames } from './adapters/index.js';
import { element } from './adapters/shared.js';
import { StateSync } from './state-sync.js';
import { isRoomId, parseInvitation } from './protocol.js';
import { interfaceMarkup } from './markup.js';
export function mountRoomInterface(container, { navigate = () => {}, path = '/multiplayer', search = '', client, transportFactory }) {
container.innerHTML = interfaceMarkup;
const $ = id => container.querySelector('#rmp-' + id);
$('game-choice').replaceChildren(...multiplayerGames.map(game => element('option', { value: game.id }, [game.title])));
$('game-list').replaceChildren(...multiplayerGames.map(game => element('li', {}, [game.title])));
const terminal = status => ['finished', 'closed', 'expired'].includes(status);
const elapsed = milliseconds => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const storedRoom = uid => { try { return sessionStorage.getItem(`axiom-online-match:${uid}`); } catch { return null; } };
function storeRoom(uid, value) { try { value ? sessionStorage.setItem(`axiom-online-match:${uid}`, value) : sessionStorage.removeItem(`axiom-online-match:${uid}`); } catch { /* In-memory play still works. */ } }
let transport, user = null, currentRoom = null, historyStop = null, busy = false, connected = false, clockOffset = 0, destroyed = false;
const cleanup = [];
function listen(node, type, fn) { node.addEventListener(type, fn); cleanup.push(() => node.removeEventListener(type, fn)); }
function notice(message) { $('notice').textContent = message || ''; $('notice').hidden = !message; }
function showView(name) { for (const view of ['auth', 'lobby', 'match']) $(`${view}-view`).hidden = name !== view; }
function readableError(error) {
  const code = error?.code || '';
  if (code === 'auth/requires-recent-login') return 'Sign in again to continue.';
  if (code === 'auth/network-request-failed' || code === 'NETWORK_ERROR' || code === 'DISCONNECTED') return 'The online database did not respond. Check your connection and try again.';
  if (/permission[_ -]?denied/iu.test(code + ' ' + String(error?.message || ''))) return 'This room is full, expired, or unavailable to your account, or a beta limit was reached. Only its two participants can open it.';
  if (code === 'auth/too-many-requests') return 'Too many requests. Wait a moment, then try again.';
  return typeof error?.message === 'string' ? error.message.replace(/^Firebase:\s*/u, '').slice(0, 400) : 'The action did not finish. Try again.';
}
async function action(task) {
  if (busy || destroyed) return;
  busy = true; notice(''); updateControls();
  try { await task(); }
  catch (error) { if (!destroyed) notice(readableError(error)); }
  finally { busy = false; if (!destroyed) updateControls(); }
}
function updateControls() {
  if (destroyed) return;
  $('create-room').disabled = busy || !connected;
  $('join-room').disabled = busy || !connected;
  if (currentRoom) updateMatch(currentRoom);
}
function detachRoom({ clearPointer = false } = {}) {
  const room = currentRoom;
  if (!room) return Promise.resolve();
  currentRoom = null;
  if (clearPointer && user) storeRoom(user.uid, null);
  clearInterval(room.ticker);
  room.sync?.destroy(); room.boardUI?.destroy();
  const closing = room.handle?.close() || Promise.resolve();
  $('board-host').replaceChildren(element('p', { class: 'rmp-quiet' }, ['Waiting for your puzzle…']));
  return closing;
}
function showLobby({ clearPointer = false } = {}) {
  if (destroyed) return;
  detachRoom({ clearPointer });
  if (historyStop) { historyStop(); historyStop = null; }
  if (!user) { showView('auth'); return; }
  showView('lobby'); $('tester-name').textContent = user.displayName || 'player';
  historyStop = transport.watchHistory(renderHistory, error => notice(readableError(error)));
  updateControls();
}
function renderHistory(records) {
  if (destroyed) return;
  const items = Object.values(records).filter(record => record && typeof record.matchId === 'string').sort((a, b) => b.createdAt - a.createdAt);
  if (!items.length) { $('history-list').replaceChildren(element('p', { class: 'rmp-quiet' }, ['No rooms yet. Start your first friendly challenge above.'])); return; }
  const rows = items.map(record => {
    const title = Object.hasOwn(adapters, record.game) ? getAdapter(record.game).title : 'Puzzle';
    const info = element('div', { class: 'rmp-history-info' }, [element('strong', {}, [`${title} · ${record.difficulty || 'medium'}`]), element('p', {}, [new Date(record.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })])]);
    const button = element('button', { type: 'button', class: 'button secondary', 'aria-label': `Open ${title} room ${record.code}` }, ['Open room']);
    button.addEventListener('click', () => { notice(''); openRoom(record.matchId); });
    return element('div', { class: 'rmp-history-row' }, [info, button]);
  });
  $('history-list').replaceChildren(...rows);
}
function openRoom(matchId) {
  if (destroyed) return;
  if (!user || !isRoomId(matchId)) { notice('That saved room identifier is invalid.'); return; }
  detachRoom();
  if (historyStop) { historyStop(); historyStop = null; }
  const room = { id: matchId, meta: null, puzzle: null, state: null, summaries: {}, presence: {}, result: null, sync: null, boardUI: null, adapter: null, handle: null, syncView: null, error: false, ticker: null };
  currentRoom = room; storeRoom(user.uid, matchId); showView('match');
  $('result-panel').hidden = true; $('match-heading').textContent = 'Preparing your room…'; $('match-description').textContent = '';
  $('room-code').textContent = '—'; $('match-level').textContent = '—'; $('match-status').textContent = 'Loading the match…'; $('save-status').textContent = 'Loading board…';
  $('players').replaceChildren();
  const active = callback => (...args) => { if (currentRoom === room && !destroyed) callback(...args); };
  room.handle = transport.openMatch(matchId, {
    meta: active(meta => { room.meta = meta; if (!meta) { room.error = true; notice('This room no longer exists.'); } updateMatch(room); }),
    puzzle: active(puzzle => { room.puzzle = puzzle; ensureBoard(room); updateMatch(room); }),
    state: active(state => { room.state = state; if (room.adapter && state && room.adapter.validBoard(room.puzzle, state.board)) room.sync?.receive(state); ensureBoard(room); updateMatch(room); }),
    result: active(result => { room.result = result; updateMatch(room); }),
    summary: active((uid, value) => { room.summaries[uid] = value; renderPlayers(room); }),
    presence: active((uid, value) => { room.presence[uid] = value; renderPlayers(room); }),
    error: active(error => { room.error = true; room.sync?.setPlayable(false); notice(readableError(error)); updateMatch(room); }),
    recoverableError: active(error => { notice(readableError(error) + ' Reopen the room or reconnect to retry.'); }),
    presenceError: active(() => { /* Presence is advisory; board/result errors are handled separately. */ }),
  });
  room.ticker = setInterval(() => updateMatch(room), 500);
}
function ensureBoard(room) {
  if (currentRoom !== room || room.boardUI || !room.puzzle || !room.state || !room.handle || !room.meta) return;
  try {
    if (room.meta.schemaVersion !== 1 || room.meta.gameVersion !== 1 || room.puzzle.version !== 1) throw new Error('This room uses an unsupported game version. Reload the page before resuming.');
    room.adapter = getAdapter(room.meta.game);
    if (!room.adapter.validPuzzle(room.puzzle)) throw new Error('The server supplied an invalid puzzle. Editing has been stopped.');
    // The puzzle grant and private board initialize independently; wait until
    // both describe a valid game before enabling the board renderer.
    if (!room.adapter.validBoard(room.puzzle, room.state.board)) return;
    room.sync = new StateSync({
      save: (board, expected, progress) => room.handle.saveState(board, expected, progress),
      read: () => room.handle.readState(),
      progress: board => room.adapter.progress(room.puzzle, board),
      notice: message => { if (currentRoom === room) notice(message); },
      change: view => {
        if (currentRoom !== room) return;
        room.syncView = view;
              $('back-to-rooms').disabled = busy || view.pending;
        $('end-room').disabled = busy || !connected || view.pending;
        if (view.board) room.boardUI?.update(view.board, { locked: !view.editable });
        updateSaveStatus(room); renderPlayers(room); updateSubmit(room);
      },
    });
    room.boardUI = room.adapter.mount($('board-host'), { puzzle: room.puzzle, board: room.state.board, onChange: board => room.sync.edit(board) });
    room.sync.receive(room.state);
    void room.sync.setConnected(connected);
    updateMatch(room);
  } catch (error) { room.error = true; notice(readableError(error)); }
}
function isPlayable(room) {
  const now = Date.now() + clockOffset, meta = room.meta;
  return !room.error && meta?.status === 'playing' && now >= meta.startAt && now < Math.min(meta.expiresAt, meta.deadline || Infinity) && !room.result;
}
function updateMatch(room) {
  if (currentRoom !== room) return;
  const meta = room.meta;
  if (!meta) { $('submit-board').disabled = true; $('ready-button').disabled = true; $('end-room').disabled = true; return; }
  ensureBoard(room);
  const adapter = room.adapter || getAdapter(meta.game), now = Date.now() + clockOffset;
  $('match-heading').textContent = `${adapter.title} race`;
  $('match-description').textContent = adapter.description;
  $('room-code').textContent = meta.joinCode || '—';
  const size = room.puzzle?.size || adapter.sizes[meta.difficulty];
  $('match-level').textContent = `${meta.difficulty[0].toUpperCase()}${meta.difficulty.slice(1)} · ${size} × ${size}`;
  $('progress-note').textContent = `Progress shows ${adapter.progressLabel}; it can move backward and never decides the winner. Your opponent cannot read your board.`;
  const playable = isPlayable(room), expired = now >= meta.expiresAt || (meta.deadline && now >= meta.deadline);
  if (room.sync && room.sync.playable !== playable) room.sync.setPlayable(playable);
  let status = 'Waiting for a second player. Share the room code, then both select ready.';
  if (room.error) status = 'This room is unavailable to this account. Return to rooms to continue.';
  else if (room.result || meta.status === 'finished') status = 'Match complete. The database has confirmed the result.';
  else if (meta.status === 'closed') status = 'This room was ended. Its last saved boards remain available to its players.';
  else if (meta.status === 'expired' || expired) status = 'This room has expired. You can review the saved board and start a new room.';
  else if (!connected) status = 'Disconnected from the database. Editing is paused until your saved board is restored.';
  else if (meta.status === 'playing' && now < meta.startAt) status = `Same puzzle, your own board. Starting in ${Math.max(1, Math.ceil((meta.startAt - now) / 1000))}…`;
  else if (meta.status === 'playing') status = 'The race is on. Solve your board, then submit it for server validation.';
  else if (Object.keys(meta.members || {}).length === 2) status = 'Both players are here. Select ready when you are set; the puzzle appears together.';
  $('match-status').textContent = status; $('match-status').dataset.active = String(playable && connected);
  $('elapsed').textContent = elapsed(room.result ? Math.max(0, room.result.finishedAt - meta.startAt) : (meta.startAt ? Math.max(0, now - meta.startAt) : 0));
  if (!room.puzzle && !room.boardUI) $('board-host').replaceChildren(element('div', { class: 'rmp-waiting-puzzle' }, [element('span', { class: 'rmp-section-icon', 'aria-hidden': 'true' }, ['✦']), element('p', { class: 'rmp-quiet' }, ['Your puzzle appears when both players are ready.']), element('p', { class: 'rmp-quiet' }, ['Both players receive the same challenge.'])]));
  if (room.puzzle && !room.state && (room.result || terminal(meta.status) || expired)) $('board-host').replaceChildren(element('p', { class: 'rmp-quiet' }, ['You did not save a board before this room ended.']));
  const ready = meta.members?.[user.uid]?.ready === true;
  $('ready-button').hidden = meta.status !== 'waiting' || expired || room.error;
  $('ready-button').textContent = ready ? 'Ready · tap to undo' : "I'm ready";
  $('ready-button').disabled = busy || !connected;
  $('end-room').hidden = terminal(meta.status) || Boolean(room.result) || expired || room.error;
  $('end-room').disabled = busy || !connected || Boolean(room.sync?.pending);
  $('back-to-rooms').disabled = busy || Boolean(room.sync?.pending);
  $('copy-code').disabled = !meta.joinCode;
  renderPlayers(room); updateSaveStatus(room); updateSubmit(room); renderResult(room);
}
function updateSaveStatus(room) {
  const view = room.syncView;
  const node = $('save-status');
  node.dataset.pending = String(Boolean(view?.pending));
  if (!room.puzzle) node.textContent = 'Puzzle not revealed yet';
  else if (!view) node.textContent = 'Restoring your board…';
  else if (!connected) node.textContent = view.pending ? 'Offline · move not acknowledged' : `Offline · saved revision ${view.canonical?.revision ?? 0}`;
  else if (view.reconciling) node.textContent = 'Restoring saved state…';
  else if (view.pending) node.textContent = 'Saving your move…';
  else node.textContent = `Saved online · revision ${view.canonical?.revision ?? 0}${view.summarySaved ? '' : ' · progress delayed'}`;
}
function updateSubmit(room) {
  const view = room.syncView;
  const complete = Boolean(view?.board && room.adapter?.complete(room.puzzle, view.board));
  $('submit-board').disabled = busy || !connected || !isPlayable(room) || !complete || view.pending || view.reconciling;
  $('completion-note').textContent = room.result ? 'Result confirmed by the database.' : complete ? (view.pending ? 'Your complete board is saving. Submit when it is acknowledged.' : 'Your board looks complete. Submit it for server validation.') : 'Complete your board, then submit. The database validates the completed board.';
}
function renderPlayers(room) {
  if (currentRoom !== room || !room.meta || !user) return;
  const entries = Object.entries(room.meta.members || {}).sort(([a], [b]) => a === user.uid ? -1 : b === user.uid ? 1 : 0);
  const cards = entries.map(([uid, member]) => {
    const own = uid === user.uid, summary = room.summaries[uid];
    const value = own && room.syncView?.board ? room.adapter.progress(room.puzzle, room.syncView.board) : Math.max(0, Math.min(100, summary?.progress || 0));
    const online = Object.values(room.presence[uid] || {}).some(session => session?.online === true);
    const status = room.result || terminal(room.meta.status) ? 'Room ended' : `${online ? 'Connected' : 'Disconnected'}${room.meta.status === 'waiting' ? (member.ready ? ' · ready' : ' · not ready') : ''}`;
    const avatar = element('span', { class: `rmp-player-avatar${own ? '' : ' rmp-opponent'}` }, [(member.displayName || 'P').slice(0, 1)]);
    const detail = element('div', {}, [element('strong', {}, [`${member.displayName || 'Player'}${own ? ' (you)' : ''}`]), element('small', {}, [status])]);
    const track = element('div', { class: `rmp-player-track${own ? '' : ' rmp-opponent'}`, role: 'progressbar', 'aria-label': `${member.displayName || 'Player'} ${getAdapter(room.meta.game).progressLabel}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value }, [element('span', { style: `width:${value}%` })]);
    return element('div', { class: 'rmp-player' }, [element('div', { class: 'rmp-player-head' }, [avatar, detail, element('span', { class: 'rmp-player-percent' }, [`${value}%`])]), track]);
  });
  if (entries.length < 2) cards.push(element('div', { class: 'rmp-player rmp-quiet' }, [element('strong', {}, ['A seat for your friend']), element('p', {}, ['Waiting for the second player…'])]));
  $('players').replaceChildren(...cards);
}
function renderResult(room) {
  $('result-panel').hidden = !room.result;
  if (!room.result) return;
  const name = room.meta?.members?.[room.result.winnerUid]?.displayName || 'The other player';
  $('result-heading').textContent = room.result.winnerUid === user.uid ? 'You solved it first.' : `${name} solved it first.`;
  $('result-copy').textContent = `Valid board confirmed in ${elapsed(room.result.finishedAt - room.meta?.startAt)}. Both boards are now saved and locked. Start another room to play again.`;
}

listen($('sign-in'), 'click', () => action(async () => {
  const { mountAuth } = await import('../auth-ui.js');
  if (destroyed) return;
  $('sign-in').hidden = true;
  cleanup.push(mountAuth($('inline-auth'), { navigate, mode: 'signin', client }));
}));
listen($('create-form'), 'submit', event => { event.preventDefault(); void action(async () => { const result = await transport.call('createMatch', { game: $('game-choice').value, difficulty: $('difficulty-choice').value }); openRoom(result.matchId); }); });
listen($('join-form'), 'submit', event => { event.preventDefault(); void action(async () => { const id = parseInvitation($('join-code').value); if (!id) throw new Error('Paste a valid room invitation link or its full room ID.'); const result = await transport.call('joinMatch', { code: id }); openRoom(result.matchId); }); });
listen($('ready-button'), 'click', () => action(async () => { const room = currentRoom; if (!room?.meta) return; await transport.call('setReady', { matchId: room.id, ready: !room.meta.members?.[user.uid]?.ready }); }));
listen($('submit-board'), 'click', () => action(async () => { const room = currentRoom; if (!room?.sync?.canonical || room.sync.pending || !isPlayable(room)) return; const response = await transport.call('submitResult', { matchId: room.id, revision: room.sync.canonical.revision }); if (currentRoom === room) { room.result = response.result; updateMatch(room); } }));
listen($('end-room'), 'click', () => action(async () => { if (currentRoom) await transport.call('leaveMatch', { matchId: currentRoom.id }); }));
listen($('back-to-rooms'), 'click', () => { if (currentRoom?.sync?.pending) { notice('Wait for your move to save, or reconnect, before returning to rooms.'); return; } notice(''); showLobby({ clearPointer: true }); });
listen($('copy-code'), 'click', () => action(async () => {
  const id = currentRoom?.id; if (!id) return;
  const url = new URL(window.location.href); url.hash = `/room/${id}`;
  try { await navigator.clipboard.writeText(url.href); notice('Invitation copied. Send it to a friend who has an Axiom account.'); }
  catch { notice(`Room ID: ${id}. Select and copy it above; your friend can paste it into Join a friend.`); }
}));
listen(window, 'beforeunload', event => { if (currentRoom?.sync?.pending) { event.preventDefault(); event.returnValue = ''; } });
function destroy() {
  if (destroyed) return; destroyed = true; void detachRoom();
  if (historyStop) historyStop(); historyStop = null;
  cleanup.splice(0).forEach(fn => fn()); void transport?.destroy();
}
const onPageHide = () => { destroy(); window.addEventListener('pageshow', restore, { once: true }); };
listen(window, 'pagehide', onPageHide);
// Rebuild disposed connections after a browser back/forward-cache restoration.
const restore = event => { if (event.persisted) window.location.reload(); };
let initializing = false;
async function connect(account) {
  if (destroyed || initializing || transport) return;
  if (!account) { user = null; showView('auth'); $('connection').textContent = 'Sign in to connect'; return; }
  initializing = true; user = account;
  try {
    const created = await transportFactory();
    if (destroyed || client.getSnapshot().user?.uid !== account.uid) { await created.destroy(); return; }
    transport = created;
    cleanup.push(transport.watchConnection(online => {
      if (destroyed) return;
      connected = online;
      $('connection').textContent = online ? 'Connected securely' : 'Reconnecting…';
      $('connection').dataset.online = String(online);
      if (currentRoom?.sync) void currentRoom.sync.setConnected(online);
      updateControls();
    }));
    cleanup.push(transport.watchClock(offset => { clockOffset = offset; }));
    const invite = path.match(/^\/room\/([^/]+)$/u)?.[1] || new URLSearchParams(search).get('room');
    if (isRoomId(invite)) {
      showLobby(); $('join-code').value = invite;
      notice('Invitation ready. Select Join room to take the second seat or resume your room.');
    } else { const saved = storedRoom(account.uid); isRoomId(saved) ? openRoom(saved) : showLobby(); }
    updateControls();
  } catch (error) { notice(readableError(error)); $('connection').textContent = 'Online rooms unavailable'; showView('auth'); }
  finally { initializing = false; }
}
void client.initialize().then(() => connect(client.getSnapshot().user)).catch(error => notice(readableError(error)));
cleanup.push(client.subscribe(snapshot => {
  if (destroyed) return;
  if (user?.uid && snapshot.user?.uid !== user.uid) {
    void detachRoom(); if (historyStop) historyStop(); historyStop = null;
    void transport?.destroy(); transport = null; connected = false; user = null; showView('auth');
  }
  if (snapshot.user && !transport && !initializing) void connect(snapshot.user);
}));
return { destroy };
}
