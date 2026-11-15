/** Share active requests and reuse successful values until their TTL expires. */
export function createAsyncCache({ ttl = 60_000, now = Date.now } = {}) {
  const entries = new Map();

  return {
    get(key, loader) {
      const cached = entries.get(key);
      if (cached?.promise) return cached.promise;
      if (cached && now() < cached.expiresAt) return Promise.resolve(cached.value);

      const entry = { promise: null, value: undefined, expiresAt: 0 };
      entries.set(key, entry);
      entry.promise = Promise.resolve()
        .then(loader)
        .then((value) => {
          entry.value = value;
          entry.expiresAt = now() + ttl;
          return value;
        })
        .catch((error) => {
          // An invalidated request must not evict its newer replacement.
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        })
        .finally(() => {
          entry.promise = null;
        });
      return entry.promise;
    },

    // Eviction does not cancel callers already awaiting an active request.
    invalidate(key) {
      entries.delete(key);
    },

    clear() {
      entries.clear();
    },
  };
}
