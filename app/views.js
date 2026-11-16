// The four page views. Each is a pure function from API data to an HTML string
// (built with esc() so untrusted API text is never injected). The router feeds
// each view the data it needs and drops the string into #app.

import { count, date, esc, isLive, money, num, ordinal, timeLeft } from './format.js';

// ---- Small presenters shared across views ----

/** The live prize pot for a bounty: base + paid-in entry fees, else just the reward. */
export const potOf = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee as text: a dollar amount, or the word "Free" when the bounty charges none. */
export const feeOf = (b) => (Number(b.entryFeeUsd) ? money(b.entryFeeUsd) : 'Free');

/** A "Live" / "Ended" pill decided from the deadline, since a past bounty can still say status open. */
export const lifeBadge = (b) =>
  isLive(b.deadline)
    ? `<span class="pill pill-live">Live</span>`
    : `<span class="pill pill-done">Ended</span>`;

/** A single skill, rendered as a small tag. */
const skillChip = (s) => `<span class="chip">${esc(s)}</span>`;

/** A clustered tag row (up to a limit) for a list of skills. */
const skillRow = (skills, limit) => (skills || []).slice(0, limit ?? 8).map(skillChip).join('');

/** The judge win-rate micro-value of a leaderboard row, else its display text, else a dash. */
function entryScore(e) {
  const micro = e?.values?.judge ?? e?.score;
  const text = e?.display?.judge;
  if (micro != null && text != null) return winRate(micro);
  if (text != null) return esc(String(text));
  if (micro != null) return esc(String(micro));
  return '—';
}

/** A score micro-value as a percentage: 850346 -> '85.03%'. */
function winRate(micro) {
  return `${(Number(micro) / 10000).toFixed(2)}%`;
}

/** An avatar URL that points at make.fun's API is rebased to the public host so the browser can load it. */
function absolutePic(url) {
  if (!url) return '';
  return String(url).startsWith('/api/') ? `https://make.fun${url}` : String(url);
}

// ---- Board -------------------------------------------------------------

function bountyCard(b) {
  const live = isLive(b.deadline);
  return `
    <a class="card" href="#/bounty/${encodeURIComponent(b.slug)}">
      <div class="card-head">
        <h3 class="card-title">${esc(b.title)}</h3>
        ${lifeBadge(b)}
      </div>
      <p class="card-cat">${esc(b.category)}</p>
      <dl class="card-facts">
        <div><dt>Pot</dt><dd>${potOf(b)}</dd></div>
        <div><dt>Entry</dt><dd>${feeOf(b)}</dd></div>
        <div><dt>${live ? 'Left' : 'Closed'}</dt><dd data-tick="${b.deadline}">${timeLeft(b.deadline)}</dd></div>
        <div><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
      </dl>
      <div class="chips">${skillRow(b.skills, 3)}</div>
    </a>`;
}

export function board(data) {
  const items = data.items || [];
  const live = items.filter((b) => isLive(b.deadline));
  const openPot = live.reduce((sum, b) => sum + (Number(b.potUsd) || Number(b.rewardAmount) || 0), 0);
  const categories = [...new Set(items.map((b) => b.category).filter(Boolean))].sort();
  const chips = [
    `<button class="chip chip-btn is-on" data-cat="">All</button>`,
    ...categories.map((c) => `<button class="chip chip-btn" data-cat="${esc(c)}">${esc(c)}</button>`),
  ].join('');

  return `
    <section class="intro">
      <h1>Open bounties</h1>
      <p class="muted">Fresh work on make.fun — pick a bounty, join, get paid in USDC.</p>
      <div class="metric-row">
        <div class="metric"><span class="metric-k">${num(live.length)}</span><span class="metric-l">live now</span></div>
        <div class="metric"><span class="metric-k">${money(openPot)}</span><span class="metric-l">total pot</span></div>
        <div class="metric"><span class="metric-k">${num(categories.length)}</span><span class="metric-l">categories</span></div>
      </div>
    </section>
    <div class="toolbar">
      <input id="board-q" class="field search" type="search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
      <select id="board-sort" class="field select" aria-label="Sort bounties">
        <option value="pot">Sort: pot</option>
        <option value="deadline">Sort: deadline</option>
        <option value="entries">Sort: entries</option>
        <option value="title">Sort: title</option>
      </select>
    </div>
    <div class="chips" id="chip-row">${chips}</div>
    <p id="board-tally" class="muted">${num(items.length)} bounties</p>
    <div class="board" id="board">
      ${items.map(bountyCard).join('')}
    </div>`;
}

// ---- Bounty -------------------------------------------------------------

export function bounty(b) {
  const rewardRows = (b.rewardsNow || [])
    .slice(0, 3)
    .map(
      (r) => `
      <tr>
        <td>${ordinal(r.place)}</td>
        <td>${money(r.baseUsd)}</td>
        <td>${money(r.feeShareUsd)}</td>
        <td class="amt">${money(r.amountUsd)}</td>
      </tr>`,
    )
    .join('');

  const entryRows = (b.submissions || [])
    .map(
      (s) => `
      <tr>
        <td><a href="#/profile/${encodeURIComponent(s.hunter)}">${esc(s.hunter)}</a></td>
        <td>${esc(s.title || '—')}</td>
        <td><span class="pill pill-${esc(s.status || 'submitted')}">${esc(s.status || 'submitted')}</span></td>
        <td class="mono">${s.score != null ? winRate(s.score) : '—'}</td>
      </tr>`,
    )
    .join('');

  const feeNote = Number(b.entryFeesUsd)
    ? `Live per-place amounts: base prize plus a share of ${money(b.entryFeesUsd)} in entry fees.`
    : 'Live per-place amounts, calculated from the base prize.';

  return `
    <nav class="crumbs">
      <a href="#/">← All bounties</a>
      ${b.category ? `<span class="sep">/</span> <span class="muted">${esc(b.category)}</span>` : ''}
    </nav>
    <header class="bounty-head">
      <div class="bounty-copy">
        <h1>${esc(b.title)}</h1>
        ${b.summary ? `<p class="muted">${esc(b.summary)}</p>` : ''}
        <div class="chips">${skillRow(b.skills)}</div>
      </div>
      <aside class="fact-card">
        <div class="fact"><span>Pot</span><b class="fact-big">${potOf(b)}</b></div>
        <div class="fact"><span>Entry fee</span><b>${feeOf(b)}</b></div>
        <div class="fact"><span>Deadline</span><b>${date(b.deadline)}</b></div>
        <div class="fact"><span>Time left</span><b class="mono" data-tick="${b.deadline}">${timeLeft(b.deadline)}</b></div>
        <div class="fact"><span>Published</span><b>${date(b.publishedAt)}</b></div>
        <div class="fact"><span>Entries</span><b>${num(b.submissionCount)}</b></div>
        <div class="fact"><span>Status</span><b>${lifeBadge(b)}</b></div>
      </aside>
    </header>

    <section class="block">
      <h2>Rewards</h2>
      <p class="muted">${feeNote}</p>
      <table class="table">
        <thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Total</th></tr></thead>
        <tbody>${rewardRows || `<tr><td colspan="4" class="muted">Rewards not published yet.</td></tr>`}</tbody>
      </table>
    </section>

    ${b.description ? `
    <section class="block">
      <h2>Description</h2>
      <div class="prose">${esc(b.description)}</div>
    </section>` : ''}

    <section class="block">
      <h2>${count(b.submissionCount, 'entry')}</h2>
      <table class="table">
        <thead><tr><th>Hunter</th><th>Title</th><th>Status</th><th>Score</th></tr></thead>
        <tbody>${entryRows || `<tr><td colspan="4" class="muted">No entries yet.</td></tr>`}</tbody>
      </table>
      <p class="muted"><a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Full leaderboard →</a></p>
    </section>`;
}

// ---- Leaderboard -------------------------------------------------------------

export function leaderboard(data, slug, title) {
  const entries = data.entries || [];
  const rows = entries
    .map(
      (e, i) => `
      <tr class="${i < 3 ? 'medal' : ''}">
        <td class="rank">${ordinal(e.rank ?? i + 1)}</td>
        <td><a href="#/profile/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a></td>
        <td class="entry-title">${esc(e.title || '—')}</td>
        <td class="mono">${entryScore(e)}</td>
      </tr>`,
    )
    .join('');

  return `
    <nav class="crumbs">
      <a href="#/">← All bounties</a>
      <span class="sep">/</span>
      <a href="#/bounty/${encodeURIComponent(slug)}">${esc(title || slug)}</a>
    </nav>
    <header class="page-head">
      <h1>Leaderboard</h1>
      <p class="muted">${num(entries.length)} ranked ${entries.length === 1 ? 'entry' : 'entries'} for <strong>${esc(title || slug)}</strong>.</p>
    </header>
    <table class="table">
      <thead><tr><th>Rank</th><th>Hunter</th><th>Entry</th><th>Score</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="muted">No leaderboard yet.</td></tr>`}</tbody>
    </table>`;
}

// ---- Profile -------------------------------------------------------------

export function profile(data) {
  const record = data.record || {};
  const picSrc = absolutePic(data.avatar?.url || data.image);

  const solRows = (data.solutions || [])
    .map(
      (s) => `
      <tr>
        <td><a href="#/bounty/${encodeURIComponent(s.competition?.slug)}">${esc(s.competition?.title || s.competition?.slug)}</a></td>
        <td>${esc(s.title || '—')}</td>
        <td>${s.placement != null ? ordinal(s.placement) : '—'}</td>
        <td>${s.prize_usd != null ? money(s.prize_usd) : '—'}</td>
        <td>${date(s.entered_at)}</td>
      </tr>`,
    )
    .join('');

  const avatar = picSrc
    ? `<img class="avatar" src="${esc(picSrc)}" crossorigin="anonymous" alt="">`
    : `<div class="avatar avatar-fallback">${esc((data.display_name || data.handle || '?').charAt(0).toUpperCase())}</div>`;

  return `
    <header class="profile-head">
      ${avatar}
      <div class="profile-id">
        <h1>${esc(data.display_name || data.handle)}</h1>
        <p class="handle">@${esc(data.handle)}</p>
        ${data.bio ? `<p>${esc(data.bio)}</p>` : ''}
        <p class="muted">Joined ${date(data.joined_at)}</p>
      </div>
      <dl class="record">
        <div><dt>Entered</dt><dd>${num(record.competitions_entered ?? 0)}</dd></div>
        <div><dt>Placed</dt><dd>${num(record.competitions_placed ?? 0)}</dd></div>
        <div><dt>Won</dt><dd>${num(record.competitions_won ?? 0)}</dd></div>
        <div><dt>Podiums</dt><dd>${num(record.podium_finishes ?? 0)}</dd></div>
        <div><dt>Best</dt><dd>${record.best_placement != null ? ordinal(record.best_placement) : '—'}</dd></div>
        <div><dt>Prize</dt><dd>${money(record.prize_usd ?? 0)}</dd></div>
      </dl>
    </header>
    <section class="block">
      <h2>${count((data.solutions || []).length, 'entry')}</h2>
      <table class="table">
        <thead><tr><th>Bounty</th><th>Entry</th><th>Place</th><th>Prize</th><th>Entered</th></tr></thead>
        <tbody>${solRows || `<tr><td colspan="5" class="muted">No entries yet.</td></tr>`}</tbody>
      </table>
    </section>`;
}

/** Reused state block for a view that failed to load. */
export function errorState(message) {
  return `
    <div class="state-card">
      <h1>Something went wrong</h1>
      <p class="muted">${esc(message)}</p>
      <button class="btn" id="retry">Retry</button>
    </div>`;
}