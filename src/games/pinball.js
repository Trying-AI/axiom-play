import {randomSource, shuffled, element, button, level, sessionUI} from './memory-common.js';

const SIDES = ['top', 'right', 'bottom', 'left'];
const PREFIX = {top: 'T', right: 'R', bottom: 'B', left: 'L'};

export function reflect(direction, mirror) {
  const [dx, dy] = direction;
  if (mirror === '/') return [-dy, -dx];
  if (mirror === '\\') return [dy, dx];
  return [dx, dy];
}

export function exitLabel(exit) { return `${PREFIX[exit.side]}${exit.index + 1}`; }

export function traceBeam(grid, entry) {
  const size = grid.length;
  if (!size || grid.some(row => row.length !== size) || !SIDES.includes(entry.side) || !Number.isInteger(entry.index) || entry.index < 0 || entry.index >= size) throw new Error('Invalid pinball board or entry');
  let x = entry.side === 'left' ? -1 : entry.side === 'right' ? size : entry.index;
  let y = entry.side === 'top' ? -1 : entry.side === 'bottom' ? size : entry.index;
  let dx = entry.side === 'left' ? 1 : entry.side === 'right' ? -1 : 0;
  let dy = entry.side === 'top' ? 1 : entry.side === 'bottom' ? -1 : 0;
  const path = [], states = new Set();
  let reflections = 0;
  for (let step = 0; step < size * size * 4 + 1; step++) {
    x += dx; y += dy;
    if (x < 0) return {path, exit: {side: 'left', index: y}, reflections, loop: false};
    if (x >= size) return {path, exit: {side: 'right', index: y}, reflections, loop: false};
    if (y < 0) return {path, exit: {side: 'top', index: x}, reflections, loop: false};
    if (y >= size) return {path, exit: {side: 'bottom', index: x}, reflections, loop: false};
    const key = `${x},${y},${dx},${dy}`;
    if (states.has(key)) return {path, exit: null, reflections, loop: true};
    states.add(key);
    const incoming = [dx, dy];
    const mirror = grid[y][x];
    if (mirror === '/' || mirror === '\\') reflections++;
    [dx, dy] = reflect(incoming, mirror);
    path.push({row: y, col: x, mirror, incoming, outgoing: [dx, dy]});
  }
  return {path, exit: null, reflections, loop: true};
}

export function createPuzzle(seed, difficulty = 'medium') {
  const [size, bumperCount, memorizeMs] = {easy: [4, 3, 6500], medium: [5, 6, 8500], hard: [6, 9, 11000]}[level(difficulty)];
  const random = randomSource(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = Array.from({length: size}, () => Array(size).fill(''));
    const indices = shuffled(Array.from({length: size * size}, (_, i) => i), random).slice(0, bumperCount);
    indices.forEach(index => {grid[Math.floor(index / size)][index % size] = random() < .5 ? '/' : '\\';});
    const entry = {side: SIDES[Math.floor(random() * 4)], index: Math.floor(random() * size)};
    const trace = traceBeam(grid, entry);
    if (trace.loop || trace.reflections < 1 || trace.path.length < size - 1) continue;
    return {kind: 'pinball', size, grid, entry, memorizeMs, trace, solution: exitLabel(trace.exit)};
  }
  // Bounded fallback guarantees a valid puzzle even if generation changes later.
  const grid = Array.from({length: size}, () => Array(size).fill(''));
  const center = Math.floor(size / 2);
  grid[center][center] = '/';
  const entry = {side: 'top', index: center};
  const trace = traceBeam(grid, entry);
  return {kind: 'pinball', size, grid, entry, memorizeMs, trace, solution: exitLabel(trace.exit)};
}

export function checkSolution(puzzle, answer) {
  if (typeof answer !== 'string') return false;
  const trace = traceBeam(puzzle.grid, puzzle.entry);
  return !trace.loop && answer.trim().toUpperCase() === exitLabel(trace.exit);
}

export function mount(container, options = {}) {
  const {seed = 1, difficulty = 'medium'} = options;
  const ui = sessionUI(container, options, 'Pinball Recall', 'Memorize the mirrors. After they disappear, trace the ball from the highlighted entry and choose its exit. A / or \\ mirror turns the ball 90°. T/R/B/L mean top, right, bottom, left.');
  let round = 0, correct = 0, moves = 0, state = 'ready', puzzle, gridCells, ports, answerInput, selected = '';

  function renderRound() {
    if (ui.destroyed) return;
    ui.clearClock();
    ui.waiting();
    state = 'ready'; selected = '';
    puzzle = createPuzzle((seed + round * 2017) >>> 0, difficulty);
    ui.progress(round, correct, moves);
    ui.phase.textContent = 'Ready';
    ui.feedback.textContent = 'Start when you are ready to memorize the mirror positions.';
    const entryLabel = exitLabel(puzzle.entry);
    const heading = element('div', {className: 'mem-subtle'}, `Entry: ${entryLabel} · the ball moves inward from this edge`);
    const grid = element('div', {className: 'pin-grid', 'aria-label': `Mirror board, entry ${entryLabel}`});
    grid.style.gridTemplateColumns = `repeat(${puzzle.size + 2},1fr)`;
    gridCells = [];
    ports = new Map();
    for (let row = -1; row <= puzzle.size; row++) {
      for (let col = -1; col <= puzzle.size; col++) {
        if ((row === -1 || row === puzzle.size) && (col === -1 || col === puzzle.size)) {grid.append(element('span')); continue;}
        if (row === -1 || row === puzzle.size || col === -1 || col === puzzle.size) {
          const side = row === -1 ? 'top' : row === puzzle.size ? 'bottom' : col === -1 ? 'left' : 'right';
          const index = side === 'top' || side === 'bottom' ? col : row;
          const label = exitLabel({side, index});
          const port = element('button', {type: 'button', className: `pin-port${label === entryLabel ? ' entry' : ''}`, disabled: true, 'aria-label': `${label}${label === entryLabel ? ', entry' : ''}`, 'aria-pressed': 'false', onClick: () => choose(label)}, label);
          ports.set(label, port);
          grid.append(port);
        } else {
          const cell = element('div', {className: 'pin-cell', 'aria-label': `Row ${row + 1}, column ${col + 1}`}, '·');
          gridCells.push({cell, row, col});
          grid.append(cell);
        }
      }
    }
    ui.board.replaceChildren(heading, grid);
    ui.controls.replaceChildren(button('Start memorization', memorize));
  }

  function reveal(visible, showPath = false) {
    gridCells.forEach(({cell, row, col}) => {
      cell.textContent = visible ? puzzle.grid[row][col] || '·' : '·';
      cell.classList.toggle('path', showPath && puzzle.trace.path.some(step => step.row === row && step.col === col));
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}${visible && puzzle.grid[row][col] ? `, ${puzzle.grid[row][col] === '/' ? 'forward slash' : 'backslash'} mirror` : ''}`);
    });
  }

  function choose(label) {
    if (state !== 'recall') return;
    selected = label;
    answerInput.value = label;
    ports.forEach((port, name) => {
      port.classList.toggle('answer', name === selected);
      port.setAttribute('aria-pressed', String(name === selected));
    });
    ui.feedback.textContent = `${label} selected. Check your exit when ready.`;
  }

  function memorize() {
    if (state !== 'ready') return;
    state = 'memorize';
    ui.controls.replaceChildren();
    ui.feedback.textContent = 'Remember each mirror’s position and orientation.';
    reveal(true);
    ui.countdown(puzzle.memorizeMs, remaining => {ui.phase.textContent = `Memorize · ${Math.ceil(remaining / 1000)}s`;}, () => {
      state = 'recall';
      reveal(false);
      ports.forEach(port => {port.disabled = false;});
      ui.phase.textContent = 'Predict the exit';
      ui.feedback.textContent = 'Click an edge label or type one below, for example T2.';
      answerInput = element('input', {type: 'text', maxLength: 3, placeholder: 'e.g. T2', autoComplete: 'off', spellcheck: false, 'aria-label': 'Exit label'});
      const form = element('form', {onSubmit: event => {event.preventDefault(); submit();}}, [answerInput, element('button', {type: 'submit', className: 'button'}, 'Check exit')]);
      ui.controls.replaceChildren(form);
      answerInput.focus();
    }, paused => reveal(!paused));
  }

  function submit() {
    if (state !== 'recall') return;
    const answer = answerInput.value.trim().toUpperCase();
    if (!ports.has(answer)) {ui.feedback.textContent = `Enter a board edge, such as T1 or R${puzzle.size}.`; return;}
    state = 'review';
    moves++;
    const success = checkSolution(puzzle, answer);
    if (success) correct++;
    reveal(true, true);
    ports.forEach((port, label) => {
      port.disabled = true;
      port.classList.toggle('answer', label === puzzle.solution);
      port.classList.toggle('error', label === answer && !success);
    });
    ui.phase.textContent = success ? 'Correct' : 'Review';
    ui.feedback.textContent = `${success ? 'Correct!' : `You chose ${answer}.`} The ball exits at ${puzzle.solution} after ${puzzle.trace.reflections} reflection${puzzle.trace.reflections === 1 ? '' : 's'}. The highlighted cells show its path.`;
    ui.progress(round, correct, moves);
    ui.controls.replaceChildren(button(round === 4 ? 'Finish session' : 'Next round', () => {
      round++;
      if (round === 5) ui.finish(correct, moves);
      else renderRound();
    }));
  }

  renderRound();
  return {destroy: () => ui.destroy(), hint() {ui.feedback.textContent = 'Trace one segment at a time. Moving right: / turns up and \\ turns down. Moving down: / turns left and \\ turns right. Ignore mirrors the path never touches.';}};
}
