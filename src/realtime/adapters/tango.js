import { element, listenScope, moveFocus, numericBoard } from './shared.js';

export function validPuzzle(puzzle) {
  const size = puzzle?.size, total = size ** 2;
  if (![4, 6, 8].includes(size) || !numericBoard(puzzle.givens, total, 2) || !Array.isArray(puzzle.relations) || puzzle.relations.length !== Math.floor(total / 5)) return false;
  const pairs = new Set();
  for (const relation of puzzle.relations) {
    if (!relation || !Number.isInteger(relation.a) || !Number.isInteger(relation.b) || relation.a < 0 || relation.b < 0 || relation.a >= total || relation.b >= total || typeof relation.same !== 'boolean') return false;
    const { a, b } = relation;
    if (!(Math.abs(a - b) === size || (Math.abs(a - b) === 1 && Math.floor(a / size) === Math.floor(b / size)))) return false;
    const pair = [Math.min(a, b), Math.max(a, b)].join(':');
    if (pairs.has(pair)) return false;
    pairs.add(pair);
  }
  return conflicts(puzzle, puzzle.givens).size === 0;
}
export function validBoard(puzzle, board) {
  return [4, 6, 8].includes(puzzle?.size) && numericBoard(board, puzzle.size ** 2, 2) && numericBoard(puzzle.givens, puzzle.size ** 2, 2) && board.every((value, i) => !puzzle.givens[i] || value === puzzle.givens[i]);
}
export function conflicts(puzzle, board) {
  const invalid = new Set(), size = puzzle.size;
  const inspect = indices => {
    for (const value of [1, 2]) if (indices.filter(i => board[i] === value).length > size / 2) indices.filter(i => board[i] === value).forEach(i => invalid.add(i));
    for (let i = 2; i < size; i++) if (board[indices[i]] && board[indices[i]] === board[indices[i - 1]] && board[indices[i]] === board[indices[i - 2]]) indices.slice(i - 2, i + 1).forEach(index => invalid.add(index));
  };
  for (let line = 0; line < size; line++) {
    inspect(Array.from({ length: size }, (_, column) => line * size + column));
    inspect(Array.from({ length: size }, (_, row) => row * size + line));
  }
  for (const { a, b, same } of puzzle.relations) if (board[a] && board[b] && ((board[a] === board[b]) !== same)) { invalid.add(a); invalid.add(b); }
  return invalid;
}
export function complete(puzzle, board) { return validPuzzle(puzzle) && validBoard(puzzle, board) && board.every(Boolean) && conflicts(puzzle, board).size === 0; }
export function progress(puzzle, board) {
  const empty = puzzle.givens.filter(value => !value).length;
  return empty ? Math.floor(100 * board.filter((value, i) => value && !puzzle.givens[i]).length / empty) : 100;
}
export function mount(container, { puzzle, board: initial, onChange }) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, initial)) throw new Error('The Tango puzzle or saved board is invalid.');
  const scope = listenScope(), size = puzzle.size; let board = [...initial], locked = true;
  const stage = element('div', { class: 'rmp-puzzle' });
  const grid = element('div', { class: 'rmp-board rmp-tango', style: `--board-size:${size}`, role: 'group', 'aria-label': `Your ${size} by ${size} Tango board` });
  const note = element('p', { class: 'rmp-board-note', 'aria-live': 'polite' });
  function enter(index, value) {
    if (locked || puzzle.givens[index] || board[index] === value) return;
    const next = [...board]; next[index] = value;
    if (onChange(next) !== false) { board = next; render(); }
  }
  const cells = board.map((_, i) => {
    const symbol = element('span', { class: 'rmp-tango-symbol', 'aria-hidden': 'true' });
    const cell = element('button', { type: 'button', class: 'rmp-cell' }, [symbol]);
    scope.on(cell, 'click', () => enter(i, (board[i] + 1) % 3));
    grid.append(cell); return { cell, symbol };
  });
  for (const { a, b, same } of puzzle.relations) {
    const origin = Math.min(a, b), horizontal = Math.abs(a - b) === 1;
    cells[origin].cell.append(element('span', { class: `rmp-relation ${horizontal ? 'rmp-relation-right' : 'rmp-relation-below'}`, 'aria-hidden': 'true' }, [same ? '=' : '×']));
  }
  scope.on(grid, 'keydown', event => {
    const buttons = cells.map(item => item.cell), index = buttons.indexOf(document.activeElement);
    moveFocus(event, buttons, size);
    if (index < 0) return;
    const value = { '1': 1, '2': 2, '0': 0, Backspace: 0, Delete: 0 }[event.key];
    if (value !== undefined) { event.preventDefault(); enter(index, value); }
  });
  function render() {
    const errors = conflicts(puzzle, board);
    cells.forEach(({ cell, symbol }, i) => {
      symbol.textContent = board[i] === 1 ? '☀' : board[i] === 2 ? '☾' : '';
      cell.dataset.symbol = String(board[i]);
      cell.classList.toggle('rmp-given', Boolean(puzzle.givens[i]));
      cell.classList.toggle('rmp-conflict', errors.has(i));
      const relations = puzzle.relations.filter(({ a, b }) => a === i || b === i).map(({ a, b, same }) => { const other = a === i ? b : a; return `${same ? 'matches' : 'differs from'} row ${Math.floor(other / size) + 1}, column ${other % size + 1}`; });
      cell.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${i % size + 1}: ${board[i] === 1 ? 'sun' : board[i] === 2 ? 'moon' : 'empty'}${puzzle.givens[i] ? ', fixed clue' : ''}${errors.has(i) ? ', conflict' : ''}${relations.length ? '; ' + relations.join('; ') : ''}`);
      cell.setAttribute('aria-disabled', String(locked || Boolean(puzzle.givens[i])));
    });
    grid.dataset.locked = String(locked);
    note.textContent = errors.size ? `${errors.size} conflicting tiles. Check balance, triples and the = / × relationships.` : 'Tap to cycle sun → moon → empty. Keyboard: 1 sun, 2 moon, Delete erase. Dotted tiles are fixed.';
  }
  stage.append(grid, note); container.replaceChildren(stage); render();
  return { update(next, options = {}) { if (!validBoard(puzzle, next)) throw new Error('Invalid saved Tango board.'); board = [...next]; locked = options.locked ?? locked; render(); }, destroy() { scope.destroy(); stage.remove(); } };
}
export default { id: 'tango', title: 'Tango', description: 'Balance each row and column with equal numbers of suns and moons. No three identical symbols in a row. = neighbors match; × neighbors differ.', validPuzzle, validBoard, initialBoard: puzzle => [...puzzle.givens], complete, progress, mount };
