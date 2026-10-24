import { AUTH_CONFIG } from './auth-config.js';

const SDK_VERSION = '13.1.0';
const EMAIL_ACTION_URL = 'https://trying-ai.github.io/axiom-play/#/account';
const RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.';
const CREDENTIAL_MESSAGE = 'Unable to sign in with those details. Check your email and password, or reset your password.';

class AuthClientError extends Error {
  constructor(message) { super(message); this.name = 'AuthClientError'; }
}

export function authErrorMessage(error) {
  if (error instanceof AuthClientError) return error.message;
  switch (error?.code) {
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/user-disabled': return CREDENTIAL_MESSAGE;
    case 'auth/email-already-in-use':
    case 'auth/account-exists-with-different-credential': return 'Unable to create an account with those details. Try signing in or resetting your password.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'Choose a stronger password with at least 8 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed': return 'Could not connect to sign-in. Check your internet connection and try again.';
    case 'auth/web-storage-unsupported': return 'Your browser is blocking sign-in storage. Allow site storage and try again.';
    case 'auth/requires-recent-login': return 'Please sign out and sign in again before trying that action.';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed': return 'Sign-in is unavailable right now. You can still play as a guest.';
    default: return 'Something went wrong with sign-in. Please try again. You can still play as a guest.';
  }
}

function safeError(error) { return new AuthClientError(authErrorMessage(error)); }

export function isAuthConfigured(config) {
  return ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => typeof config?.[key] === 'string' && config[key].trim().length > 0);
}

export function normalizeEmail(email) {
  const value = typeof email === 'string' ? email.trim() : '';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) throw new AuthClientError('Enter a valid email address.');
  return value;
}

export function validateRegistration({ displayName, email, password } = {}) {
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  if ([...name].length < 2 || [...name].length > 40 || /[\u0000-\u001f\u007f]/u.test(name)) {
    throw new AuthClientError('Use a display name between 2 and 40 characters.');
  }
  const normalizedEmail = normalizeEmail(email);
  if (typeof password !== 'string' || [...password].length < 8 || [...password].length > 128) {
    throw new AuthClientError('Use a password between 8 and 128 characters.');
  }
  return { displayName: name, email: normalizedEmail, password };
}

function publicUser(user) {
  if (!user) return null;
  return Object.freeze({
    uid: typeof user.uid === 'string' ? user.uid : '',
    displayName: typeof user.displayName === 'string' ? user.displayName : '',
    email: typeof user.email === 'string' ? user.email : '',
    emailVerified: user.emailVerified === true,
  });
}

// Loaded only after initialize() is requested. No Firebase hosting, database,
// analytics, or game code is involved in this authentication adapter.
async function loadFirebaseModules() {
  const [appSdk, sdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
  ]);
  return { appSdk, sdk };
}

export async function createFirebaseAdapter(config, { loadSdk = loadFirebaseModules } = {}) {
  const { appSdk, sdk } = await loadSdk();
  const appName = 'axiom-auth';
  const app = appSdk.getApps().find(existing => existing.name === appName) || appSdk.initializeApp(config, appName);
  const instance = sdk.getAuth(app);
  sdk.useDeviceLanguage(instance);
  return {
    subscribe: (next, error) => sdk.onAuthStateChanged(instance, next, error),
    ready: () => instance.authStateReady(),
    getUser: () => instance.currentUser,
    setPersistence: remember => sdk.setPersistence(instance, remember ? sdk.browserLocalPersistence : sdk.browserSessionPersistence),
    signIn: (email, password) => sdk.signInWithEmailAndPassword(instance, email, password),
    register: (email, password) => sdk.createUserWithEmailAndPassword(instance, email, password),
    updateProfile: (user, profile) => sdk.updateProfile(user, profile),
    sendVerification: user => sdk.sendEmailVerification(user, { url: EMAIL_ACTION_URL }),
    resetPassword: email => sdk.sendPasswordResetEmail(instance, email, { url: EMAIL_ACTION_URL }),
    reload: user => sdk.reload(user),
    signOut: () => sdk.signOut(instance),
    getIdToken: forceRefresh => instance.currentUser ? sdk.getIdToken(instance.currentUser, forceRefresh) : Promise.resolve(null),
  };
}

// The injected adapter keeps authentication behavior testable without credentials
// or network requests. Only the default adapter handles passwords and tokens.
export function createAuthClient({ config = AUTH_CONFIG, loadAdapter = createFirebaseAdapter, initializeTimeoutMs = 12000 } = {}) {
  const configured = isAuthConfigured(config);
  const listeners = new Set();
  let adapter = null;
  let stopObserving = null;
  let initializePromise = null;
  let initializationGeneration = 0;
  let initializing = false;
  let operationPending = false;
  let state = Object.freeze({ status: configured ? 'idle' : 'unconfigured', configured, loading: false, user: null, error: null });

  function publish(patch = {}) {
    const next = { ...state, ...patch, loading: initializing || operationPending };
    next.status = !configured ? 'unconfigured' : next.loading ? 'loading' : next.error && !adapter ? 'error' : next.user ? 'signed-in' : 'signed-out';
    state = Object.freeze(next);
    for (const listener of listeners) {
      // A failing view must not interrupt session changes or a successful login.
      try { listener(state); } catch { /* The view owns its rendering errors. */ }
    }
    return state;
  }

  async function initialize() {
    if (!configured) return state;
    if (initializePromise) return initializePromise;
    if (adapter) return state;
    const generation = ++initializationGeneration;
    initializing = true;
    publish({ error: null });
    initializePromise = Promise.resolve().then(async () => {
      let stopAttempt = null;
      let timeoutId;
      try {
        const attempt = (async () => {
          const candidate = await loadAdapter(config);
          if (generation !== initializationGeneration) return null;
          stopAttempt = candidate.subscribe(
            user => {
              if (generation === initializationGeneration) publish({ user: publicUser(user), error: null });
            },
            error => {
              if (generation === initializationGeneration) publish({ error: authErrorMessage(error) });
            },
          );
          await candidate.ready();
          return generation === initializationGeneration ? candidate : null;
        })();
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new AuthClientError('Sign-in is taking too long to connect. Please try again. You can still play as a guest.')), initializeTimeoutMs);
        });
        adapter = await Promise.race([attempt, timeout]);
        stopObserving = stopAttempt;
        publish({ user: publicUser(adapter.getUser()), error: null });
      } catch (error) {
        // Abandoned imports or session restores may resolve later. Their state
        // callbacks must never overwrite the result of a subsequent retry.
        initializationGeneration++;
        stopAttempt?.();
        stopObserving?.();
        stopObserving = null;
        adapter = null;
        publish({ user: null, error: authErrorMessage(error) });
        throw safeError(error);
      } finally {
        clearTimeout(timeoutId);
        initializing = false;
        initializePromise = null;
        publish();
      }
      return state;
    });
    return initializePromise;
  }

  async function perform(action) {
    if (!configured) throw new AuthClientError('Sign-in is not available yet. You can still play as a guest.');
    if (operationPending) throw new AuthClientError('Please wait for the current account action to finish.');
    operationPending = true;
    publish({ error: null });
    try {
      await initialize();
      const result = await action(adapter);
      publish({ user: publicUser(adapter.getUser()), error: null });
      return result;
    } catch (error) {
      publish({ error: authErrorMessage(error) });
      throw safeError(error);
    } finally {
      operationPending = false;
      publish();
    }
  }

  function requireUser(current) {
    const user = current.getUser();
    if (!user) throw new AuthClientError('Sign in to continue.');
    return user;
  }

  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('An authentication listener is required.');
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    initialize,
    async signIn({ email, password, remember = true } = {}) {
      const normalizedEmail = normalizeEmail(email);
      if (typeof password !== 'string' || !password.length) throw new AuthClientError('Enter your password.');
      return perform(async current => {
        await current.setPersistence(remember === true);
        const credential = await current.signIn(normalizedEmail, password);
        return publicUser(credential.user);
      });
    },
    async register({ displayName, email, password, remember = true } = {}) {
      const values = validateRegistration({ displayName, email, password });
      return perform(async current => {
        await current.setPersistence(remember === true);
        const credential = await current.register(values.email, values.password);
        const warnings = [];
        try { await current.updateProfile(credential.user, { displayName: values.displayName }); }
        catch { warnings.push('Your account was created, but your display name could not be saved.'); }
        let verificationSent = false;
        try { await current.sendVerification(credential.user); verificationSent = true; }
        catch { warnings.push('Your account was created, but the verification email could not be sent. You can resend it from your account.'); }
        return { user: publicUser(current.getUser()), verificationSent, warning: warnings.join(' ') || null };
      });
    },
    async resetPassword(email) {
      const normalizedEmail = normalizeEmail(email);
      return perform(async current => {
        try { await current.resetPassword(normalizedEmail); }
        catch (error) {
          // Match the successful response even if enumeration protection is off.
          if (error?.code !== 'auth/user-not-found') throw error;
        }
        return RESET_MESSAGE;
      });
    },
    resendVerification: () => perform(async current => {
      const user = requireUser(current);
      if (!user.emailVerified) await current.sendVerification(user);
      return publicUser(user);
    }),
    refreshUser: () => perform(async current => {
      const user = requireUser(current);
      await current.reload(user);
      return publicUser(current.getUser());
    }),
    signOut: () => perform(current => current.signOut()),
    async getIdToken(forceRefresh = false) {
      if (!configured) return null;
      try {
        await initialize();
        return await adapter.getIdToken(forceRefresh === true);
      } catch (error) { throw safeError(error); }
    },
  });
}

export const auth = createAuthClient();
