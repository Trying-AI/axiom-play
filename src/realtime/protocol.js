export const isRoomId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
export function parseInvitation(value) {
  const text = String(value || '').trim();
  if (isRoomId(text)) return text;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const route = new URL(url.hash.slice(1) || '/', 'https://route.invalid');
    const id = route.pathname.match(/^\/room\/([^/]+)$/u)?.[1] || (route.pathname === '/multiplayer' ? route.searchParams.get('room') : null);
    return isRoomId(id) ? id : null;
  } catch { return null; }
}
export function toMeta(control, id) {
  if (!control) return null;
  const startAt = control.startedAt > 0 ? control.startedAt + 3000 : 0;
  const expiresAt = control.createdAt + 3600000;
  return { ...control, joinCode: id, startAt, expiresAt, deadline: startAt ? Math.min(expiresAt, startAt + 1800000) : 0,
    members: Object.fromEntries([[control.hostUid, { displayName: 'Player One', ready: control.readyHost }], ...(control.guestUid ? [[control.guestUid, { displayName: 'Player Two', ready: control.readyGuest }]] : [])]) };
}
export function resultProof(game, puzzle, board) {
  if (game === 'sudoku') return false;
  return Array.from({ length: puzzle.size }, (_, row) => board.slice(row * puzzle.size, (row + 1) * puzzle.size).indexOf(1));
}
