import { _rng, _shuffle, _el, _shell, _button, _score } from './queens.js';

// Edge arrays are always indexed by screen coordinates: top/bottom by column,
// left/right by row. A zero means the edge has no clue.
export function visibleTowers(line) {
  let highest = 0, visible = 0;
  for (const height of line) if (height > highest) { highest = height; visible++; }
  return visible;
}

export function edgeClues(answer, size) {
  const top = [], right = [], bottom = [], left = [];
  for (let i = 0; i < size; i++) {
    const row = answer.slice(i * size, (i + 1) * size);
    const column = Array.from({ length: size }, (_, j) => answer[j * size + i]);
    left.push(visibleTowers(row)); right.push(visibleTowers([...row].reverse()));
    top.push(visibleTowers(column)); bottom.push(visibleTowers([...column].reverse()));
  }
  return { top, right, bottom, left };
}

const permutationCache = new Map();
function permutations(size) {
  if (!permutationCache.has(size)) {
    const result = [];
    function visit(row, mask) {
      if (row.length === size) { result.push({ values: row, left: visibleTowers(row), right: visibleTowers([...row].reverse()) }); return; }
      for (let value = 1; value <= size; value++) if (!(mask & (1 << value))) visit([...row, value], mask | (1 << value));
    }
    visit([], 0); permutationCache.set(size, result);
  }
  return permutationCache.get(size);
}

function validPuzzle(puzzle) {
  const n = puzzle?.size;
  return (n === 4 || n === 5) && Array.isArray(puzzle.givens) && puzzle.givens.length === n * n &&
    Array.from(puzzle.givens).every(value => Number.isInteger(value) && value >= 0 && value <= n) &&
    ['top', 'right', 'bottom', 'left'].every(side => Array.isArray(puzzle.clues?.[side]) && puzzle.clues[side].length === n &&
      Array.from(puzzle.clues[side]).every(value => Number.isInteger(value) && value >= 0 && value <= n));
}

// A result of -1 means the work cap was reached; it must never be treated as a
// uniqueness proof. Counting stops at limit, normally two, for ambiguity checks.
export function countSolutions(puzzle, limit = 2, maxWork = 25000) {
  if (!validPuzzle(puzzle)) return 0;
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(maxWork) || maxWork < 1) return -1;
  const n = puzzle.size, masks = Array(n).fill(0), rows = [], candidates = [];
  for (let row = 0; row < n; row++) {
    candidates.push(permutations(n).filter(candidate =>
      (!puzzle.clues.left[row] || candidate.left === puzzle.clues.left[row]) &&
      (!puzzle.clues.right[row] || candidate.right === puzzle.clues.right[row]) &&
      candidate.values.every((value, col) => !puzzle.givens[row * n + col] || puzzle.givens[row * n + col] === value)));
    if (!candidates[row].length) return 0;
  }
  let count = 0, work = 0, capped = false;
  function search(row) {
    for (const candidate of candidates[row]) {
      if (++work > maxWork) { capped = true; return; }
      if (candidate.values.some((value, col) => masks[col] & (1 << value))) continue;
      rows[row] = candidate.values;
      let valid = true;
      for (let col = 0; col < n && valid; col++) {
        const prefix = Array.from({ length: row + 1 }, (_, r) => rows[r][col]);
        const clue = puzzle.clues.top[col], seen = visibleTowers(prefix);
        if (clue && (seen > clue || seen + Math.min(n - Math.max(...prefix), n - row - 1) < clue)) valid = false;
        if (row === n - 1 && ((clue && seen !== clue) || (puzzle.clues.bottom[col] && visibleTowers([...prefix].reverse()) !== puzzle.clues.bottom[col]))) valid = false;
      }
      if (!valid) continue;
      if (row === n - 1) count++;
      else {
        candidate.values.forEach((value, col) => { masks[col] |= 1 << value; });
        search(row + 1);
        candidate.values.forEach((value, col) => { masks[col] ^= 1 << value; });
      }
      if (count >= limit || capped) return;
    }
  }
  search(0);
  return capped ? -1 : count;
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  difficulty = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium';
  const size = difficulty === 'easy' ? 4 : 5, random = _rng(seed);
  const digits = _shuffle(Array.from({ length: size }, (_, i) => i + 1), random);
  const rows = _shuffle(Array.from({ length: size }, (_, i) => i), random);
  const columns = _shuffle(Array.from({ length: size }, (_, i) => i), random);
  const solution = rows.flatMap(row => columns.map(col => digits[(row + col) % size]));
  const puzzle = { type: 'skyscrapers', size, seed, difficulty, solution, givens: Array(size * size).fill(0), clues: edgeClues(solution, size) };
  const order = _shuffle(Array.from({ length: size * size }, (_, i) => i), random);
  let next = 0;
  const startingGivens = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 1 : 0;
  for (; next < startingGivens; next++) puzzle.givens[order[next]] = solution[order[next]];
  // At most size² bounded solver calls. Full givens are always a safe fallback.
  while (countSolutions(puzzle) !== 1 && next < order.length) {
    const index = order[next++]; puzzle.givens[index] = solution[index];
  }
  const desiredRemoved = difficulty === 'hard' ? 6 : difficulty === 'medium' ? 2 : 0;
  const edges = _shuffle(['top', 'right', 'bottom', 'left'].flatMap(side => Array.from({ length: size }, (_, index) => [side, index])), random);
  let removed = 0;
  for (const [side, index] of edges) {
    if (removed >= desiredRemoved) break;
    const old = puzzle.clues[side][index]; puzzle.clues[side][index] = 0;
    if (countSolutions(puzzle) === 1) removed++;
    else puzzle.clues[side][index] = old;
  }
  return puzzle;
}

export function checkSolution(puzzle, answer) {
  if (!validPuzzle(puzzle)) return false;
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || !Array.from(answer).every((value, index) => Number.isInteger(value) && value >= 1 && value <= n && (!puzzle.givens[index] || puzzle.givens[index] === value))) return false;
  for (let i = 0; i < n; i++) {
    if (new Set(answer.slice(i * n, (i + 1) * n)).size !== n || new Set(Array.from({ length: n }, (_, r) => answer[r * n + i])).size !== n) return false;
  }
  const actual = edgeClues(answer, n);
  return ['top', 'right', 'bottom', 'left'].every(side => puzzle.clues[side].every((clue, i) => !clue || clue === actual[side][i]));
}

function conflicts(answer, n) {
  const errors = new Set();
  for (let i = 0; i < n; i++) for (const line of [Array.from({ length: n }, (_, j) => i * n + j), Array.from({ length: n }, (_, j) => j * n + i)]) {
    for (const a of line) if (answer[a] && line.some(b => b !== a && answer[b] === answer[a])) errors.add(a);
  }
  return errors;
}

function styles() {
  if (document.getElementById('axiom-skyscrapers-styles')) return;
  const style = _el('style', { id: 'axiom-skyscrapers-styles' });
  style.textContent = `.ss-board{grid-template-columns:26px repeat(var(--ss-n),minmax(0,1fr)) 26px!important;gap:4px!important;width:min(100%,480px)!important;align-items:center}.ss-board .ss-clue{display:grid;place-content:center;align-self:stretch;min-height:24px;font-size:clamp(12px,3vw,17px);font-weight:700;color:#605394}.ss-board .ss-clue.ss-bad{color:#b53950;background:#fff0f3;border-radius:5px}.ss-board .ss-clue.ss-good{color:#21795a}.ss-board .ss-cell{padding:0}.ss-board .ss-cell.ss-selected{background:#e9e4ff;box-shadow:inset 0 0 0 2px #9180d3}.ss-board .ss-cell.lg-error{background:#fff0f3;color:#b53950;box-shadow:inset 0 0 0 2px #d88ca0}.ss-board .ss-cell.lg-given{color:#364158;background:#eef0f5}.ss-pad{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.ss-pad button{min-width:42px;min-height:42px;padding:8px;border:1px solid #dce1eb;border-radius:8px;background:#f5f3fc;color:#51458f;font:inherit;font-size:18px;font-weight:600;cursor:pointer}.ss-pad button:focus-visible{outline:3px solid #b2a4ff;outline-offset:2px}@media(max-width:420px){.ss-board{grid-template-columns:20px repeat(var(--ss-n),minmax(0,1fr)) 20px!important;gap:3px!important}}`;
  document.head.append(style);
}

export function mount(container, { seed = 1, difficulty = 'medium', onProgress = () => {}, onComplete = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, `Place heights 1–${n} once in every row and column. An edge clue counts towers visible from that side: taller towers hide shorter ones behind them. Dashes have no clue. Every puzzle has one solution.`, n + 2);
  styles(); ui.board.classList.add('ss-board'); ui.board.style.setProperty('--ss-n', n);
  ui.board.setAttribute('aria-label', `${n} by ${n} Skyscrapers puzzle with clues on all four edges`);
  const answer = [...puzzle.givens], buttons = [], clueNodes = [];
  let selected = answer.findIndex(value => !value), moves = 0, hints = 0, won = false, destroyed = false;
  function clue(side, index) {
    const value = puzzle.clues[side][index];
    const node = _el('span', { class: 'ss-clue', 'aria-label': `${side} ${side === 'top' || side === 'bottom' ? 'column' : 'row'} ${index + 1}: ${value ? `${value} visible towers` : 'no clue'}` }, [value ? String(value) : '–']);
    clueNodes.push({ node, side, index, value }); return node;
  }
  for (let row = -1; row <= n; row++) for (let col = -1; col <= n; col++) {
    if ((row === -1 || row === n) && (col === -1 || col === n)) { ui.board.append(_el('span', { 'aria-hidden': 'true' })); continue; }
    if (row === -1 || row === n) { ui.board.append(clue(row === -1 ? 'top' : 'bottom', col)); continue; }
    if (col === -1 || col === n) { ui.board.append(clue(col === -1 ? 'left' : 'right', row)); continue; }
    const index = row * n + col;
    const button = _el('button', { type: 'button', class: 'cell lg-cell ss-cell' });
    ui.listen(button, 'click', () => { if (destroyed) return; selected = index; render(); button.focus({ preventScroll: true }); });
    ui.listen(button, 'focus', () => { if (!destroyed && selected !== index) { selected = index; render(); } });
    buttons.push(button); ui.board.append(button);
  }
  const pad = _el('div', { class: 'ss-pad', role: 'group', 'aria-label': 'Number keypad' });
  ui.stage.insertBefore(pad, ui.controls);
  for (let value = 1; value <= n; value++) {
    const button = _el('button', { type: 'button', 'aria-label': `Enter ${value}` }, [String(value)]);
    ui.listen(button, 'click', () => enter(value)); pad.append(button);
  }
  const erase = _button(ui, 'Erase', () => enter(0));
  const clear = _button(ui, 'Reset board', () => {
    if (won || destroyed) return;
    answer.splice(0, answer.length, ...puzzle.givens); moves++;
    ui.say('Board reset. Given towers are preserved.'); render();
  });
  function render() {
    if (destroyed) return;
    const errors = conflicts(answer, n), filled = answer.filter(Boolean).length;
    buttons.forEach((button, index) => {
      button.textContent = answer[index] ? String(answer[index]) : '';
      button.classList.toggle('lg-given', Boolean(puzzle.givens[index]));
      button.classList.toggle('ss-selected', selected === index);
      button.classList.toggle('lg-error', errors.has(index));
      button.tabIndex = selected === index ? 0 : -1;
      button.setAttribute('aria-pressed', String(selected === index));
      button.setAttribute('aria-label', `Row ${Math.floor(index / n) + 1}, column ${index % n + 1}: ${answer[index] || 'empty'}${puzzle.givens[index] ? ', given' : ''}${errors.has(index) ? ', repeated height' : ''}`);
    });
    for (const { node, side, index, value } of clueNodes) {
      const line = side === 'left' || side === 'right' ? answer.slice(index * n, (index + 1) * n) : Array.from({ length: n }, (_, row) => answer[row * n + index]);
      if (side === 'right' || side === 'bottom') line.reverse();
      const complete = line.every(Boolean), seen = visibleTowers(line), matches = seen === value;
      node.classList.toggle('ss-bad', Boolean(value && complete && !matches));
      node.classList.toggle('ss-good', Boolean(value && complete && matches));
      node.setAttribute('aria-label', `${side} ${side === 'top' || side === 'bottom' ? 'column' : 'row'} ${index + 1}: ${value ? `${value} visible towers` : 'no clue'}${value && complete ? `; current view ${seen}, ${matches ? 'matches' : 'does not match'}` : ''}`);
    }
    ui.stats([`${filled} / ${answer.length} filled`, `${moves} moves`, 'One solution']);
    onProgress({ moves, accuracy: filled ? Math.round(100 * (filled - errors.size) / filled) : 100, filled, total: answer.length });
  }
  function enter(value) {
    if (won || destroyed || selected < 0) return;
    if (puzzle.givens[selected]) { ui.say('That tower is a given. Select an empty cell to enter a height.'); buttons[selected].focus({ preventScroll: true }); return; }
    if (answer[selected] === value) return;
    answer[selected] = value; moves++; render(); buttons[selected].focus({ preventScroll: true });
    if (checkSolution(puzzle, answer)) {
      won = true; erase.disabled = clear.disabled = true;
      ui.say('Skyline solved. Every row, column and view matches.', true);
      onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 });
    } else if (conflicts(answer, n).size) ui.say('A height repeats in a row or column. Recheck the highlighted cells.');
    else if (answer.every(Boolean)) ui.say('The board is full. Recheck the red edge clues: a view does not match.');
    else ui.say(value ? 'Compare the tower heights with the views from each edge.' : 'Cell cleared.');
  }
  ui.listen(ui.stage, 'keydown', event => {
    if (won || destroyed || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[1-5]$/.test(event.key) && Number(event.key) <= n) { event.preventDefault(); enter(Number(event.key)); }
    else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); enter(0); }
    else if (event.key.startsWith('Arrow')) {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[event.key];
      if (!delta) return;
      event.preventDefault(); const next = selected + delta;
      if (next >= 0 && next < answer.length && (Math.abs(delta) === n || Math.floor(next / n) === Math.floor(selected / n))) selected = next;
      render(); buttons[selected]?.focus({ preventScroll: true });
    }
  });
  render(); ui.say('Select a cell, then use the keypad or number keys. Arrow keys move the selection.');
  return {
    destroy() { destroyed = true; ui.dispose(); },
    hint() {
      if (won || destroyed) return;
      hints++;
      let index = answer.findIndex((value, i) => value && value !== puzzle.solution[i]);
      const incorrect = index >= 0;
      if (!incorrect) index = answer[selected] ? answer.findIndex(value => !value) : selected;
      if (index < 0) return;
      selected = index; render(); buttons[index].focus({ preventScroll: true });
      const location = `Row ${Math.floor(index / n) + 1}, column ${index % n + 1}`;
      const text = incorrect ? `${location} prevents the unique solution. Try erasing that height and compare the edge views.` : `${location} needs height ${puzzle.solution[index]}. Compare its row, column and the towers visible from each edge. No value has been entered.`;
      ui.say(text); return text;
    },
  };
}
