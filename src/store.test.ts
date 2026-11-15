import { beforeAll, describe, expect, it } from 'vitest';

// A minimal in-memory localStorage so the store can run under Node.
beforeAll(() => {
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
});

describe('physio API key', () => {
  it('is stored on the device but never included in a profile backup', async () => {
    const { setApiKey, getApiKey } = await import('./lib/apiKey');
    const { profiles, actions } = await import('./store');
    setApiKey('sk-ant-test-secret-123');
    profiles.create({ name: 'Tester' });
    expect(getApiKey()).toBe('sk-ant-test-secret-123');
    expect(actions.exportJson()).not.toContain('sk-ant-test-secret-123');
  });
});
