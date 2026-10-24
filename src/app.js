import {games,categories,dailyIds,gameById} from './catalog.js';
import {icon,artwork} from './visuals.js';
import {hashSeed,localDay} from './lib.js';
import {readProgress,recordSession,getStats,clearProgress,setProgressOwner,getProgressOwner} from './progress.js';
import {auth} from './auth.js';
import {currentRoute,routeHref} from './pages-router.js';

const app = document.querySelector('#app');
const overlay = document.querySelector('#overlay');
let cleanup = () => {};
let routeToken = 0;
let toastTimer;
let searchReturnFocus;
let activeSection = '/';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const dailyLink = id => `/play/${id}?daily=${localDay()}&difficulty=medium`;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const currentSessions = () => readProgress().sessions;
const nav = [ ['home','Discover','/'],['grid','All games','/games'],['calendar','Daily mix','/daily'],['chart','Your progress','/progress'] ];

function toast(message) {
  const node=document.querySelector('#toast');
  node.textContent=message; node.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3500);
}

function navigate(href, replace = false) {
  history[replace?'replaceState':'pushState']({},'',routeHref(href));
  render();
  window.scrollTo({top:0,behavior:'instant'});
}

function shell(content, section = '/') {
  activeSection = section;
  const stats=getStats(currentSessions());
  const active = section.startsWith('/play')?'/games':section;
  app.innerHTML=`
    <aside class="sidebar" aria-label="Main navigation">
      <a class="brand" href="#/" aria-label="Axiom home"><span class="brand-mark">a<span>·</span></span>axiom<span class="brand-dot">.</span></a>
      <div class="sidebar-label">YOUR DAILY MINDSPACE</div>
      <nav>${nav.map(([glyph,label,url])=>`<a href="#${url}" class="nav-link ${active===url?'active':''}" ${active===url?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span>${url==='/daily'?'<span class="nav-count">3</span>':''}</a>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="local-note">${icon('shield')}<span>Your space. Your pace.<small>Progress stays on this device.</small></span></div><a href="#/settings" class="nav-link ${active==='/settings'?'active':''}">${icon('settings')}<span>Preferences</span></a><a class="profile auth-profile account-entry" href="#/account" aria-label="Sign in to Axiom"><span class="avatar" data-account-initial>Y</span><span><span data-account-name>Sign in</span><small data-account-detail>Playing as a guest</small></span><span class="local-label" data-account-label>GUEST</span></a></div>
    </aside>
    <div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" id="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">${icon('menu')}</button><div class="breadcrumbs">Your playground<span>/</span><strong>${section.startsWith('/play')?'Let’s play':section==='/account'?'Your account':nav.find(item=>item[2]===section)?.[1]||'Preferences'}</strong></div><div class="header-actions"><button class="search-button" id="open-search">${icon('search',17)}<span>Find a game</span><kbd>⌘ K</kbd></button><span class="streak" title="Consecutive days with a completed game">${icon('bolt',17)}<b>${stats.streak}</b><span>day streak</span></span><a class="auth-header-button account-entry" href="#/account" aria-label="Sign in to Axiom" data-account-action-label>Sign in</a></div></header><main id="main" tabindex="-1">${content}</main><footer class="footer"><span>A little play. A sharper mind.</span><span>Made for curious minds <span class="footer-dot">•</span> Browser prototype</span></footer></div>`;
  updateAccountChrome();
  document.querySelector('#open-search').setAttribute('aria-label','Find a game');
  document.querySelector('#open-search').onclick=openSearch;
  document.querySelector('#menu-toggle').onclick=()=>{
    const isOpen=document.body.classList.toggle('nav-open');
    document.querySelector('#menu-toggle').setAttribute('aria-expanded',String(isOpen));
  };
}

function updateAccountChrome() {
  const user=auth.getSnapshot().user;
  const name=user?.displayName||user?.email?.split('@')[0]||'Your account';
  document.querySelectorAll('[data-account-initial]').forEach(node=>{node.textContent=user?Array.from(name)[0].toUpperCase():'Y';});
  document.querySelectorAll('.account-entry').forEach(node=>node.setAttribute('aria-label',user?'Your Axiom account':'Sign in to Axiom'));
  const nameNode=document.querySelector('[data-account-name]');if(nameNode)nameNode.textContent=user?name:'Sign in';
  const detail=document.querySelector('[data-account-detail]');if(detail)detail.textContent=user?(user.emailVerified?'Your account':'Verify your email'):'Playing as a guest';
  const actionLabel=document.querySelector("[data-account-action-label]");if(actionLabel)actionLabel.textContent=user?"Account":"Sign in";
  const label=document.querySelector('[data-account-label]');if(label)label.textContent=user?'ACCOUNT':'GUEST';
  const streak=document.querySelector('.streak b');if(streak)streak.textContent=String(getStats(currentSessions()).streak);
}

async function renderAccount(token,mode='account') {
  shell('<div id="account-mount"><div class="loading-state">Opening your account…</div></div>','/account');
  document.title='Your account · Axiom';
  let disposed=false,dispose;
  cleanup=()=>{disposed=true;dispose?.();};
  try {
    const {mountAuth}=await import('./auth-ui.js');
    if(disposed||token!==routeToken)return;
    dispose=mountAuth(document.querySelector('#account-mount'),{navigate,mode});
  }catch{
    if(disposed)return;
    document.querySelector('#account-mount').innerHTML='<div class="empty-state"><h2>Sign-in could not load.</h2><p>Please refresh to try again. You can still enjoy all the games as a guest.</p><a class="button secondary" href="#/games">Explore the games</a></div>';
  }
}

function gameCard(game) {
  const count = currentSessions().filter(s=>s.game===game.id).length;
  return `<a class="game-card" href="#/play/${game.id}"><div class="game-art ${game.color}"><span class="art-category">${icon(game.icon,13)} ${game.category}</span>${artwork(game.id)}<span class="card-play" aria-hidden="true">${icon('arrow',20)}</span></div><div class="card-body"><div class="card-title"><h3>${game.name}</h3>${count?`<span class="played-badge" title="${count} sessions completed">${icon('check',14)}</span>`:''}</div><p>${game.description}</p><div class="card-meta"><span>${icon('clock',13)} ${game.time}</span><span>3 levels ${icon('arrow',13)}</span></div></div></a>`;
}

function chips(selected='All games') {
  return `<div class="filter-chips" role="group" aria-label="Game category">${categories.map(c=>`<button class="filter-chip ${c===selected?'selected':''}" data-filter="${c}" aria-pressed="${c===selected}">${c}${c==='All games'?` <span>${games.length}</span>`:''}</button>`).join('')}</div>`;
}

function wireFilters(isHome=false) {
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
    const category=button.dataset.filter;
    const list=games.filter(g=>category==='All games'||g.category===category);
    document.querySelector('#game-grid').innerHTML=(isHome&&category==='All games'?list.slice(0,6):list).map(gameCard).join('');
    document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
    const label=document.querySelector('#game-count');if(label)label.textContent=`${list.length} games to explore`;
  });
}

function renderHome() {
  const sessions=currentSessions(),stats=getStats(sessions);
  const today=new Date().toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'});
  const dailyDone=dailyIds.filter(id=>sessions.some(s=>s.game===id&&s.daily===localDay())).length;
  shell(`<div class="page-heading"><div><div class="eyebrow">${today.toUpperCase()}</div><h1>A little play.<br class="mobile-only"> A sharper mind<span class="purple-text">.</span></h1><p>Step out of the scroll. Find your next small challenge.</p></div><span class="greeting-sticker" aria-hidden="true">${icon('spark',30)}</span></div>
    <section class="feature-row" aria-label="Featured challenges"><a href="#/daily" class="daily-hero"><div class="hero-copy"><span class="overline"><span class="live-dot"></span> THE DAILY MIX</span><h2>Three small challenges.<br>One fresh perspective.</h2><p>A little logic, a new path, a moment of focus.<br>Your daily reset is ready.</p><span class="button dark">${dailyDone===3?'Revisit today’s mix':'Find your flow'} ${icon('arrow',17)}</span><div class="hero-foot"><span class="tiny-avatars">${icon('crown',13)} ${icon('route',13)} ${icon('spark',13)}</span><span>3 games <span>·</span> About 10 minutes</span></div></div><div class="hero-illustration" aria-hidden="true"><div class="float-spark">✧</div><div class="hero-tile tile-back">${artwork('tango')}</div><div class="hero-tile tile-front">${artwork('queens')}</div><div class="hero-circle"></div><span class="float-line">↗</span></div></a>
    <aside class="today-card"><div class="today-heading"><span class="today-icon">${icon('sun',19)}</span><span>A moment for you</span></div><h3>Build a habit.<br>One puzzle at a time.</h3><div class="daily-progress"><span>Today’s mix</span><strong>${dailyDone}<span> / 3</span></strong></div><div class="progress-track"><span style="width:${dailyDone/3*100}%"></span></div><div class="day-dots">${weekDots(sessions)}</div><p>${stats.completed?'Keep showing up. The little wins count.':'Your first little win is one game away.'}</p><a href="#/progress" class="text-link">See your progress ${icon('arrow',15)}</a></aside></section>
    <section class="library-section"><div class="section-heading"><div><h2>Find your kind of challenge</h2><p>Different ways to think. Something for every mood.</p></div><a class="text-link" href="#/games">Explore all ${games.length} games ${icon('arrow',16)}</a></div>${chips()}<div id="game-grid" class="game-grid">${games.slice(0,6).map(gameCard).join('')}</div></section>
    <section class="quiet-banner"><div class="quiet-icon">${icon('shield',26)}</div><div><h3>A playground, at your pace.</h3><p>No pressure to rank. Just thoughtful games and a little room to grow.</p></div><a href="#/games" class="text-link">Pick a game ${icon('arrow',16)}</a></section>`);
  wireFilters(true);
}

function weekDots(sessions) {
  return Array.from({length:7},(_,i)=>{
    const date=new Date();date.setDate(date.getDate()-(6-i));
    const done=sessions.some(s=>s.day===localDay(date));
    return `<span class="day-dot ${done?'done':''} ${i===6?'today':''}" title="${localDay(date)}${done?' — completed a game':''}"><span>${date.toLocaleDateString('en',{weekday:'narrow'})}</span><i>${done?icon('check',12):''}</i></span>`;
  }).join('');
}

function renderLibrary() {
  shell(`<div class="page-heading"><div><div class="eyebrow">THE PLAYGROUND</div><h1>Follow your curiosity<span class="purple-text">.</span></h1><p>Thirteen ways to stretch your mind. Find the one that clicks.</p></div><span class="heading-count">13<span>games, endless little wins</span></span></div><section>${chips()}<div class="list-caption"><span id="game-count">13 games to explore</span><span>No downloads. Just play.</span></div><div id="game-grid" class="game-grid">${games.map(gameCard).join('')}</div></section>`,'/games');
  wireFilters();
}

function renderDaily() {
  const sessions=currentSessions();
  const done=dailyIds.filter(id=>sessions.some(s=>s.game===id&&s.daily===localDay())).length;
  shell(`<div class="page-heading"><div><div class="eyebrow">FRESH EVERY DAY · ${new Date().toLocaleDateString('en',{month:'long',day:'numeric'}).toUpperCase()}</div><h1>Your daily reset<span class="purple-text">.</span></h1><p>Three small challenges. The same puzzles all day. A new mix tomorrow.</p></div><span class="daily-complete-count">${done}<span>/ 3 complete</span></span></div><div class="daily-intro"><span>${icon('sun',24)}</span><p>A little deduction, a connected path, and a memory workout.<br><strong>Take them in any order. Make this moment yours.</strong></p></div><section class="daily-grid">${dailyIds.map((id,i)=>{const game=gameById(id),complete=sessions.some(s=>s.game===id&&s.daily===localDay());return `<a href="#${dailyLink(id)}" class="daily-game"><div class="daily-game-art ${game.color}"><span class="daily-number">0${i+1}</span>${artwork(id)}</div><div class="daily-game-body"><span class="eyebrow">${game.category.toUpperCase()}</span><h2>${game.name}</h2><p>${game.description}</p><span class="daily-game-cta">${complete?`${icon('check',18)} Complete — play again`:`Start challenge ${icon('arrow',18)}`}</span></div></a>`;}).join('')}</section><div class="daily-note">${icon('calendar',18)}<p>Daily puzzles reset at midnight in your device’s timezone. Completed games count towards your streak.</p></div>`,'/daily');
}

function renderProgress() {
  const sessions=currentSessions(),stats=getStats(sessions);
  const categoryTotals=categories.slice(1).map(category=>({category,total:sessions.filter(s=>gameById(s.game)?.category===category).length}));
  shell(`<div class="page-heading"><div><div class="eyebrow">SMALL STEPS, REAL PROGRESS</div><h1>Look how far you’ll go<span class="purple-text">.</span></h1><p>Your practice, collected here. Every completed game counts.</p></div></div><div class="stat-grid">${[['spark',stats.completed,'Games completed'],['bolt',stats.streak,'Day streak'],['clock',stats.minutes,'Minutes of focus'],['check',stats.today,'Completed today']].map(([glyph,value,label])=>`<div class="stat-card"><span>${icon(glyph,21)}</span><strong>${value}</strong><p>${label}</p></div>`).join('')}</div><div class="progress-columns"><section class="surface"><div class="section-heading"><h2>Your week in play</h2><span class="muted">Last 7 days</span></div><div class="weekly-chart">${Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-(6-i));const count=sessions.filter(s=>s.day===localDay(date)).length;const max=Math.max(3,...Array.from({length:7},(_,j)=>{const d=new Date();d.setDate(d.getDate()-j);return sessions.filter(s=>s.day===localDay(d)).length;}));return `<div class="chart-day"><span>${count}</span><div class="bar-track"><i style="height:${count/max*100}%"></i></div><span>${date.toLocaleDateString('en',{weekday:'short'})}</span></div>`;}).join('')}</div></section><section class="surface"><h2>A well-rounded mind</h2><p class="muted">Your completed games by skill.</p><div class="skill-bars">${categoryTotals.map(({category,total})=>`<div><span>${category}<b>${total}</b></span><div class="progress-track"><span style="width:${sessions.length?total/sessions.length*100:0}%"></span></div></div>`).join('')}</div></section></div><section class="surface history-section"><div class="section-heading"><h2>Recent little wins</h2><span class="muted">Last ${Math.min(sessions.length,12)} sessions</span></div>${sessions.length?`<div class="table-wrap"><table><thead><tr><th>Game</th><th>Level</th><th>Time</th><th>Hints</th><th>Completed</th></tr></thead><tbody>${sessions.slice(-12).reverse().map(s=>`<tr><td><a href="#/play/${escape(s.game)}">${escape(gameById(s.game)?.name||s.game)}</a>${s.daily?'<span class="mini-label">DAILY</span>':''}</td><td class="capitalize">${escape(s.difficulty)}</td><td>${formatTime(s.seconds)}</td><td>${s.hints||0}</td><td>${escape(s.day)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><span>${icon('spark',32)}</span><h3>Your first win belongs here.</h3><p>Pick a game that catches your eye. We’ll take care of the rest.</p><a href="#/games" class="button dark">Explore the games ${icon('arrow',16)}</a></div>`}</section><p class="storage-note">Stored on this browser only. Your most recent 200 completed sessions are retained.</p>`,'/progress');
}

function renderSettings() {
  let reduced=false;try{reduced=localStorage.getItem('axiom.reduced-motion')==='true';}catch{}
  shell(`<div class="page-heading"><div><div class="eyebrow">MAKE YOURSELF AT HOME</div><h1>Your space. Your pace<span class="purple-text">.</span></h1><p>A few small settings to make play feel right.</p></div></div><section class="surface settings-surface"><div class="setting-row"><div><h3>Reduce motion</h3><p>Keep transitions still and focused. Your system preference is also respected.</p></div><label class="switch"><input id="motion-setting" type="checkbox" ${reduced?'checked':''}><span></span><span class="sr-only">Reduce motion</span></label></div><div class="setting-row"><div><h3>Local progress</h3><p>Results stay in this browser, separately for each signed-in account and for guests. Cross-device sync is not enabled.</p></div><span class="status-tag">${icon('shield',14)} On device</span></div><div class="setting-row"><div><h3>Start fresh</h3><p>Remove completed sessions and your streak from this device.</p></div><button class="button secondary" id="clear-progress">Clear progress</button></div></section><div class="note-surface"><h3>Built for a little daily play</h3><p>Axiom has 13 playable games and optional account sign-in. The games run on your device. Account authentication is handled by Firebase; game progress stays in this browser. Live matches and cross-device progress sync are planned for later.</p></div>`,'/settings');
  document.querySelector('#motion-setting').onchange=event=>{const value=event.target.checked;document.documentElement.classList.toggle('reduce-motion',value);try{localStorage.setItem('axiom.reduced-motion',String(value));}catch{toast('This browser could not save the preference.');}};
  document.querySelector('#clear-progress').onclick=()=>{
    showDialog(`<div class="dialog-symbol">${icon('reset',28)}</div><h2>A fresh start?</h2><p>This removes your saved sessions and streak from this browser.</p><div class="dialog-actions"><button class="button secondary" data-close>Keep my progress</button><button class="button dark" id="confirm-clear">Clear progress</button></div>`);
    document.querySelector('#confirm-clear').onclick=()=>{try{clearProgress();closeDialog();renderSettings();toast('Your progress has been cleared.');}catch{toast('Your browser could not clear progress.');}};
  };
}

async function renderGame(id, token) {
  const game=gameById(id);
  if(!game){renderNotFound();return;}
  const authSnapshot=auth.getSnapshot();
  const sessionOwner=authSnapshot.status==='idle'||authSnapshot.loading
    ? auth.initialize().then(()=>auth.getSnapshot().user?.uid??null).catch(()=>null)
    : Promise.resolve(getProgressOwner());
  const params=new URLSearchParams(currentRoute().search);
  const daily=params.get('daily');
  const parsedDay = daily && /^\d{4}-\d{2}-\d{2}$/.test(daily) ? new Date(`${daily}T12:00:00`) : null;
  const dailyDate=parsedDay && !Number.isNaN(parsedDay.getTime()) && localDay(parsedDay)===daily && dailyIds.includes(id)?daily:null;
  const difficulty=dailyDate?'medium':['easy','medium','hard'].includes(params.get('difficulty'))?params.get('difficulty'):'easy';
  const seed=dailyDate?hashSeed(`${dailyDate}:${id}`):params.has('seed')?Number(params.get('seed'))>>>0:randomSeed();
  let seconds=0,moves=0,hints=0,complete=false,controller=null,disposed=false;
  let activeSince=performance.now(),elapsed=0,gamePaused=false,clockRunning=!document.hidden;
  const tick=()=>{seconds=Math.floor((elapsed+(clockRunning?performance.now()-activeSince:0))/1000);const node=document.querySelector('#game-time');if(node)node.textContent=formatTime(seconds);};
  const setClockState=(paused=gamePaused)=>{const now=performance.now();if(clockRunning)elapsed+=now-activeSince;gamePaused=paused;activeSince=now;clockRunning=!document.hidden&&!gamePaused&&!complete;tick();};
  const visibility=()=>setClockState();
  shell(`<div class="game-page-heading"><a href="#${dailyDate?'/daily':'/games'}" class="back-link">${icon('back',16)} ${dailyDate?'Daily mix':'All games'}</a><div class="game-heading-row"><div><div class="eyebrow">${game.category.toUpperCase()} ${dailyDate?'· DAILY CHALLENGE':''}</div><h1>${game.name}<span class="purple-text">.</span></h1><p>${game.description}</p></div><div class="game-heading-icon ${game.color}">${icon(game.icon,30)}</div></div></div><div class="play-layout"><section class="play-surface" aria-label="${game.name} game"><div class="play-toolbar"><div class="level-control"><label for="difficulty">Level</label><select id="difficulty" ${dailyDate?'disabled':''}><option value="easy" ${difficulty==='easy'?'selected':''}>Easy</option><option value="medium" ${difficulty==='medium'?'selected':''}>Medium</option><option value="hard" ${difficulty==='hard'?'selected':''}>Hard</option></select></div><div class="play-metrics"><span>${icon('clock',16)}<b id="game-time">0:00</b></span><span><b id="game-moves">0</b> moves</span></div></div><div id="game-mount" class="game-stage"><div class="loading-state">Getting your challenge ready…</div></div><div class="play-bottom"><span>${icon('shield',14)} Just you and the puzzle.</span><div><button class="text-button" id="hint-button">${icon('bulb',17)} Hint</button><button class="text-button" id="restart-button">${icon('reset',17)} Restart</button></div></div></section><aside class="game-guide"><div class="surface rules-card"><div class="guide-title">${icon('bulb',20)}<h2>How to play</h2></div><ol>${game.rules.map(rule=>`<li>${rule}</li>`).join('')}</ol><div class="guide-tip"><span>Take your time.</span><p>A good thought is worth a little pause.</p></div></div><div class="next-game-card"><span class="eyebrow">UP NEXT</span><h3>${games[(games.indexOf(game)+1)%games.length].name}</h3><p>A different kind of challenge.</p><a class="text-link" href="#/play/${games[(games.indexOf(game)+1)%games.length].id}">Give it a try ${icon('arrow',16)}</a></div><p class="seed-note">Puzzle ${seed.toString(16).toUpperCase()}${dailyDate?` · ${dailyDate}`:''}</p></aside></div>`,'/play');
  document.title=`${game.name} · Axiom`;
  const interval=setInterval(()=>{if(!complete)tick();},1000);
  document.addEventListener('visibilitychange',visibility);
  cleanup=()=>{disposed=true;clearInterval(interval);document.removeEventListener('visibilitychange',visibility);controller?.destroy?.();};
  const startAgain=(newSeed=false)=>navigate(`/play/${id}?difficulty=${difficulty}${dailyDate?`&daily=${dailyDate}`:`&seed=${newSeed?randomSeed():seed}`}`);
  document.querySelector('#difficulty').onchange=event=>navigate(`/play/${id}?difficulty=${event.target.value}`);
  document.querySelector('#restart-button').onclick=()=>startAgain(false);
  document.querySelector('#hint-button').onclick=()=>{if(complete||!controller)return;hints++;controller.hint?.();};
  try {
    const module=await import(`./games/${id}.js`);
    if(disposed||token!==routeToken)return;
    const mount=document.querySelector('#game-mount');mount.replaceChildren();
    controller=module.mount(mount,{seed,difficulty,onProgress(progress={}){if(disposed)return;if(typeof progress.paused==='boolean')setClockState(progress.paused);if(Number.isFinite(progress.moves)){moves=progress.moves;document.querySelector('#game-moves').textContent=String(moves);}},onComplete(result={}){
      if(complete||disposed)return;
      tick();complete=true;setClockState(true);clearInterval(interval);
      const completedSession={game:id,difficulty,seed,seconds,moves:result.moves??moves,score:result.score??0,accuracy:result.accuracy??100,hints,daily:dailyDate};
      // Optional account restoration must never delay the game result screen.
      sessionOwner.then(owner=>{
        const saved=recordSession(completedSession,undefined,owner);
        if(disposed||token!==routeToken){
          if(saved&&owner===getProgressOwner()&&['/','/games','/daily','/progress','/settings'].includes(activeSection))render();
          return;
        }
        const note=overlay.querySelector('[data-progress-save]');
        if(note)note.textContent=saved?'Progress saved on this device.':'Progress could not be saved. Check browser storage settings.';
        updateAccountChrome();
      });
      const feedback=result.accuracy!=null&&result.accuracy<100?'Practice makes progress. Keep that curiosity going.':'One thoughtful little win. Nicely done.';
      showDialog(`<div class="completion-spark">${icon('spark',36)}</div><span class="eyebrow">${game.name.toUpperCase()} · SESSION COMPLETE</span><h2>A little sharper<span class="purple-text">.</span></h2><p>${feedback}</p><div class="result-stats"><div><strong>${formatTime(seconds)}</strong><span>Time</span></div><div><strong>${result.moves??moves}</strong><span>Moves</span></div><div><strong>${hints}</strong><span>Hints</span></div>${result.accuracy!=null?`<div><strong>${Math.round(result.accuracy)}%</strong><span>Accuracy</span></div>`:''}</div>${hints?'<p class="result-note">Completed with guidance. Hints are included in your history.</p>':''}<div class="dialog-actions"><a class="button secondary" href="#${dailyDate?'/daily':'/progress'}">${dailyDate?'Back to daily mix':'View progress'}</a><button class="button dark" id="play-again">${dailyDate?'Play again':'Another puzzle'} ${icon('arrow',16)}</button></div><p class="result-note" data-progress-save>Saving progress on this device…</p>`);
      document.querySelector('#play-again').onclick=()=>{closeDialog();startAgain(true);};
    }});
  }catch(error){if(disposed)return;console.error(error);document.querySelector('#game-mount').innerHTML='<div class="empty-state"><h3>This game could not load.</h3><p>Please refresh and try again.</p><button class="button secondary" id="retry-game">Try again</button></div>';document.querySelector('#retry-game').onclick=()=>render();}
}


function renderNotFound(){shell(`<div class="empty-state not-found"><span>${icon('route',40)}</span><h1>A little off the path.</h1><p>Let’s find you a good challenge.</p><a class="button dark" href="#/games">Explore all games ${icon('arrow',16)}</a></div>`);}

function closeDialog(){overlay.replaceChildren();document.body.classList.remove('dialog-open');searchReturnFocus?.focus?.();}
function showDialog(content, className='') {
  searchReturnFocus=document.activeElement;
  overlay.innerHTML=`<div class="modal-backdrop"><section class="dialog ${className}" role="dialog" aria-modal="true" aria-label="${className==='search-dialog'?'Find a game':'Axiom dialog'}"><button class="dialog-close icon-button" data-close aria-label="Close dialog">${icon('close')}</button>${content}</section></div>`;
  document.body.classList.add('dialog-open');
  overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDialog);
  overlay.querySelector('.modal-backdrop').onclick=event=>{if(event.target.classList.contains('modal-backdrop'))closeDialog();};
  requestAnimationFrame(()=>(overlay.querySelector('input')||overlay.querySelector('.dialog-actions button, .dialog-actions a')||overlay.querySelector('[data-close]'))?.focus());
}

function openSearch(){
  showDialog(`<div class="search-input-wrap">${icon('search',22)}<input type="search" id="game-search" placeholder="What would you like to play?" aria-label="Search games" autocomplete="off"></div><div class="search-label">FIND YOUR NEXT CHALLENGE</div><div id="search-results" class="search-results"></div><div class="search-footer">Escape to close <span>13 games. Plenty to discover.</span></div>`,'search-dialog');
  const input=document.querySelector('#game-search'),results=document.querySelector('#search-results');
  const update=()=>{const query=input.value.toLowerCase().trim();const matches=games.filter(g=>`${g.name} ${g.category} ${g.description}`.toLowerCase().includes(query));results.innerHTML=matches.length?matches.map(g=>`<a href="#/play/${g.id}" class="search-result"><span class="search-icon ${g.color}">${icon(g.icon)}</span><span><strong>${g.name}</strong><small>${g.category} · ${g.time}</small></span>${icon('arrow',17)}</a>`).join(''):'<p class="search-empty">No games found. Try “logic” or “memory”.</p>';};
  input.oninput=update;update();
  input.onkeydown=event=>{if(event.key==='Enter'){const link=results.querySelector('a');if(link){closeDialog();navigate(link.getAttribute('href'));}}};
}

function render(){
  cleanup();cleanup=()=>{};closeDialog();document.body.classList.remove('nav-open');routeToken++;
  document.title='Axiom — A little play. A sharper mind.';
  const path=currentRoute().pathname;
  if(path==='/')renderHome();
  else if(path==='/games')renderLibrary();
  else if(path==='/daily')renderDaily();
  else if(path==='/progress')renderProgress();
  else if(path==='/settings')renderSettings();
  else if(path==='/account'||path==='/login')renderAccount(routeToken,path==='/login'?'signin':'account');
  else if(path==='/register')renderAccount(routeToken,'register');
  else if(path==='/forgot-password')renderAccount(routeToken,'reset');
  else if(path.startsWith('/play/'))renderGame(path.split('/')[2],routeToken);
  else renderNotFound();
}

document.addEventListener('click',event=>{
  const anchor=event.target.closest('a');
  if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target||anchor.hasAttribute('download'))return;
  const href=anchor.getAttribute('href');
  if(href==='#main'){event.preventDefault();const main=document.querySelector('#main');main?.focus();main?.scrollIntoView();return;}
  if(!href?.startsWith('#/'))return;
  event.preventDefault();navigate(href);
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}
  if(event.key==='Escape')closeDialog();
  if(event.key==='Tab'&&overlay.children.length){
    const focusable=[...overlay.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(el=>!el.disabled);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
window.addEventListener('hashchange',render);
let calendarDay=localDay(),calendarTimer;
function refreshCalendar(){
  clearTimeout(calendarTimer);
  const current=localDay();
  if(current!==calendarDay){calendarDay=current;if(!currentRoute().pathname.startsWith('/play/'))render();}
  const midnight=new Date();midnight.setDate(midnight.getDate()+1);midnight.setHours(0,0,0,50);
  calendarTimer=setTimeout(refreshCalendar,midnight.getTime()-Date.now());
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCalendar();});
refreshCalendar();
try{document.documentElement.classList.toggle('reduce-motion',localStorage.getItem('axiom.reduced-motion')==='true');}catch{}
render();
auth.subscribe(snapshot=>{
  const owner=snapshot.user?.uid??null;
  const changed=owner!==getProgressOwner();
  setProgressOwner(owner);
  updateAccountChrome();
  if(changed&&['/','/games','/daily','/progress','/settings'].includes(activeSection))render();
});
// Restore identity without blocking initial rendering or loading any game module.
auth.initialize().catch(()=>{});
