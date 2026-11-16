// The router: hash-based routing that maps the four routes to their views and
// wires up the header jump-search. window.__shotReady flips to true only once a
// route's data is rendered, so the screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { board, bounty, errorState, leaderboard, profile } from './views.js';
import { esc } from './format.js';

const app = document.getElementById('app');
const jumpForm = document.getElementById('jump-form');
const jumpInput = document.getElementById('jump-input');
const navLink = document.querySelector('[data-nav="board"]');

/** The open bounties the board is showing, held here so board search/sort can filter them. */
let boardItems = [];

/** The id of the current 1-second ticker, cleared on every route change. */
let tickerId = null;

/** Stop the previous ticker before a new route starts one. */
function stopTicker() {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

/**
 * A 1-second ticker that refreshes every "time left" label on the page. It only
 * touches elements with a data-tick attribute (the deadline), so the rest of the
 * page is left alone.
 */
function startTicker() {
  stopTicker();
  const refresh = () => {
    for (const el of app.querySelectorAll('[data-tick]')) {
      const iso = el.getAttribute('data-tick');
      const left = remaining(iso);
      if (left !== null) el.textContent = left;
    }
  };
  refresh();
  tickerId = setInterval(refresh, 1000);
}

/** '2d 4h' / '4h 12m' / '12m' / 'ended' for a deadline, or null when it is not a date. */
function remaining(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** The loading placeholder shown while a route fetches. */
function loadingState() {
  return `<div class="state-card"><p class="muted">Loading…</p></div>`;
}

/** Mark the Board nav link active when it is the current view. */
function setNav(active) {
  navLink.classList.toggle('is-active', active === 'board');
}

async function render() {
  window.__shotReady = false;
  stopTicker();
  const hash = location.hash || '#/';
  app.innerHTML = loadingState();
  setNav(hash === '#/' ? 'board' : '');
  document.title = 'make.fun — bounties, leaderboards, profiles';
  window.scrollTo(0, 0);

  // #/  or  #/board
  if (hash === '#/' || hash === '#/board') {
    try {
      const data = await getBounties();
      boardItems = data.items || [];
      document.title = 'Open bounties — make.fun';
      app.innerHTML = board(data);
      wireBoardControls(boardItems);
      startTicker();
    } catch (err) {
      app.innerHTML = errorState(err.message);
      wireRetry();
    }
    window.__shotReady = true;
    return;
  }

  // #/bounty/<slug>  or  #/bounty/<slug>/leaderboard
  const bountyMatch = hash.match(/^#\/bounty\/([^/]+)(?:\/leaderboard)?$/);
  if (bountyMatch) {
    const slug = decodeURIComponent(bountyMatch[1]);
    const isLeaderboard = hash.endsWith('/leaderboard');
    try {
      const bountyData = await getBounty(slug);
      if (isLeaderboard) {
        const lb = await getLeaderboard(slug);
        document.title = `${bountyData.title} — leaderboard | make.fun`;
        app.innerHTML = leaderboard(lb, slug, bountyData.title);
      } else {
        document.title = `${bountyData.title} | make.fun`;
        app.innerHTML = bounty(bountyData);
        startTicker();
      }
    } catch (err) {
      app.innerHTML = errorState(err.message);
      wireRetry();
    }
    window.__shotReady = true;
    return;
  }

  // #/profile/<handle>
  const profileMatch = hash.match(/^#\/profile\/([^/]+)/);
  if (profileMatch) {
    const handle = decodeURIComponent(profileMatch[1]);
    try {
      const data = await getProfile(handle);
      document.title = `@${data.handle} — make.fun`;
      app.innerHTML = profile(data);
    } catch (err) {
      app.innerHTML = errorState(`No profile found for “${esc(handle)}”. ${err.message}`);
      wireRetry();
    }
    window.__shotReady = true;
    return;
  }

  // Unknown route: show an error.
  app.innerHTML = errorState(`Unknown route ${esc(hash)}.`);
  window.__shotReady = true;
}

/** Board-only: search, sort and category chips over the already-fetched items. */
function wireBoardControls(items) {
  const root = document.getElementById('board');
  const tallyEl = document.getElementById('board-tally');
  const searchEl = document.getElementById('board-q');
  const sortEl = document.getElementById('board-sort');
  if (!root) return;
  const cards = [...root.querySelectorAll('.card')];
  let activeCat = '';

  const applyFilters = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    const filtered = items
      .map((b, i) => ({ bounty: b, card: cards[i] }))
      .filter(
        ({ bounty, card }) =>
          card &&
          (!activeCat || bounty.category === activeCat) &&
          (!q || (bounty.title + ' ' + (bounty.skills || []).join(' ')).toLowerCase().includes(q)),
      );

    const sortKey = sortEl?.value || 'pot';
    filtered.sort((a, b) => {
      const x = a.bounty;
      const y = b.bounty;
      if (sortKey === 'pot') return (Number(y.potUsd) || Number(y.rewardAmount) || 0) - (Number(x.potUsd) || Number(x.rewardAmount) || 0);
      if (sortKey === 'deadline') return new Date(x.deadline).getTime() - new Date(y.deadline).getTime();
      if (sortKey === 'entries') return (Number(y.submissionCount) || 0) - (Number(x.submissionCount) || 0);
      return x.title.localeCompare(y.title);
    });

    root.querySelectorAll('.card').forEach((el) => (el.hidden = true));
    filtered.forEach(({ card }) => (card.hidden = false));
    // Show a friendly note when a search or category leaves the board empty.
    let empty = document.getElementById('board-empty');
    if (filtered.length === 0 && !empty) {
      empty = document.createElement('p');
      empty.id = 'board-empty';
      empty.className = 'muted board-empty';
      empty.textContent = 'No bounties match.';
      root.after(empty);
    } else if (empty && filtered.length > 0) {
      empty.remove();
    }
    if (tallyEl) tallyEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'bounty' : 'bounties'}`;
  };

  searchEl?.addEventListener('input', applyFilters);
  sortEl?.addEventListener('change', applyFilters);
  document.getElementById('chip-row')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    activeCat = btn.getAttribute('data-cat') || '';
    document.querySelectorAll('.chip-btn').forEach((b) => b.classList.toggle('is-on', b === btn));
    applyFilters();
  });
}

/** Wire the retry button after an error. */
function wireRetry() {
  document.getElementById('retry')?.addEventListener('click', render);
}

jumpForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = jumpInput.value.trim();
  if (!q) return;
  const encoded = encodeURIComponent(q);
  // Bounty slugs and profile handles rarely collide; prefer a bounty, fall back to a profile.
  location.hash = `#/bounty/${encoded}`;
  jumpInput.value = '';
});

window.addEventListener('hashchange', render);
render();