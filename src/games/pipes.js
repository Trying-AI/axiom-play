import { _rng, _el, _shell, _button, _score } from './queens.js';

// Masks run clockwise: north=1, east=2, south=4, west=8.
export function rotate(mask) { return ((mask << 1) & 15) | (mask >> 3); }
const directions = [{ bit: 1, opposite: 4, dr: -1, dc: 0 }, { bit: 2, opposite: 8, dr: 0, dc: 1 }, { bit: 4, opposite: 1, dr: 1, dc: 0 }, { bit: 8, opposite: 2, dr: 0, dc: -1 }];
function neighbor(cell, d, n) { const r = Math.floor(cell / n) + d.dr, c = cell % n + d.dc; return r < 0 || c < 0 || r >= n || c >= n ? -1 : r * n + c; }
export function createPuzzle(seed = 1, difficulty = 'medium') {
  const n = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 6 : 5, rng = _rng(seed), solution = Array(n * n).fill(0), seen = new Set([0]), stack = [0];
  while (stack.length) {
    const cell = stack.at(-1), available = directions.map(d => ({ d, next: neighbor(cell, d, n) })).filter(({ next }) => next >= 0 && !seen.has(next));
    if (!available.length) { stack.pop(); continue; }
    const { d, next } = available[Math.floor(rng() * available.length)]; solution[cell] |= d.bit; solution[next] |= d.opposite; seen.add(next); stack.push(next);
  }
  const tiles = solution.map(mask => { for (let i = Math.floor(rng() * 4); i > 0; i--) mask = rotate(mask); return mask; });
  if (checkSolution({ size: n, solution, source: 0 }, tiles)) tiles[0] = rotate(tiles[0]);
  return { type: 'pipes', size: n, source: 0, tiles, solution, seed, difficulty };
}
function connected(puzzle, answer) {
  const seen = new Set([puzzle.source]), queue = [puzzle.source];
  for (let k = 0; k < queue.length; k++) for (const d of directions) { const cell = queue[k], next = neighbor(cell, d, puzzle.size); if ((answer[cell] & d.bit) && next >= 0 && (answer[next] & d.opposite) && !seen.has(next)) { seen.add(next); queue.push(next); } }
  return seen;
}
export function checkSolution(puzzle, answer) {
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || answer.some(v => !Number.isInteger(v) || v < 1 || v > 15)) return false;
  for (let cell = 0; cell < answer.length; cell++) {
    let match = false, mask = puzzle.solution[cell]; for (let turn = 0; turn < 4; turn++) { if (answer[cell] === mask) match = true; mask = rotate(mask); } if (!match) return false;
    for (const d of directions) if (answer[cell] & d.bit) { const next = neighbor(cell, d, n); if (next < 0 || !(answer[next] & d.opposite)) return false; }
  }
  return connected(puzzle, answer).size === n * n;
}
export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, 'Rotate the pipes into one connected network. Water starts at the gold source; every pipe must connect to it, with no open ends or leaks at the edges. Click to rotate clockwise. Shift-click or right-click rotates counterclockwise. Blue pipes currently receive water.', n);
  ui.board.style.gap = '2px';
  let state = [...puzzle.tiles], moves = 0, hints = 0, won = false, showLeaks = false;
  const buttons = state.map((_, i) => {
    const b = _el('button', { type: 'button', class: 'cell lg-cell', style: 'overflow:hidden;border-radius:6px', 'aria-label': `Pipe row ${Math.floor(i / n) + 1}, column ${i % n + 1}` });
    ui.listen(b, 'click', e => turn(i, e.shiftKey ? 3 : 1)); ui.listen(b, 'contextmenu', e => { e.preventDefault(); turn(i, 3); }); ui.board.append(b); return b;
  });
  function turn(i, count) { if (won) return; for (let k = 0; k < count; k++) state[i] = rotate(state[i]); moves++; showLeaks = false; ui.say(''); render(); }
  function render() {
    const wet = connected(puzzle, state); let leaks = 0;
    buttons.forEach((b, i) => {
      const color = wet.has(i) ? '#208ca7' : '#8b95a8', spans = [];
      const openings = [];
      directions.forEach((d, index) => {
        if (!(state[i] & d.bit)) return;
        openings.push(['north', 'east', 'south', 'west'][index]);
        const next = neighbor(i, d, n), leak = next < 0 || !(state[next] & d.opposite); if (leak) leaks++;
        spans.push(_el('span', { 'aria-hidden': 'true', style: `position:absolute;left:calc(50% - 6px);top:-1px;width:12px;height:calc(50% + 1px);border-radius:2px;background:${showLeaks && leak ? '#df5e77' : color};transform-origin:50% 100%;transform:rotate(${index * 90}deg)` }));
      });
      spans.push(_el('span', { 'aria-hidden': 'true', style: `position:absolute;width:${i === puzzle.source ? 24 : 17}px;height:${i === puzzle.source ? 24 : 17}px;border-radius:50%;background:${i === puzzle.source ? '#fbbf24' : color};${i === puzzle.source ? 'box-shadow:0 0 0 4px #fbbf2430' : ''}` }));
      b.replaceChildren(...spans); b.style.background = wet.has(i) ? '#eaf8fb' : '#f4f6fa';
      b.setAttribute('aria-label', `${i === puzzle.source ? 'Source. ' : ''}Row ${Math.floor(i / n) + 1}, column ${i % n + 1}. Openings ${openings.join(', ')}. ${wet.has(i) ? 'Connected to source' : 'Not connected'}. Rotate clockwise.`);
    });
    ui.stats([`${wet.size} / ${n * n} pipes connected`, `${leaks} open ends`, `${moves} rotations`]);
    onProgress({ moves, accuracy: Math.round(100 * wet.size / (n * n)) });
    if (!won && checkSolution(puzzle, state)) { won = true; ui.say('Water reaches every pipe. Zero leaks. Network restored.', true); onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 }); }
  }
  _button(ui, 'Highlight leaks', () => { showLeaks = true; render(); if (!won) ui.say('Rose-colored ends need a matching neighboring connection.'); });
  _button(ui, 'Reset rotations', () => { if (won) return; state = [...puzzle.tiles]; moves++; showLeaks = false; ui.say('Original scrambled board restored.'); render(); });
  render();
  return { destroy() { ui.dispose(); }, hint() { if (won) return; const i = state.findIndex((v, i) => v !== puzzle.solution[i]); if (i < 0) return; state[i] = puzzle.solution[i]; moves++; hints++; ui.say(`Pipe in row ${Math.floor(i / n) + 1}, column ${i % n + 1} has been oriented correctly.`); render(); } };
}
