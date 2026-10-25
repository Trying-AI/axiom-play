import { element, listenScope, moveFocus, numericBoard } from './shared.js';

export function validPuzzle(puzzle) {
  return puzzle?.size === 6 && numericBoard(puzzle.givens, 36, 6) && conflicts(puzzle, puzzle.givens).size === 0;
}

export function validBoard(puzzle, board) {
  return numericBoard(board, 36, 6) && board.every((n, i) => !puzzle.givens[i] || puzzle.givens[i] === n);
}

export function conflicts(puzzle, board) {
  const invalid = new Set();
  for (let i = 0; i < 36; i++) {
    if (!board[i]) continue;
    const row = Math.floor(i / 6), column = i % 6;
    for (let j = i + 1; j < 36; j++) {
      if (board[i] !== board[j]) continue;
      const otherRow = Math.floor(j / 6), otherColumn = j % 6;
      if (row === otherRow || column === otherColumn || (Math.floor(row / 2) === Math.floor(otherRow / 2) && Math.floor(column / 3) === Math.floor(otherColumn / 3))) {
        invalid.add(i); invalid.add(j);
      }
    }
  }
  return invalid;
}

export function complete(puzzle, board) {
  return validBoard(puzzle, board) && board.every(Boolean) && conflicts(puzzle, board).size === 0;
}

export function progress(puzzle, board) {
  const total = puzzle.givens.filter(n => !n).length;
  const filled = board.filter((n, i) => !puzzle.givens[i] && n > 0).length;
  return total ? Math.floor(100 * filled / total) : 100;
}

export function mount(container, { puzzle, board: initial, onChange }) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, initial)) throw new Error('The Sudoku puzzle or saved board is invalid.');
  const scope = listenScope();
  let board = [...initial], locked = true, selected = puzzle.givens.findIndex(n => n === 0);
  const stage = element('div', { class: 'rmp-puzzle' });
  const grid = element('div', { class: 'rmp-board rmp-sudoku', role: 'group', 'aria-label': 'Your 6 by 6 Sudoku board' });
  const controls = element('div', { class: 'rmp-number-pad', role: 'group', 'aria-label': 'Sudoku number pad' });
  const message = element('p', { class: 'rmp-board-note', 'aria-live': 'polite' });
  const cells = Array.from({ length: 36 }, (_, i) => {
    const cell = element('button', { type: 'button', class: 'rmp-cell', 'data-row': Math.floor(i / 6), 'data-column': i % 6 });
    scope.on(cell, 'click', () => { if (!puzzle.givens[i]) { selected = i; render(); } });
    scope.on(cell, 'focus', () => { if (!puzzle.givens[i]) { selected = i; render(); } });
    grid.append(cell); return cell;
  });
  function enter(value) {
    if (locked || selected < 0 || puzzle.givens[selected] || board[selected] === value) return;
    const next = [...board]; next[selected] = value;
    if (onChange(next) !== false) { board = next; render(); }
  }
  const pad = [1, 2, 3, 4, 5, 6, 0].map(value => {
    const button = element('button', { type: 'button', 'aria-label': value ? `Enter ${value}` : 'Erase selected cell' }, [value ? String(value) : 'Erase']);
    scope.on(button, 'click', () => enter(value)); controls.append(button); return button;
  });
  scope.on(grid, 'keydown', event => {
    moveFocus(event, cells, 6);
    if (/^[1-6]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
    else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); enter(0); }
  });
  function render() {
    const errors = conflicts(puzzle, board);
    cells.forEach((cell, i) => {
      cell.textContent = board[i] ? String(board[i]) : '';
      cell.classList.toggle('rmp-given', Boolean(puzzle.givens[i]));
      cell.classList.toggle('rmp-selected', selected === i);
      cell.classList.toggle('rmp-conflict', errors.has(i));
      cell.setAttribute('aria-label', `Row ${Math.floor(i / 6) + 1}, column ${i % 6 + 1}: ${board[i] || 'empty'}${puzzle.givens[i] ? ', given' : ''}${errors.has(i) ? ', conflict' : ''}`);
      cell.setAttribute('aria-pressed', String(selected === i));
      cell.setAttribute('aria-disabled', String(locked || Boolean(puzzle.givens[i])));
    });
    pad.forEach(button => { button.disabled = locked; });
    grid.dataset.locked = String(locked);
    message.textContent = errors.size ? `${errors.size} cells conflict. Each row, column and 2 × 3 box needs 1–6.` : 'Select a blank square, then use the number pad or your keyboard.';
  }
  stage.append(grid, controls, message); container.replaceChildren(stage); render();
  return {
    update(next, options = {}) { if (!validBoard(puzzle, next)) throw new Error('Invalid saved Sudoku board.'); board = [...next]; locked = options.locked ?? locked; render(); },
    destroy() { scope.destroy(); stage.remove(); },
  };
}

export default { id: 'sudoku', title: 'Mini Sudoku', description: 'Fill each row, column and 2 × 3 box with 1–6. You and your opponent solve the same puzzle on separate boards.', validPuzzle, validBoard, initialBoard: puzzle => [...puzzle.givens], complete, progress, mount };
