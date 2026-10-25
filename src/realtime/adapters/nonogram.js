import { element, listenScope, moveFocus, numericBoard } from './shared.js';

export const normalizedClue = clue => clue.length === 1 && clue[0] === 0 ? [] : clue;
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
export function lineClues(line) {
  const runs = []; let length = 0;
  for (const value of [...line, 0]) {
    if (value === 1) length++;
    else if (length) { runs.push(length); length = 0; }
  }
  return runs;
}
export function validPuzzle(puzzle) {
  const size = puzzle?.size;
  if (![5, 6, 7].includes(size)) return false;
  const validClues = clues => Array.isArray(clues) && clues.length === size && Array.from(clues).every(clue => {
    if (!Array.isArray(clue) || !clue.length) return false;
    if (clue.length === 1 && clue[0] === 0) return true;
    return Array.from(clue).every(value => Number.isInteger(value) && value >= 1 && value <= size) && clue.reduce((sum, value) => sum + value, 0) + clue.length - 1 <= size;
  });
  if (!validClues(puzzle.rowClues) || !validClues(puzzle.columnClues)) return false;
  return puzzle.rowClues.flat().reduce((sum, value) => sum + value, 0) === puzzle.columnClues.flat().reduce((sum, value) => sum + value, 0);
}
export function validBoard(puzzle, board) { return [5, 6, 7].includes(puzzle?.size) && numericBoard(board, puzzle.size ** 2, 2); }
export function matchingLines(puzzle, board) {
  const size = puzzle.size;
  return {
    rows: puzzle.rowClues.map((clue, row) => same(lineClues(board.slice(row * size, (row + 1) * size)), normalizedClue(clue))),
    columns: puzzle.columnClues.map((clue, column) => same(lineClues(Array.from({ length: size }, (_, row) => board[row * size + column])), normalizedClue(clue))),
  };
}
export function complete(puzzle, board) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, board)) return false;
  const matches = matchingLines(puzzle, board); return matches.rows.every(Boolean) && matches.columns.every(Boolean);
}
export function progress(puzzle, board) {
  const matches = matchingLines(puzzle, board);
  return Math.floor(100 * [...matches.rows, ...matches.columns].filter(Boolean).length / (puzzle.size * 2));
}
export function mount(container, { puzzle, board: initial, onChange }) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, initial)) throw new Error('The Nonogram puzzle or saved board is invalid.');
  const scope = listenScope(), size = puzzle.size; let board = [...initial], locked = true, mode = 1;
  const stage = element('div', { class: 'rmp-puzzle' });
  const grid = element('div', { class: 'rmp-board rmp-nonogram', style: `--board-size:${size}`, role: 'group', 'aria-label': `Your ${size} by ${size} Nonogram board with row and column clues` });
  const controls = element('div', { class: 'rmp-number-pad rmp-mark-controls', role: 'group', 'aria-label': 'Nonogram mark mode' });
  const note = element('p', { class: 'rmp-board-note', 'aria-live': 'polite' });
  grid.append(element('span', { class: 'rmp-clue-corner', 'aria-hidden': 'true' }, ['Clues']));
  const columnLabels = puzzle.columnClues.map((clue, i) => {
    const label = element('div', { class: 'rmp-clue rmp-column-clue', 'aria-label': `Column ${i + 1} clues: ${clue.join(', ')}` }, clue.map(value => element('span', {}, [String(value)])));
    grid.append(label); return label;
  });
  const rowLabels = [];
  function mark(index, value, toggle = true) {
    if (locked) return;
    const next = [...board]; next[index] = toggle && next[index] === value ? 0 : value;
    if (next[index] === board[index]) return;
    if (onChange(next) !== false) { board = next; render(); }
  }
  const cells = board.map((_, i) => {
    if (i % size === 0) {
      const row = Math.floor(i / size), clue = puzzle.rowClues[row];
      const label = element('div', { class: 'rmp-clue rmp-row-clue', 'aria-label': `Row ${row + 1} clues: ${clue.join(', ')}` }, [clue.join(' ')]);
      grid.append(label); rowLabels.push(label);
    }
    const cell = element('button', { type: 'button', class: 'rmp-cell' });
    scope.on(cell, 'click', () => mark(i, mode));
    scope.on(cell, 'contextmenu', event => { event.preventDefault(); mark(i, 2); });
    grid.append(cell); return cell;
  });
  const modeButtons = [[1, 'Fill'], [2, 'Cross'], [0, 'Erase']].map(([value, label]) => {
    const button = element('button', { type: 'button', 'aria-pressed': String(mode === value) }, [label]);
    scope.on(button, 'click', () => { mode = value; updateMode(); }); controls.append(button); return { value, button };
  });
  function updateMode() { for (const { value, button } of modeButtons) { button.setAttribute('aria-pressed', String(mode === value)); button.disabled = locked; } }
  scope.on(grid, 'keydown', event => {
    const index = cells.indexOf(document.activeElement); moveFocus(event, cells, size);
    if (index < 0) return;
    const value = { '1': 1, '2': 2, '0': 0, Backspace: 0, Delete: 0 }[event.key];
    if (value !== undefined) { event.preventDefault(); mark(index, value, false); }
  });
  function render() {
    const matches = matchingLines(puzzle, board), count = [...matches.rows, ...matches.columns].filter(Boolean).length;
    cells.forEach((cell, i) => {
      cell.textContent = board[i] === 2 ? '×' : '';
      cell.classList.toggle('rmp-filled', board[i] === 1);
      cell.setAttribute('aria-pressed', String(board[i] === 1));
      cell.setAttribute('aria-disabled', String(locked));
      cell.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${i % size + 1}: ${board[i] === 1 ? 'filled' : board[i] === 2 ? 'crossed out' : 'empty'}`);
    });
    rowLabels.forEach((node, i) => node.classList.toggle('rmp-clue-matched', matches.rows[i]));
    columnLabels.forEach((node, i) => node.classList.toggle('rmp-clue-matched', matches.columns[i]));
    grid.dataset.locked = String(locked); updateMode();
    note.textContent = `${count} / ${size * 2} clues matched. Choose Fill, Cross or Erase, then tap squares. Crosses are optional. Keyboard: 1 fill, 2 cross, Delete erase.`;
  }
  stage.append(grid, controls, note); container.replaceChildren(stage); render();
  return { update(next, options = {}) { if (!validBoard(puzzle, next)) throw new Error('Invalid saved Nonogram board.'); board = [...next]; locked = options.locked ?? locked; render(); }, destroy() { scope.destroy(); stage.remove(); } };
}
export default { id: 'nonogram', title: 'Nonogram', description: 'Fill squares to match the runs beside each row and above each column. Leave at least one empty square between runs. Crosses mark empty squares and are optional.', validPuzzle, validBoard, initialBoard: puzzle => Array(puzzle.size ** 2).fill(0), complete, progress, mount };
