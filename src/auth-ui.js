import {auth} from './auth.js';
import {icon} from './visuals.js';
import {games} from './catalog.js';

const modes = new Set(['signin', 'register', 'reset', 'account']);

/** Mounts account controls without taking ownership of the application router. */
export function mountAuth(container, {navigate = () => {}, mode = 'signin', client = auth} = {}) {
  let currentMode = modes.has(mode) ? mode : 'signin';
  let snapshot = client.getSnapshot();
  let disposed = false;
  let busy = false;
  let statusMessage = '';
  let statusTone = 'info';
  let rememberedEmail = '';
  let operationId = 0;
  let renderedKey = '';
  const scope = `auth-${Math.random().toString(36).slice(2, 9)}`;

  const find = selector => container.querySelector(selector);
  const isAccount = () => Boolean(snapshot.user);
  const key = value => JSON.stringify([value.configured, value.user?.uid, value.user?.email, value.user?.emailVerified, value.user?.displayName]);

  function setStatus(message = '', tone = 'info', focus = false) {
    statusMessage = message;
    statusTone = tone;
    const status = find('[data-auth-status]');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.dataset.tone = tone;
    status.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    status.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    if (focus && message) status.focus();
  }

  function updatePending() {
    if (disposed) return;
    const pending = busy || snapshot.loading;
    container.setAttribute('aria-busy', String(pending));
    find('fieldset')?.toggleAttribute('disabled', pending);
    container.querySelectorAll('[data-account-action]').forEach(button => { button.disabled = pending; });
    container.querySelectorAll('[data-auth-mode]').forEach(button => { button.disabled = pending; });
    const submit = find('[data-auth-submit]');
    if (submit) {
      submit.disabled = pending;
      submit.textContent = pending ? 'One moment…' : submit.dataset.label;
    }
    const loading = find('[data-auth-loading]');
    if (loading) loading.hidden = !snapshot.loading || busy;
  }

  async function run(operation, onSuccess) {
    if (disposed || busy || snapshot.loading) return;
    const id = ++operationId;
    busy = true;
    setStatus();
    updatePending();
    try {
      const result = await operation();
      if (disposed || id !== operationId) return;
      snapshot = client.getSnapshot();
      onSuccess(result);
    } catch (error) {
      if (disposed || id !== operationId) return;
      setStatus(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 'error', true);
    } finally {
      if (!disposed && id === operationId) {
        busy = false;
        snapshot = client.getSnapshot();
        // A provider may expire a session while another action is pending.
        // Keep account details in step even when that action then rejects.
        if (renderedKey !== key(snapshot)) render(true);
        updatePending();
      }
    }
  }

  function changeMode(nextMode) {
    if (busy || snapshot.loading) return;
    const email = find('input[type="email"]');
    if (email) rememberedEmail = email.value.trim();
    currentMode = nextMode;
    statusMessage = '';
    render(true);
  }

  function passwordField(id, label, autocomplete, confirm = false) {
    return `<div class="auth-field"><label for="${id}">${label}</label><div class="auth-password"><input id="${id}" name="${confirm ? 'passwordConfirmation' : 'password'}" type="password" autocomplete="${autocomplete}" required ${currentMode === 'register' ? 'minlength="8" maxlength="128"' : ''} ${currentMode === 'register' && !confirm ? `aria-describedby="${scope}-password-help"` : ''}><button class="auth-password-toggle" type="button" aria-label="Show ${confirm ? 'confirmation ' : ''}password" aria-controls="${id}" aria-pressed="false" data-password-toggle>Show</button></div>${currentMode === 'register' && !confirm ? `<p class="auth-field-help" id="${scope}-password-help">Use at least 8 characters. A longer, unique password is best.</p>` : ''}</div>`;
  }

  function formMarkup() {
    const registration = currentMode === 'register';
    const reset = currentMode === 'reset';
    const title = reset ? 'A fresh start.' : registration ? 'Make yourself at home.' : 'Welcome back.';
    const description = reset ? 'Enter your email and we’ll send a link to reset your password.' : registration ? 'Create your Axiom account. Keep your curiosity close.' : 'Sign in to your Axiom account. Your next little challenge is waiting.';
    const submitLabel = reset ? 'Send reset link' : registration ? 'Create account' : 'Sign in';
    return `<div class="auth-card-heading"><span class="auth-card-icon" aria-hidden="true">${icon(reset ? 'reset' : 'spark', 23)}</span><h1 id="${scope}-heading" tabindex="-1">${title}</h1><p>${description}</p></div>
      <form class="auth-form" aria-labelledby="${scope}-heading">
        <fieldset><legend class="sr-only">${reset ? 'Reset password' : registration ? 'Create an account' : 'Sign in'}</legend>
          ${registration ? `<div class="auth-field"><label for="${scope}-name">Your name</label><input id="${scope}-name" name="displayName" type="text" autocomplete="nickname" minlength="2" maxlength="40" required placeholder="How should we call you?"></div>` : ''}
          <div class="auth-field"><label for="${scope}-email">Email address</label><input id="${scope}-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required maxlength="254" placeholder="you@example.com"></div>
          ${reset ? '' : passwordField(`${scope}-password`, 'Password', registration ? 'new-password' : 'current-password')}
          ${registration ? passwordField(`${scope}-confirm`, 'Confirm password', 'new-password', true) : ''}
          ${reset ? '' : `<div class="auth-form-options"><label class="auth-checkbox"><input type="checkbox" name="remember" checked><span>Keep me signed in</span></label>${registration ? '' : '<button type="button" class="auth-text-button" data-auth-mode="reset">Forgot password?</button>'}</div><p class="auth-shared-note">Uncheck this on a shared device.</p>`}
          <button type="submit" class="button dark auth-submit" data-auth-submit data-label="${submitLabel}">${submitLabel}</button>
        </fieldset>
      </form>
      <div class="auth-switch">${reset ? '<button type="button" class="auth-text-button" data-auth-mode="signin">Back to sign in</button>' : registration ? 'Already have an account? <button type="button" class="auth-text-button" data-auth-mode="signin">Sign in</button>' : 'New to Axiom? <button type="button" class="auth-text-button" data-auth-mode="register">Create an account</button>'}</div>`;
  }

  function accountMarkup() {
    const verified = snapshot.user.emailVerified;
    return `<div class="auth-card-heading"><span class="auth-account-avatar" data-account-avatar aria-hidden="true"></span><div class="eyebrow">YOUR AXIOM ACCOUNT</div><h1 id="${scope}-heading" tabindex="-1">Hi, <span data-account-name></span><span class="purple-text">.</span></h1><p>A little space for your curious mind.</p></div>
      <dl class="auth-account-details"><div><dt>Email address</dt><dd data-account-email></dd></div><div><dt>Email verification</dt><dd><span class="auth-verification ${verified ? 'is-verified' : ''}">${icon(verified ? 'check' : 'clock', 14)} ${verified ? 'Verified' : 'Check your inbox'}</span></dd></div></dl>
      ${verified ? '' : `<div class="auth-verification-note"><h3>One small step left</h3><p>Open the verification email to confirm your address, then come back here. Check your spam folder if it hasn’t arrived.</p><div class="auth-verification-actions"><button type="button" class="button secondary" data-account-action="refresh">I’ve verified my email</button><button type="button" class="auth-text-button" data-account-action="resend">Send another email</button></div></div>`}
      <div class="auth-account-actions"><button type="button" class="button dark" data-auth-guest>Back to the games ${icon('arrow', 16)}</button><button type="button" class="button secondary" data-account-action="signout">Sign out</button></div>`;
  }

  function render(focusHeading = false) {
    if (disposed) return;
    renderedKey = key(snapshot);
    const signedIn = isAccount();
    if (!signedIn && currentMode === 'account') currentMode = 'signin';
    container.innerHTML = `<div class="auth-layout"><section class="surface auth-card" aria-labelledby="${scope}-heading">${!snapshot.configured ? `<div class="auth-card-heading"><span class="auth-card-icon" aria-hidden="true">${icon('spark', 23)}</span><h1 id="${scope}-heading" tabindex="-1">Your games are ready.</h1><p>Account sign-in is not available yet. You can keep playing every solo game as a guest.</p></div><button type="button" class="button dark auth-submit" data-auth-guest>Explore the games ${icon('arrow', 16)}</button>` : signedIn ? accountMarkup() : formMarkup()}
      <p class="auth-loading" role="status" data-auth-loading hidden>Getting your account ready…</p><div class="auth-status" data-auth-status tabindex="-1" hidden></div>
      ${!signedIn && snapshot.configured ? `<div class="auth-guest-divider"><span>or take your time</span></div><button type="button" class="auth-guest-button" data-auth-guest>Continue as a guest ${icon('arrow', 15)}</button>` : ''}
      <p class="auth-device-note">${icon('shield', 15)}<span>Your game history stays in this browser.<br>Signing in does not sync or back up your progress.</span></p></section>
      <aside class="auth-aside" aria-label="Your Axiom playground"><div class="auth-aside-art" aria-hidden="true"><span class="auth-art-spark">✧</span><div class="auth-art-grid">${Array.from({length: 9}, (_, i) => `<span>${i === 4 ? icon('spark', 29) : i === 0 || i === 8 ? '·' : ''}</span>`).join('')}</div><span class="auth-art-circle"></span></div><span class="eyebrow">YOUR DAILY MINDSPACE</span><h2>A little play.<br>A sharper mind.</h2><p>${games.length} thoughtful games.<br>As much curiosity as you can bring.</p><div class="auth-aside-foot">${icon('check', 16)} All solo games are open to everyone.</div></aside></div>`;

    if (signedIn) {
      const name = snapshot.user.displayName?.trim() || 'there';
      const nameNode = find('[data-account-name]');
      if (nameNode) nameNode.textContent = name;
      const avatar = find('[data-account-avatar]');
      if (avatar) avatar.textContent = (Array.from(snapshot.user.displayName?.trim() || snapshot.user.email || 'A')[0] || 'A').toUpperCase();
      const email = find('[data-account-email]');
      if (email) email.textContent = snapshot.user.email || 'No email address';
    }
    const emailInput = find('input[type="email"]');
    if (emailInput) emailInput.value = rememberedEmail;
    container.querySelectorAll('[data-auth-guest]').forEach(button => { button.onclick = () => navigate('/games'); });
    container.querySelectorAll('[data-auth-mode]').forEach(button => { button.onclick = () => changeMode(button.dataset.authMode); });
    container.querySelectorAll('[data-password-toggle]').forEach(button => {
      button.onclick = () => {
        const input = find(`#${button.getAttribute('aria-controls')}`);
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.textContent = visible ? 'Hide' : 'Show';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${input.name === 'passwordConfirmation' ? 'confirmation ' : ''}password`);
      };
    });
    const form = find('form');
    if (form) {
      form.addEventListener('input', event => {
        if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('');
        if (event.target.name === 'password') form.elements.passwordConfirmation?.setCustomValidity('');
      });
      form.onsubmit = event => {
        event.preventDefault();
        if (busy || snapshot.loading) return;
        const email = form.elements.email.value.trim();
        rememberedEmail = email;
        if (currentMode === 'reset') {
          run(() => client.resetPassword(email), message => setStatus(message, 'success', true));
          return;
        }
        const password = form.elements.password.value;
        const remember = form.elements.remember.checked;
        if (currentMode === 'register') {
          const displayName = form.elements.displayName.value.trim();
          if (displayName.length < 2) {
            form.elements.displayName.setCustomValidity('Please enter a name with at least 2 characters.');
            form.elements.displayName.reportValidity();
            return;
          }
          if (password !== form.elements.passwordConfirmation.value) {
            form.elements.passwordConfirmation.setCustomValidity('Your passwords don’t match. Please try again.');
            form.elements.passwordConfirmation.reportValidity();
            return;
          }
          run(() => client.register({displayName, email, password, remember}), result => {
            currentMode = 'account';
            statusMessage = result.warning || (result.verificationSent ? 'Account created. We’ve sent a verification link to your email.' : 'Account created. Please verify your email address.');
            statusTone = result.warning ? 'info' : 'success';
            render(true);
          });
        } else {
          run(() => client.signIn({email, password, remember}), () => {
            currentMode = 'account';
            statusMessage = 'You’re signed in. Ready when you are.';
            statusTone = 'success';
            render(true);
          });
        }
      };
    }
    container.querySelectorAll('[data-account-action]').forEach(button => {
      button.onclick = () => {
        if (button.dataset.accountAction === 'signout') {
          run(() => client.signOut(), () => {
            currentMode = 'signin';
            statusMessage = 'You’re signed out. Your game history is still on this browser.';
            statusTone = 'success';
            render(true);
          });
        } else if (button.dataset.accountAction === 'resend') {
          run(() => client.resendVerification(), () => setStatus('Verification email sent. Check your inbox and spam folder.', 'success', true));
        } else {
          run(() => client.refreshUser(), user => {
            statusMessage = user?.emailVerified ? 'Your email is verified. You’re all set.' : 'Your email is not verified yet. Open the link in your email, then check again.';
            statusTone = user?.emailVerified ? 'success' : 'info';
            render(true);
          });
        }
      };
    });
    setStatus(statusMessage, statusTone);
    updatePending();
    if (focusHeading) find(`#${scope}-heading`)?.focus();
  }

  render();
  const unsubscribe = client.subscribe(next => {
    if (disposed) return;
    const previousKey = key(snapshot);
    snapshot = next;
    if (busy) return;
    if (previousKey !== key(snapshot)) {
      statusMessage = '';
      render();
    } else {
      updatePending();
    }
    if (snapshot.error) setStatus(snapshot.error, 'error');
  });
  Promise.resolve().then(() => disposed ? undefined : client.initialize()).catch(error => {
    if (!disposed) setStatus(error instanceof Error ? error.message : 'Sign-in could not load. Please try again.', 'error');
  });

  return () => {
    disposed = true;
    operationId++;
    unsubscribe();
    container.removeAttribute('aria-busy');
    // Remove password fields and their handlers as soon as this view is left.
    container.replaceChildren();
  };
}
