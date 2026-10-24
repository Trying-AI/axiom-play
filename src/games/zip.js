import { _rng, _el, _shell, _button, _score } from './queens.js';

const adjacent = (a, b, n) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n) === 1;
export function createPuzzle(seed = 1, difficulty = 'medium') {
  const n = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 6 : 5, rng = _rng(seed);
  let path = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - c - 1 : c));
  // Backbite moves preserve one Hamiltonian path while creating varied turns.
  for (let step = 0; step < n * n * 18; step++) {
    const head = rng() < .5, end = head ? path[0] : path[path.length - 1];
    const choices = path.map((v, i) => ({ v, i })).filter(({ v, i }) => adjacent(v, end, n) && (head ? i > 1 : i < path.length - 2));
    if (!choices.length) continue;
    const at = choices[Math.floor(rng() * choices.length)].i;
    path = head ? [...path.slice(0, at).reverse(), ...path.slice(at)] : [...path.slice(0, at + 1), ...path.slice(at + 1).reverse()];
  }
  const count = difficulty === 'easy' ? 6 : difficulty === 'hard' ? 7 : 7;
  const checkpoints = Array.from({ length: count }, (_, i) => ({ cell: path[Math.round(i * (n * n - 1) / (count - 1))], number: i + 1 }));
  return { type: 'zip', size: n, checkpoints, solution: path, seed, difficulty };
}
export function checkSolution(puzzle, answer) {
  const total = puzzle.size ** 2;
  if (!Array.isArray(answer) || answer.length !== total || answer.some(i => !Number.isInteger(i) || i < 0 || i >= total) || new Set(answer).size !== total) return false;
  if (answer[0] !== puzzle.checkpoints[0].cell || answer[total - 1] !== puzzle.checkpoints.at(-1).cell || answer.some((cell, i) => i && !adjacent(cell, answer[i - 1], puzzle.size))) return false;
  const order = answer.filter(i => puzzle.checkpoints.some(p => p.cell === i));
  return order.every((cell, i) => cell === puzzle.checkpoints[i].cell);
}
export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size, clues = new Map(puzzle.checkpoints.map(p => [p.cell, p.number]));
  const ui = _shell(container, `Draw one unbroken path from 1 through every numbered checkpoint in order. Visit every square exactly once, finishing at ${puzzle.checkpoints.length}. Click or drag through neighboring squares. Click an earlier path square to rewind. Arrow keys extend; Backspace undoes.`, n);
  ui.board.style.gap = '5px'; ui.board.style.touchAction = 'none';
  let path = [puzzle.checkpoints[0].cell], moves = 0, hints = 0, won = false, dragging = false;
  const buttons = Array.from({ length: n * n }, (_, i) => {
    const b = _el('button', { type: 'button', class: 'cell lg-cell', 'data-cell': i, 'aria-label': `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}${clues.has(i) ? `, checkpoint ${clues.get(i)}` : ''}`, style: 'z-index:1;background:transparent' });
    ui.listen(b, 'pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); b.focus({ preventScroll: true }); dragging = true; visit(i); });
    ui.listen(b, 'pointerenter', () => { if (dragging) visit(i); });
    ui.listen(b, 'click', event => { if (event.detail === 0) visit(i); });
    ui.board.append(b); return b;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${n * 100} ${n * 100}`); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#8b78ee'); line.setAttribute('stroke-width', '19'); line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('stroke-linecap', 'round'); svg.append(line); ui.board.append(svg);
  ui.listen(window, 'pointerup', () => { dragging = false; }); ui.listen(window, 'pointercancel', () => { dragging = false; });
  ui.listen(ui.board, 'pointermove', event => { if (!dragging || event.pointerType !== 'touch') return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]'); if (target && ui.board.contains(target)) visit(Number(target.dataset.cell)); });
  ui.listen(ui.board, 'keydown', event => {
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); undo(); return; }
    const delta = { ArrowUp: -n, ArrowRight: 1, ArrowDown: n, ArrowLeft: -1 }[event.key];
    if (delta !== undefined) { event.preventDefault(); const next = path.at(-1) + delta; if (next >= 0 && next < n * n && adjacent(path.at(-1), next, n)) { visit(next); buttons[next].focus({ preventScroll: true }); } }
  });
  function visit(cell) {
    if (won) return;
    const existing = path.indexOf(cell);
    if (existing === path.length - 1) return;
    if (existing >= 0) { path = path.slice(0, existing + 1); moves++; ui.say('Path rewound.'); render(); return; }
    if (!adjacent(cell, path.at(-1), n)) { ui.say('Move to a horizontally or vertically adjacent square.'); return; }
    const expected = path.filter(i => clues.has(i)).length + 1;
    if (clues.has(cell) && clues.get(cell) !== expected) { ui.say(`Reach checkpoint ${expected} first.`); return; }
    if (clues.get(cell) === puzzle.checkpoints.length && path.length !== n * n - 1) { ui.say('Cover every other square before the final checkpoint.'); return; }
    path.push(cell); moves++; ui.say(''); render();
  }
  function undo() { if (won || path.length <= 1) return; path.pop(); moves++; ui.say('Last step removed.'); render(); }
  function render() {
    buttons.forEach((b, i) => {
      const active = path.includes(i), number = clues.get(i);
      b.style.background = active ? '#a78bfa18' : '#f7f8fc'; b.style.borderColor = i === path.at(-1) ? '#8e7bd6' : '#dce1eb';
      b.replaceChildren(...(number ? [_el('span', { style: `display:grid;place-items:center;min-width:28px;aspect-ratio:1;border-radius:8px;font-size:15px;background:${active ? '#7561d5' : '#eeecff'};color:${active ? '#ffffff' : '#56469a'};box-shadow:0 0 0 4px #ffffff;position:relative;z-index:2`, 'aria-hidden': 'true' }, [String(number)])] : []));
      b.setAttribute('aria-pressed', String(active));
    });
    // Coordinates account for grid gaps and keep the path aligned at every size.
    line.setAttribute('points', path.map(i => `${(i % n + .5) * 100},${(Math.floor(i / n) + .5) * 100}`).join(' '));
    ui.stats([`${path.length} / ${n * n} squares`, `Checkpoint ${path.filter(i => clues.has(i)).length} / ${puzzle.checkpoints.length}`, `${moves} moves`]);
    onProgress({ moves, accuracy: 100 });
    if (!won && checkSolution(puzzle, path)) { won = true; ui.say('All checkpoints connected. Every square, exactly once.', true); onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 }); }
  }
  _button(ui, 'Undo step', undo);
  _button(ui, 'Restart path', () => { if (won) return; path = [puzzle.checkpoints[0].cell]; moves++; ui.say('Back to checkpoint 1.'); render(); });
  render();
  return { destroy() { dragging = false; ui.dispose(); }, hint() {
    if (won) return; let common = 0; while (common < path.length && path[common] === puzzle.solution[common]) common++;
    const end = Math.min(n * n, common === path.length ? path.length + 1 : common + 1); path = puzzle.solution.slice(0, end); hints++; moves++; ui.say('One step along a complete route. A diverging route is rewound to that point.'); render();
  } };
}
