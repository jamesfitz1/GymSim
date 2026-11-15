// The physio assistant's Anthropic API key: device-level, never part of a profile or backup.
// Kept apart from the SDK so screens can read it without loading the SDK.

const KEY_STORAGE = 'gymsim:anthropic-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key.trim());
  } catch {
    /* storage unavailable */
  }
}

export function removeApiKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}
