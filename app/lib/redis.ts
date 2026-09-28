const store = new Map<string, string>();

export const redis = {
  async set(key: string, value: string): Promise<'OK'> {
    store.set(key, value);
    return 'OK';
  },

  async get(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  },

  async del(key: string): Promise<number> {
    return store.delete(key) ? 1 : 0;
  },
};