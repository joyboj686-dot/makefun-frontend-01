// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every request goes through `get`, which keeps a small in-memory cache so a
// back-nav or a re-render does not re-fetch the same JSON. The cache holds at
// most 64 entries and evicts oldest-first (LRU), keeping memory bounded on a
// board of many bounties.

const API = 'https://make.fun/api';

const cache = new Map();
const MAX_CACHE = 64;

async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(API + path);
  if (!res.ok) {
    const err = new Error(`make.fun answered ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(path, data);
  return data;
}

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { entries: [...] }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);