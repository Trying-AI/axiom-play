import { _rng, _shuffle, _el, _shell, _button, _score } from './queens.js';

function validLine(line) { return line.filter(v => v === 1).length === line.length / 2 && line.every((v, i) => i < 2 || v !== line[i - 1] || v !== line[i - 2]); }
export function createPuzzle(seed = 1, difficulty = 'medium') {
  const n = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 8 : 6, rng = _rng(seed);
  const rows = [];
  for (let mask = 0; mask < 2 ** n; mask++) { const row = Array.from({ length: n }, (_, c) => (mask >> c) & 1); if (validLine(row)) rows.push(row); }
  let board = [], attempts = 0;
  function search() {
    if (board.length === n) return true;
    if (++attempts > 20000) return false;
    for (const row of _shuffle(rows, rng)) {
      const r = board.length;
      if (row.some((v, c) => { const count = board.reduce((sum, a) => sum + a[c], 0) + v; return count > n / 2 || count + n - r - 1 < n / 2 || (r >= 2 && board[r - 1][c] === v && board[r - 2][c] === v); })) continue;
      board.push(row); if (search()) return true; board.pop();
    }
    return false;
  }
  if (!search()) board = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) % 2));
  const solution = board.flat(), givens = Array(n * n).fill(-1);
  const fraction = difficulty === 'easy' ? .5 : difficulty === 'hard' ? .26 : .37;
  _shuffle(solution.map((_, i) => i), rng).slice(0, Math.ceil(n * n * fraction)).forEach(i => { givens[i] = solution[i]; });
  const pairs = [];
  for (let i = 0; i < n * n; i++) { if (i % n < n - 1) pairs.push([i, i + 1]); if (i + n < n * n) pairs.push([i, i + n]); }
  const relations = _shuffle(pairs, rng).slice(0, Math.floor(n * n / 5)).map(([a, b]) => ({ a, b, same: solution[a] === solution[b] }));
  return { type: 'tango', size: n, givens, relations, solution, seed, difficulty };
}
export function checkSolution(puzzle, answer) {
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || answer.some(v => v !== 0 && v !== 1)) return false;
  if (puzzle.givens.some((v, i) => v !== -1 && answer[i] !== v)) return false;
  for (let r = 0; r < n; r++) if (!validLine(answer.slice(r * n, r * n + n)) || !validLine(Array.from({ length: n }, (_, c) => answer[c * n + r]))) return false;
  return puzzle.relations.every(({ a, b, same }) => (answer[a] === answer[b]) === same);
}
export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, `Balance each row and column with ${n / 2} suns and ${n / 2} moons. Never place three identical symbols consecutively. “=” neighbors must match; “×” neighbors must differ. Click empty → sun → moon → empty. Dotted tiles are fixed clues.`, n);
  ui.board.style.gap = '12px';
  let state = [...puzzle.givens], moves = 0, hints = 0, won = false;
  const buttons = state.map((_, i) => {
    const b = _el('button', { type: 'button', class: `cell lg-cell${puzzle.givens[i] !== -1 ? ' given lg-given' : ''}` });
    if (puzzle.givens[i] !== -1) b.style.borderStyle = 'dashed';
    ui.listen(b, 'click', () => { if (won || puzzle.givens[i] !== -1) return; state[i] = state[i] === -1 ? 1 : state[i] === 1 ? 0 : -1; moves++; ui.say(''); render(); });
    ui.board.append(b); return b;
  });
  function render() {
    buttons.forEach((b, i) => {
      b.replaceChildren(_el('span', { 'aria-hidden': 'true', style: `font-size:clamp(19px,5vw,32px);color:${state[i] === 1 ? '#cf8a08' : '#655bd3'}` }, [state[i] === 1 ? '☀' : state[i] === 0 ? '☾' : '']));
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}: ${state[i] === 1 ? 'sun' : state[i] === 0 ? 'moon' : 'empty'}${puzzle.givens[i] !== -1 ? ', fixed clue' : ''}`);
      b.setAttribute('aria-disabled', String(won || puzzle.givens[i] !== -1));
    });
    puzzle.relations.forEach(({ a, b, same }) => { const horizontal = b === a + 1; const mark = _el('span', { style: `position:absolute;${horizontal ? 'right:-10px;top:50%;transform:translateY(-50%)' : 'bottom:-11px;left:50%;transform:translateX(-50%)'};font-size:12px;z-index:2;color:#7667bd;pointer-events:none`, 'aria-hidden': 'true' }, [same ? '=' : '×']); buttons[a].append(mark); buttons[a].setAttribute('aria-label', `${buttons[a].getAttribute('aria-label')}; ${same ? 'matches' : 'differs from'} cell ${b + 1}`); });
    const filled = state.filter(v => v !== -1).length;
    ui.stats([`${filled} / ${n * n} tiles`, `${moves} moves`, 'Balance + adjacency']);
    onProgress({ moves, accuracy: 100 });
    if (!won && checkSolution(puzzle, state)) { won = true; ui.say('A perfect balance. All rows, columns and relationships work.', true); onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 }); }
    else if (filled === n * n) ui.say('The board is full. Check the balance, triples and relationship symbols.');
  }
  _button(ui, 'Clear entries', () => { if (won) return; state = [...puzzle.givens]; moves++; ui.say('Your entries have been cleared.'); render(); });
  render();
  return { destroy() { ui.dispose(); }, hint() { if (won) return; const i = state.findIndex((v, i) => v !== puzzle.solution[i]); if (i < 0) return; state[i] = puzzle.solution[i]; moves++; hints++; ui.say(`Row ${Math.floor(i / n) + 1}, column ${i % n + 1} can be ${state[i] ? 'a sun' : 'a moon'} in a valid solution.`); render(); } };
}
