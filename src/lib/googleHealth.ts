// Fitbit steps through the Google Health API, straight from the phone.
// Sign-in uses Google Identity Services' token model (no client secret, no server).
// The OAuth client ID is public config kept on this device; access tokens live in memory only.

import { addDays, todayKey } from '../domain/dates';
import { parseStepsRollup } from '../domain/steps';

const CLIENT_ID_STORAGE = 'gymsim:google-client-id';
const CONNECTED_STORAGE = 'gymsim:google-connected';
export const STEPS_SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
const API = 'https://health.googleapis.com/v4';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

function read(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
}

export const getClientId = () => read(CLIENT_ID_STORAGE);
export const setClientId = (id: string) => write(CLIENT_ID_STORAGE, id.trim());
/** Has the person connected on this device (so we may renew silently)? */
export const isConnected = () => read(CONNECTED_STORAGE) === '1' && !!getClientId();

let token: { value: string; expiresAt: number } | null = null;
/** Is there a usable access token in memory (so a sync needs no Google popup)? */
export const hasFreshToken = () => !!token && token.expiresAt > Date.now() + 60_000;

export class StepsError extends Error {
  constructor(message: string, readonly kind: 'signin' | 'setup' | 'network' | 'other') {
    super(message);
  }
}

// --- Google Identity Services ------------------------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
      hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
    };
  };
}

let gisPromise: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisPromise ??= new Promise<Gis>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = GIS_SRC;
    el.async = true;
    el.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Google sign-in failed to load')));
    el.onerror = () => {
      gisPromise = null;
      reject(new StepsError("Couldn't load Google sign-in. Check your connection.", 'network'));
    };
    document.head.appendChild(el);
  });
  return gisPromise;
}

/**
 * Gets an access token. `interactive` shows Google's consent popup (needs a tap);
 * otherwise it tries a silent renewal for someone who connected before.
 */
async function getToken(interactive: boolean): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const clientId = getClientId();
  if (!clientId) throw new StepsError('Add your Google OAuth client ID under You → Fitbit steps first.', 'setup');
  const gis = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: STEPS_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new StepsError(r.error === 'access_denied' ? 'Access to your steps was not allowed.' : 'Google sign-in did not finish. Try again.', 'signin'));
          return;
        }
        if (!gis.accounts.oauth2.hasGrantedAllScopes(r, STEPS_SCOPE)) {
          reject(new StepsError('Tick "activity and fitness" on the Google screen so GymSim can read your steps.', 'signin'));
          return;
        }
        token = { value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
        write(CONNECTED_STORAGE, '1');
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(new StepsError(e?.type === 'popup_closed' ? 'Sign-in was closed before it finished.' : 'Tap Sync to sign in to Google again.', 'signin')),
    });
    client.requestAccessToken(interactive ? { prompt: 'consent' } : { prompt: '' });
  });
}

/** Connect (shows Google's consent screen). */
export async function connect(): Promise<void> {
  await getToken(true);
}

export function disconnect() {
  const t = token?.value;
  token = null;
  write(CONNECTED_STORAGE, null);
  if (t) loadGis().then((g) => g.accounts.oauth2.revoke(t)).catch(() => undefined);
}

// --- Steps --------------------------------------------------------------------

const civil = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return { date: { year, month, day } };
};

/** Daily step totals for the last `days` days (today included). */
export async function fetchSteps(opts: { interactive?: boolean; days?: number } = {}): Promise<Record<string, number>> {
  const days = opts.days ?? 30;
  const today = todayKey();
  const access = await getToken(!!opts.interactive);
  let res: Response;
  try {
    res = await fetch(`${API}/users/me/dataTypes/steps/dataPoints:dailyRollUp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: { start: civil(addDays(today, -(days - 1))), end: civil(addDays(today, 1)) }, windowSizeDays: 1, pageSize: Math.min(90, days + 1) }),
    });
  } catch {
    throw new StepsError("Couldn't reach Google. Check your connection and try again.", 'network');
  }
  if (res.status === 401) {
    token = null;
    throw new StepsError('Your Google sign-in expired. Tap Sync to sign in again.', 'signin');
  }
  if (res.status === 403) {
    const text = await res.text().catch(() => '');
    throw new StepsError(
      /SERVICE_DISABLED|has not been used|is disabled/i.test(text)
        ? 'The Google Health API is not enabled in your Google Cloud project. Turn it on, then try again.'
        : "Google refused access to your steps. Check you're a test user on the consent screen.",
      'setup',
    );
  }
  if (!res.ok) throw new StepsError(`Google returned an error (${res.status}). Try again later.`, 'other');
  return parseStepsRollup(await res.json());
}
