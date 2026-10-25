import { element, listenScope, moveFocus, numericBoard } from './shared.js';

export function validPuzzle(puzzle) { return [3, 4, 5].includes(puzzle?.size) && numericBoard(puzzle.initial, puzzle.size ** 2, 1) && puzzle.initial.some(Boolean); }
export function validBoard(puzzle, board) { return [3, 4, 5].includes(puzzle?.size) && numericBoard(board, puzzle.size ** 2, 1); }
export function neighbors(cell, size) {
  const row = Math.floor(cell / size), column = cell % size;
  return [cell, row ? cell - size : -1, row < size - 1 ? cell + size : -1, column ? cell - 1 : -1, column < size - 1 ? cell + 1 : -1].filter(index => index >= 0);
}
// Saved state is press parity. Every board is reconstructed from the immutable
// starting lights, so a zero-filled state cannot claim an unplayed win.
export function lightsFor(puzzle, board) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, board)) throw new Error('Invalid Lights Out state.');
  return puzzle.initial.map((value, cell) => neighbors(cell, puzzle.size).reduce((light, index) => light ^ board[index], value));
}
export function togglePress(puzzle, board, cell) {
  if (!validBoard(puzzle, board) || !Number.isInteger(cell) || cell < 0 || cell >= board.length) throw new Error('Choose a square on the Lights Out board.');
  const next = [...board]; next[cell] ^= 1; return next;
}
export function complete(puzzle, board) { return validPuzzle(puzzle) && validBoard(puzzle, board) && lightsFor(puzzle, board).every(value => value === 0); }
export function progress(puzzle, board) { return Math.floor(100 * lightsFor(puzzle, board).filter(value => value === 0).length / board.length); }
export function mount(container, { puzzle, board: initial, onChange }) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, initial)) throw new Error('The Lights Out puzzle or saved board is invalid.');
  const scope = listenScope(), size = puzzle.size; let board = [...initial], locked = true;
  const stage = element('div', { class: 'rmp-puzzle' });
  const grid = element('div', { class: 'rmp-board rmp-lightsout', style: `--board-size:${size}`, role: 'group', 'aria-label': `Your ${size} by ${size} Lights Out board` });
  const note = element('p', { class: 'rmp-board-note', 'aria-live': 'polite' });
  const cells = board.map((_, i) => {
    const cell = element('button', { type: 'button', class: 'rmp-cell' });
    scope.on(cell, 'click', () => {
      if (locked) return;
      const next = togglePress(puzzle, board, i);
      if (onChange(next) !== false) { board = next; render(); }
    });
    grid.append(cell); return cell;
  });
  scope.on(grid, 'keydown', event => moveFocus(event, cells, size));
  function render() {
    const lights = lightsFor(puzzle, board), on = lights.filter(Boolean).length;
    cells.forEach((cell, i) => {
      cell.textContent = lights[i] ? '●' : '·';
      cell.classList.toggle('rmp-light-on', lights[i] === 1);
      cell.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${i % size + 1}: light ${lights[i] ? 'on' : 'off'}. Press to toggle this square and its orthogonal neighbors.`);
      cell.setAttribute('aria-pressed', String(lights[i] === 1));
      cell.setAttribute('aria-disabled', String(locked));
    });
    grid.dataset.locked = String(locked);
    note.textContent = `${on} lights on. Each press toggles this square and its neighbors above, below, left and right. Press again to undo that toggle.`;
  }
  stage.append(grid, note); container.replaceChildren(stage); render();
  return { update(next, options = {}) { if (!validBoard(puzzle, next)) throw new Error('Invalid saved Lights Out board.'); board = [...next]; locked = options.locked ?? locked; render(); }, destroy() { scope.destroy(); stage.remove(); } };
}
export default { id: 'lightsout', title: 'Lights Out', description: 'Turn every light off. Press a square to toggle it and its four orthogonal neighbors. Your opponent has the same starting lights and a private board.', validPuzzle, validBoard, initialBoard: puzzle => Array(puzzle.size ** 2).fill(0), complete, progress, mount };
