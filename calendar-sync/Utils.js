function readIntField_(fi, name, fallback) {
  const raw = fi[name] && fi[name].stringInputs && fi[name].stringInputs.value[0];
  const n   = parseInt(raw, 10);
  return (n > 0) ? n : fallback;
}

function readFields_(fi, prefix) {
  const out = [];
  for (let i = 0; i < MAX_CALENDARS; i++) {
    const key = prefix + i;
    if (!fi[key]) break;
    out.push(fi[key].stringInputs.value[0] || '');
  }
  return out;
}

function domainLabel_(email) {
  const at = email.indexOf('@');
  return at < 0 ? '' : email.slice(at + 1);
}

function normDate_(f) {
  const o = {};
  if (f.date)     o.date     = f.date;
  if (f.dateTime) o.dateTime = f.dateTime;
  if (f.timeZone) o.timeZone = f.timeZone;
  return o;
}

function privateProps_(ev) {
  return (ev.extendedProperties && ev.extendedProperties.private) || {};
}

function sharedProps_(ev) {
  return (ev.extendedProperties && ev.extendedProperties.shared) || {};
}

function formatLastSync_(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'Just now';
  if (diff < 60) return diff + ' min ago';
  const h = Math.floor(diff / 60);
  return h + (h === 1 ? ' hour ago' : ' hours ago');
}

function hasText_(v) {
  return !!(v && String(v).trim());
}

// Stable 6-char base-36 hash of a calendar ID. Used to namespace fb_ synthetic
// event IDs so they don't shift when the calendar list is reordered or shrunk.
function calHash_(calId) {
  let h = 5381;
  for (let i = 0; i < calId.length; i++) {
    h = (((h << 5) + h) ^ calId.charCodeAt(i)) & 0xffffffff;
  }
  return (h >>> 0).toString(36).padStart(6, '0').slice(-6);
}

function isInWindow_(ev, pastDays, futureDays) {
  const startRaw = ev.start && (ev.start.dateTime || ev.start.date);
  const endRaw   = ev.end   && (ev.end.dateTime   || ev.end.date);
  if (!startRaw) return false;
  const evStart     = new Date(startRaw);
  const evEnd       = endRaw ? new Date(endRaw) : evStart;
  const windowStart = new Date(Date.now() - pastDays   * 86400000);
  const windowEnd   = new Date(Date.now() + futureDays * 86400000);
  return evStart < windowEnd && evEnd > windowStart;
}
