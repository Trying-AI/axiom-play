import {randomSource, shuffled, element, button, level, sessionUI, wireGridNavigation} from './memory-common.js';

export function createPuzzle(seed, difficulty = 'medium') {
  const settings = {easy: [4, 4, 4000], medium: [5, 6, 5000], hard: [6, 9, 6000]}[level(difficulty)];
  const [size, count, memorizeMs] = settings;
  const pattern = shuffled(Array.from({length: size * size}, (_, i) => i), randomSource(seed)).slice(0, count).sort((a, b) => a - b);
  return {kind: 'mindsnap', size, count, memorizeMs, pattern, solution: [...pattern]};
}

export function checkSolution(puzzle, answer) {
  if (!Array.isArray(answer) || answer.length !== puzzle.pattern.length || new Set(answer).size !== answer.length) return false;
  return answer.every(value => Number.isInteger(value) && puzzle.pattern.includes(value));
}

export function mount(container, options = {}) {
  const {seed = 1, difficulty = 'medium'} = options;
  const ui = sessionUI(container, options, 'Mind Snap', 'Memorize the glowing tiles, then select the same positions. Use arrow keys to move and Space to select. Five rounds; each begins when you are ready.');
  let round = 0, correct = 0, moves = 0, state = 'ready', puzzle, cells, chosen;

  function renderRound() {
    if (ui.destroyed) return;
    ui.clearClock();
    ui.waiting();
    state = 'ready';
    chosen = new Set();
    puzzle = createPuzzle((seed + round * 1013) >>> 0, difficulty);
    ui.progress(round, correct, moves);
    ui.phase.textContent = 'Ready';
    ui.feedback.textContent = `Remember ${puzzle.count} tiles on a ${puzzle.size} × ${puzzle.size} board.`;
    const grid = element('div', {className: 'mem-grid', 'aria-label': 'Memory grid'});
    grid.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;
    cells = Array.from({length: puzzle.size * puzzle.size}, (_, index) => {
      const cell = element('button', {type: 'button', className: 'cell mem-cell', 'aria-label': `Row ${Math.floor(index / puzzle.size) + 1}, column ${index % puzzle.size + 1}`, 'aria-pressed': 'false', disabled: true, onClick: () => toggle(index)}, '·');
      grid.append(cell);
      return cell;
    });
    wireGridNavigation(grid, cells, puzzle.size);
    ui.board.replaceChildren(grid);
    ui.controls.replaceChildren(button('Start memorization', memorize));
  }

  function toggle(index) {
    if (state !== 'recall') return;
    if (chosen.has(index)) chosen.delete(index);
    else if (chosen.size < puzzle.count) chosen.add(index);
    else {ui.feedback.textContent = `You have selected ${puzzle.count} tiles. Deselect a tile to change your answer.`; return;}
    moves++;
    cells[index].classList.toggle('selected', chosen.has(index));
    cells[index].classList.toggle('lit', chosen.has(index));
    cells[index].setAttribute('aria-pressed', String(chosen.has(index)));
    ui.feedback.textContent = `${chosen.size} of ${puzzle.count} tiles selected.`;
  }

  function showPattern(visible) {
    cells.forEach((cell, index) => {
      cell.classList.toggle('lit', visible && puzzle.pattern.includes(index));
      cell.textContent = visible && puzzle.pattern.includes(index) ? '◆' : '·';
    });
  }

  function memorize() {
    if (state !== 'ready') return;
    state = 'memorize';
    ui.feedback.textContent = 'Take a mental picture of the highlighted positions.';
    ui.controls.replaceChildren();
    showPattern(true);
    ui.countdown(puzzle.memorizeMs, remaining => {ui.phase.textContent = `Memorize · ${Math.ceil(remaining / 1000)}s`;}, () => {
      state = 'recall';
      showPattern(false);
      cells.forEach(cell => {cell.disabled = false;});
      ui.phase.textContent = 'Recall';
      ui.feedback.textContent = `Select the ${puzzle.count} remembered tiles.`;
      ui.controls.replaceChildren(button('Check pattern', submit));
      cells[0].focus();
    }, paused => showPattern(!paused));
  }

  function submit() {
    if (state !== 'recall') return;
    if (chosen.size !== puzzle.count) {ui.feedback.textContent = `Select exactly ${puzzle.count} tiles before checking.`; return;}
    state = 'review';
    const success = checkSolution(puzzle, [...chosen]);
    if (success) correct++;
    cells.forEach((cell, index) => {
      const target = puzzle.pattern.includes(index);
      cell.disabled = true;
      cell.classList.toggle('lit', target);
      cell.classList.toggle('missed', target && !chosen.has(index));
      cell.classList.toggle('wrong', !target && chosen.has(index));
      cell.textContent = target ? '◆' : chosen.has(index) ? '×' : '·';
    });
    ui.phase.textContent = success ? 'Correct' : 'Review';
    ui.feedback.textContent = success ? 'Perfect recall. Every tile is in the right place.' : 'Purple tiles show the correct pattern. Dashed tiles were missed; × marks an extra selection.';
    ui.progress(round, correct, moves);
    ui.controls.replaceChildren(button(round === 4 ? 'Finish session' : 'Next round', () => {
      round++;
      if (round === 5) ui.finish(correct, moves);
      else renderRound();
    }));
  }

  renderRound();
  return {destroy: () => ui.destroy(), hint() {ui.feedback.textContent = state === 'recall' ? 'Group remembered tiles into small shapes or rows. Select the positions you are most certain of first.' : 'Look for clusters and empty spaces. A visual shape is easier to remember than separate coordinates.';}};
}
