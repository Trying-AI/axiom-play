// Small, dependency-free helpers shared by the memory and reasoning games.
import {createRng as randomSource, shuffle as shuffled, make as element} from '../lib.js';
export {randomSource, shuffled, element};

export function button(label, onClick, secondary = false) {
  return element('button', {type: 'button', className: `button${secondary ? ' secondary' : ''}`, onClick}, label);
}

export function level(difficulty) {
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
}

export function sessionUI(container, options, title, rules, totalRounds = 5) {
  installStyles();
  let destroyed = false;
  let finished = false;
  let clock = null;
  let reportedPaused = null;
  let cleanupExtra = () => {};
  const counter = element('span', {className: 'stat-pill'}, `Round 1 / ${totalRounds}`);
  const resultCounter = element('span', {className: 'stat-pill'}, '0 correct');
  const phase = element('span', {className: 'stat-pill'}, 'Ready');
  const info = element('div', {className: 'mem-stats'}, [counter, resultCounter, phase]);
  const board = element('div', {className: 'game-board mem-board-wrap'});
  const feedback = element('div', {className: 'game-message', role: 'status', 'aria-live': 'polite'});
  const controls = element('div', {className: 'game-controls'});
  const clockControls = element('div', {className: 'mem-clock-controls'});
  const help = element('details', {className: 'mem-help'}, [element('summary', {}, 'How to play'), element('p', {}, rules)]);
  const shell = element('section', {className: 'game-stage mem-stage', 'aria-label': title}, [info, element('p', {className: 'game-instruction'}, rules), board, feedback, controls, clockControls, help]);
  container.replaceChildren(shell);
  const onVisibility = () => {
    if (document.hidden && clock && !clock.paused) clock.pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // A pause-only update is partial: the shell keeps its existing moves/accuracy.
  function reportPaused(paused) {
    if (destroyed || finished || reportedPaused === paused) return;
    reportedPaused = paused;
    options.onProgress?.({paused});
  }

  function clearClock() {
    if (clock) clock.stop();
    clock = null;
    clockControls.replaceChildren();
  }

  function countdown(duration, onTick, onFinish, onPause = () => {}) {
    clearClock();
    reportPaused(false);
    let remaining = duration;
    let last = performance.now();
    let stopped = false;
    let paused = false;
    const pause = button('Pause', () => paused ? resume() : suspend(), true);
    clockControls.replaceChildren(pause, element('small', {}, 'Switching tabs pauses the exercise.'));
    const tick = () => {
      if (stopped || paused || destroyed) return;
      const now = performance.now();
      remaining = Math.max(0, remaining - (now - last));
      last = now;
      onTick(remaining);
      if (remaining <= 0) {
        stop();
        clock = null;
        clockControls.replaceChildren();
        onFinish();
      }
    };
    const timer = setInterval(tick, 40);
    function stop() { stopped = true; clearInterval(timer); }
    function suspend() {
      tick();
      if (stopped) return;
      paused = true;
      pause.textContent = 'Resume';
      phase.textContent = 'Paused';
      reportPaused(true);
      onPause(true);
    }
    function resume() {
      if (stopped || document.hidden) return;
      paused = false;
      last = performance.now();
      pause.textContent = 'Pause';
      reportPaused(false);
      onPause(false);
      onTick(remaining);
    }
    clock = {stop, pause: suspend, get paused() {return paused;}};
    onTick(remaining);
    if (document.hidden) suspend();
  }

  return {
    board, feedback, controls, phase, shell, countdown, clearClock,
    waiting() { reportPaused(true); },
    get destroyed() { return destroyed; },
    setCleanup(fn) { cleanupExtra = fn; },
    progress(round, correct, moves = 0) {
      counter.textContent = `Round ${Math.min(round + 1, totalRounds)} / ${totalRounds}`;
      resultCounter.textContent = `${correct} correct`;
      options.onProgress?.({round: Math.min(round + 1, totalRounds), totalRounds, completedRounds: round, correctRounds: correct, moves});
    },
    finish(correct, moves, score = correct * 200) {
      if (destroyed || finished) return;
      finished = true;
      clearClock();
      phase.textContent = 'Session complete';
      feedback.textContent = `${correct} of ${totalRounds} rounds correct. Session complete.`;
      controls.replaceChildren();
      options.onComplete?.({score, moves, accuracy: Math.round(correct / totalRounds * 100)});
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearClock();
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupExtra();
      shell.remove();
    },
  };
}

export function wireGridNavigation(grid, cells, size) {
  grid.addEventListener('keydown', event => {
    const index = cells.indexOf(document.activeElement);
    if (index < 0) return;
    const shift = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size}[event.key];
    if (shift === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(cells.length - 1, index + shift));
    cells[next].focus();
  });
}

function installStyles() {
  if (document.getElementById('axiom-memory-game-styles')) return;
  const style = element('style', {id: 'axiom-memory-game-styles'});
  style.textContent = `
    .mem-stage{width:100%;max-width:760px;margin:auto;color:var(--text,#263046)}.mem-stage .game-instruction{line-height:1.65;max-width:65ch}
    .mem-stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.mem-board-wrap{padding:clamp(8px,2vw,24px);min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
    .mem-grid{display:grid;gap:8px;width:min(100%,410px)}.mem-cell{aspect-ratio:1;min-width:0!important;min-height:0!important;width:100%;font:inherit;color:#263046;background:#f1f3f9;border:1px solid #dce1eb;transition:background .12s,border-color .12s}.mem-cell:disabled{opacity:1}
    .mem-cell.lit{background:#dcdefa!important;color:#37398a!important;border-color:#777bdd!important}.mem-cell.missed{outline:2px dashed #ad7d12;outline-offset:-3px}.mem-cell.wrong{background:#fde8e7!important;color:#a83530!important;border-color:#d98f88!important}
    .mem-stage .game-controls{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}.mem-clock-controls{display:flex;justify-content:center;align-items:center;gap:12px;min-height:40px;margin-top:12px;flex-wrap:wrap}.mem-clock-controls small,.mem-help{color:#667187;font-size:.82rem}.mem-help{margin-top:20px}.mem-help summary{cursor:pointer}.mem-help p{line-height:1.7}
    .mem-stage .game-message{min-height:30px;margin-top:14px;text-align:center;line-height:1.6}.mem-stage input{font:inherit;color:#263046;border:1px solid #aab3c4;border-radius:12px;background:#fff;padding:13px 16px;width:min(100%,300px);text-align:center;font-size:1.25rem}.mem-stage input::placeholder{color:#68738a}.mem-stage label{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%}
    .mem-number{font-size:clamp(3rem,9vw,6rem);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.04em;min-height:1.3em;color:#4144a5}.mem-subtle{font-size:.85rem;color:#667187;text-align:center}.mem-prompt{font-size:clamp(1.35rem,4vw,2.15rem);font-weight:650;text-align:center;line-height:1.5;max-width:24ch}.mem-equation{font-family:ui-monospace,monospace;font-size:.95rem;text-align:center;line-height:1.8;overflow-wrap:anywhere}
    .pin-grid{display:grid;gap:4px;width:min(100%,460px)}.pin-cell,.pin-port{aspect-ratio:1;min-width:0;min-height:0;font-size:clamp(.65rem,2vw,.9rem);border-radius:8px;display:flex;align-items:center;justify-content:center}.pin-cell{background:#f1f3f9;color:#263046;border:1px solid #dce1eb;font-size:1.6rem}.pin-port{font:inherit;font-size:.75rem;color:#536078;background:#fff;border:1px solid #c4ccdc;cursor:pointer}.pin-port:disabled{cursor:default;opacity:1}.pin-port.entry{background:#ebeafa;color:#4b46a7;border-color:#a7a2e5}.pin-port.answer{outline:2px solid #32855a;background:#deeee6;color:#246046}.pin-port.error{outline:2px solid #c4554a;background:#fde8e7;color:#a83530}.pin-cell.path{background:#e4f2e9;border-color:#b0d4c2}
    .mem-stage button:focus-visible,.mem-stage input:focus-visible,.mem-help summary:focus-visible{outline:3px solid #6264d8;outline-offset:3px}.mem-stage button:disabled{cursor:default}.mem-stage form{display:flex;align-items:center;flex-direction:column;gap:16px;width:100%}
    @media(prefers-reduced-motion:reduce){.mem-cell{transition:none}}
  `;
  document.head.append(style);
}
