import {randomSource, element, button, level, sessionUI} from './memory-common.js';

export function createPuzzle(seed, difficulty = 'medium') {
  const [count, minimum, maximum, intervalMs, subtractChance] = {easy: [5, 2, 20, 1500, 0], medium: [7, 10, 60, 1250, .2], hard: [9, 20, 150, 1100, .3]}[level(difficulty)];
  const random = randomSource(seed);
  const numbers = Array.from({length: count}, (_, index) => {
    const value = minimum + Math.floor(random() * (maximum - minimum + 1));
    return index > 0 && random() < subtractChance ? -value : value;
  });
  return {kind: 'flash', numbers, count, intervalMs, solution: numbers.reduce((sum, value) => sum + value, 0)};
}

export function checkSolution(puzzle, answer) {
  if (typeof answer === 'string' && !/^[+-]?\d+$/.test(answer.trim())) return false;
  if (typeof answer !== 'string' && typeof answer !== 'number') return false;
  const numeric = Number(answer);
  return Number.isSafeInteger(numeric) && numeric === puzzle.numbers.reduce((sum, value) => sum + value, 0);
}

export function mount(container, options = {}) {
  const {seed = 1, difficulty = 'medium'} = options;
  const ui = sessionUI(container, options, 'Flash Anzan', 'Keep a running total as numbers flash one at a time. Enter the final total after the sequence. Medium and hard include negative numbers. You control when each of the five rounds starts.');
  let round = 0, correct = 0, moves = 0, state = 'ready', puzzle, numberDisplay, sequenceCounter, input;

  function renderRound() {
    if (ui.destroyed) return;
    ui.clearClock();
    ui.waiting();
    state = 'ready';
    puzzle = createPuzzle((seed + round * 3023) >>> 0, difficulty);
    ui.progress(round, correct, moves);
    ui.phase.textContent = 'Ready';
    ui.feedback.textContent = `${puzzle.count} numbers · ${(puzzle.intervalMs / 1000).toFixed(2).replace(/0$/, '')} seconds per number including a short blank.`;
    numberDisplay = element('div', {className: 'mem-number', 'aria-label': 'Flashing number'}, 'Ready');
    sequenceCounter = element('div', {className: 'mem-subtle'}, 'Hold a running total in your head.');
    ui.board.replaceChildren(numberDisplay, sequenceCounter);
    ui.controls.replaceChildren(button('Start sequence', start));
  }

  function start() {
    if (state !== 'ready') return;
    state = 'sequence';
    ui.controls.replaceChildren();
    ui.feedback.textContent = 'Add each number to your running total. A minus sign means subtract.';
    const duration = puzzle.count * puzzle.intervalMs;
    ui.countdown(duration, remaining => {
      const elapsed = duration - remaining;
      const index = Math.min(puzzle.count - 1, Math.floor(elapsed / puzzle.intervalMs));
      const visible = elapsed % puzzle.intervalMs < puzzle.intervalMs * .8;
      const number = puzzle.numbers[index];
      numberDisplay.textContent = visible ? `${number >= 0 ? '+' : '−'}${Math.abs(number)}` : '·';
      sequenceCounter.textContent = `Number ${index + 1} of ${puzzle.count}`;
      ui.phase.textContent = 'Keep the total';
    }, () => {
      state = 'answer';
      ui.phase.textContent = 'Recall the total';
      ui.feedback.textContent = 'The sequence has finished. Enter your final total.';
      input = element('input', {type: 'text', inputMode: 'numeric', placeholder: 'Final total', autoComplete: 'off', 'aria-label': 'Final total'});
      const form = element('form', {onSubmit: event => {event.preventDefault(); submit();}}, [element('label', {}, [element('span', {}, 'What was the final total?'), input]), element('button', {className: 'button', type: 'submit'}, 'Check total')]);
      ui.board.replaceChildren(form);
      input.focus();
    }, paused => {
      if (paused) {numberDisplay.textContent = 'Paused'; sequenceCounter.textContent = 'Resume when you are ready.';}
    });
  }

  function submit() {
    if (state !== 'answer') return;
    const value = input.value.trim();
    if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {ui.feedback.textContent = 'Enter a whole number. Negative totals may start with a minus sign.'; return;}
    state = 'review';
    moves++;
    const success = checkSolution(puzzle, value);
    if (success) correct++;
    ui.phase.textContent = success ? 'Correct' : 'Review';
    const sequence = puzzle.numbers.map((number, index) => `${index > 0 ? number < 0 ? ' − ' : ' + ' : number < 0 ? '−' : ''}${Math.abs(number)}`).join('');
    ui.board.replaceChildren(element('div', {className: 'mem-number'}, puzzle.solution), element('div', {className: 'mem-equation'}, `${sequence} = ${puzzle.solution}`));
    ui.feedback.textContent = success ? 'Correct total. Nice concentration.' : `You answered ${Number(value)}. The correct total is ${puzzle.solution}; review the full sequence above.`;
    ui.progress(round, correct, moves);
    ui.controls.replaceChildren(button(round === 4 ? 'Finish session' : 'Next round', () => {
      round++;
      if (round === 5) ui.finish(correct, moves);
      else renderRound();
    }));
  }

  renderRound();
  return {destroy: () => ui.destroy(), hint() {ui.feedback.textContent = 'Keep only the current total. For 47 + 19, add 20 and subtract 1. Split larger values into hundreds, tens and units.';}};
}
