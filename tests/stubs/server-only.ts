// vitest stub for `server-only` — the real package throws when imported from a
// non-server context (e.g., vitest node/jsdom). Tests that import src/lib/db
// (e.g., tenant-guard, jwt) don't actually need server-only enforcement.
export {};