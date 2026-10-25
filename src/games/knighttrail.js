import { _rng, _shuffle, _el, _shell, _button, _score } from './queens.js';

const FALLBACKS = {
  4: [0, 6, 15, 9, 2, 4, 13, 11],
  5: [0, 7, 4, 13, 24, 17, 20, 11, 2, 5, 16, 23],
  6: [0, 8, 4, 17, 28, 32, 24, 13, 2, 6, 19, 30, 26, 34, 21, 10, 23, 15],
};

export function isKnightMove(a, b, size) {
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= size * size || b >= size * size) return false;
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) * Math.abs(a % size - b % size) === 2;
}

function neighbors(cell, size) {
  const row = Math.floor(cell / size), column = cell % size;
  return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
    .map(([dr, dc]) => [row + dr, column + dc])
    .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
    .map(([r, c]) => r * size + c);
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const size = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 6 : 5;
  const target = size === 4 ? 8 : size === 5 ? 12 : 18, rng = _rng(seed);
  const graph = Array.from({ length: size * size }, (_, cell) => neighbors(cell, size));
  let solution;
  // Each attempt has a strict node budget, and a known legal route is the fallback.
  for (let attempt = 0; attempt < 8 && !solution; attempt++) {
    const path = [Math.floor(rng() * size * size)], used = new Set(path);
    let remaining = 1500;
    function extend() {
      if (--remaining < 0) return false;
      if (path.length === target) return true;
      const choices = _shuffle(graph[path.at(-1)].filter(cell => !used.has(cell)), rng);
      choices.sort((a, b) => graph[a].filter(cell => !used.has(cell)).length - graph[b].filter(cell => !used.has(cell)).length);
      for (const cell of choices) {
        path.push(cell); used.add(cell);
        if (extend()) return true;
        used.delete(path.pop());
        if (remaining < 0) break;
      }
      return false;
    }
    if (extend()) solution = [...path];
  }
  solution ??= [...FALLBACKS[size]];
  return { type: 'knighttrail', size, active: [...solution].sort((a, b) => a - b), start: solution[0], solution, seed, difficulty };
}

function validPrefix(puzzle, path) {
  return Array.isArray(puzzle?.active) && Number.isInteger(puzzle.size) && puzzle.size >= 1 && puzzle.size <= 6 &&
    puzzle.active.length > 0 && puzzle.active.length <= puzzle.size ** 2 && new Set(puzzle.active).size === puzzle.active.length &&
    Array.from(puzzle.active).every(cell => Number.isInteger(cell) && cell >= 0 && cell < puzzle.size ** 2) &&
    Array.isArray(path) && path.length > 0 && path.length <= puzzle.active.length && path[0] === puzzle.start &&
    new Set(path).size === path.length && path.every((cell, index) => puzzle.active.includes(cell) && (!index || isKnightMove(path[index - 1], cell, puzzle.size)));
}

export function checkSolution(puzzle, answer) {
  return validPrefix(puzzle, answer) && answer.length === puzzle.active.length;
}

// A null result means no continuation was found within the budget, not proof of impossibility.
export function findContinuation(puzzle, prefix, nodeBudget = 10000) {
  if (!validPrefix(puzzle, prefix) || !Number.isFinite(nodeBudget) || nodeBudget < 1) return null;
  if (prefix.every((cell, index) => cell === puzzle.solution?.[index]) && checkSolution(puzzle, puzzle.solution)) return [...puzzle.solution];
  const path = [...prefix], used = new Set(path), active = new Set(puzzle.active);
  const graph = new Map(puzzle.active.map(cell => [cell, neighbors(cell, puzzle.size).filter(next => active.has(next))]));
  let remaining = Math.min(10000, Math.floor(nodeBudget));
  function extend() {
    if (--remaining < 0) return false;
    if (path.length === active.size) return true;
    const choices = graph.get(path.at(-1)).filter(cell => !used.has(cell));
    choices.sort((a, b) => graph.get(a).filter(cell => !used.has(cell)).length - graph.get(b).filter(cell => !used.has(cell)).length);
    for (const cell of choices) {
      path.push(cell); used.add(cell);
      if (extend()) return true;
      used.delete(path.pop());
      if (remaining < 0) break;
    }
    return false;
  }
  return extend() ? [...path] : null;
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size, active = new Set(puzzle.active);
  const ui = _shell(container, 'Visit every bright square exactly once, starting at S. Move like a chess knight: two squares in one direction and one across. Tap an earlier step to rewind. Arrow keys move focus; Enter selects; Backspace undoes.', n);
  ui.board.setAttribute('aria-label', 'Knight Trail board');
  let path = [puzzle.start], moves = 0, hints = 0, won = false, destroyed = false;
  const buttons = Array.from({ length: n * n }, (_, cell) => {
    const b = _el('button', { type: 'button', class: 'cell lg-cell' });
    b.disabled = !active.has(cell);
    ui.listen(b, 'click', () => visit(cell));
    ui.board.append(b); return b;
  });
  ui.listen(ui.board, 'keydown', event => {
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); undo(); return; }
    const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const cell = buttons.indexOf(document.activeElement);
    if (cell < 0) return;
    let row = Math.floor(cell / n), column = cell % n;
    for (;;) {
      row += direction[0]; column += direction[1];
      if (row < 0 || row >= n || column < 0 || column >= n) break;
      if (active.has(row * n + column)) { buttons[row * n + column].focus(); break; }
    }
  });
  function visit(cell) {
    if (destroyed || won || !active.has(cell)) return;
    const at = path.indexOf(cell);
    if (at === path.length - 1) return;
    if (at >= 0) { path = path.slice(0, at + 1); moves++; ui.say('Path rewound to the selected step.'); render(); return; }
    if (!isKnightMove(path.at(-1), cell, n)) { ui.say('A knight moves two squares along a row or column, then one across. Choose a highlighted destination.'); return; }
    path.push(cell); moves++; ui.say(''); render();
  }
  function undo() { if (destroyed || won || path.length === 1) return; path.pop(); moves++; ui.say('Last jump removed.'); render(); }
  function render() {
    const current = path.at(-1), legal = puzzle.active.filter(cell => !path.includes(cell) && isKnightMove(current, cell, n));
    buttons.forEach((b, cell) => {
      const index = path.indexOf(cell), available = active.has(cell), next = legal.includes(cell);
      b.textContent = !available ? '' : cell === current ? '♞' : index >= 0 ? String(index + 1) : '·';
      b.style.background = !available ? '#e7e9ef' : cell === current ? '#7561d5' : index >= 0 ? '#e6dffc' : '#ffffff';
      b.style.color = cell === current ? '#ffffff' : '#55459b';
      b.style.borderColor = next ? '#8b78ee' : '#dce1eb'; b.style.borderWidth = next ? '3px' : '1px';
      b.style.opacity = available ? '1' : '.45';
      b.setAttribute('aria-pressed', String(index >= 0));
      b.setAttribute('aria-label', `Row ${Math.floor(cell / n) + 1}, column ${cell % n + 1}: ${!available ? 'blocked' : index >= 0 ? `step ${index + 1}${cell === current ? ', knight here' : ''}${cell === puzzle.start ? ', start' : ''}` : next ? 'available knight move' : 'unvisited'}`);
      if (cell === puzzle.start) b.append(_el('span', { style: 'position:absolute;top:4px;left:5px;font-size:10px', 'aria-hidden': 'true' }, ['S']));
    });
    ui.stats([`${path.length} / ${puzzle.active.length} squares`, `${legal.length} next moves`, `${moves} moves`]);
    onProgress({ moves, accuracy: 100 });
    if (checkSolution(puzzle, path) && !won) { won = true; ui.say('Every bright square visited. A perfect knight trail.', true); onComplete({ score: _score(puzzle.active.length, moves, hints), moves, accuracy: 100 }); }
    else if (!legal.length) ui.say('No unvisited knight moves from here. Undo a jump or tap an earlier step to try another route.');
  }
  _button(ui, 'Undo jump', undo);
  _button(ui, 'Restart trail', () => { if (won || destroyed) return; path = [puzzle.start]; moves++; ui.say('Back at the starting square.'); render(); });
  render();
  return { destroy() { destroyed = true; ui.dispose(); }, hint() {
    if (won || destroyed) return;
    const route = findContinuation(puzzle, path);
    if (route) { path.push(route[path.length]); ui.say('One possible next jump on a complete route. Other routes may also work.'); }
    else {
      let common = 0; while (common < path.length && path[common] === puzzle.solution[common]) common++;
      path = puzzle.solution.slice(0, Math.min(puzzle.solution.length, common + 1));
      ui.say('No continuation found within the hint search limit. Rewound to a known complete route and added one jump.');
    }
    hints++; moves++; render();
  } };
}
