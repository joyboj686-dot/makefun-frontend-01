// Small helpers for showing API values.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00' or 0.5) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** A UTC timestamp as a compact date-time string in the viewer's zone. */
export function date(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** A UTC timestamp as a short date, e.g. 'Nov 15, 2026'. */
export function day(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Is this deadline still in the future? */
export function isLive(iso) {
  return new Date(iso).getTime() > Date.now();
}

/** The time until a deadline, as a compact ticking string: '2d 4h', '4h 12m', '12m'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Pluralise a noun: count(1, 'entry') -> '1 entry'. */
export function count(n, noun) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? noun : noun + 's'}`;
}

/** A short ordinal: 1 -> '1st', 2 -> '2nd', 3 -> '3rd', 4 -> '4th'. */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A compact number: 4210 -> '4,210'. */
export function num(n) {
  return Number(n ?? 0).toLocaleString('en-US');
}

/** A score micro-value as a percentage: 850346 -> '85.03%'. */
export function winRate(micro) {
  if (micro == null) return '—';
  return `${(Number(micro) / 10000).toFixed(2)}%`;
}