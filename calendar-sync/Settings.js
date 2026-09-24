function userProps_() {
  return PropertiesService.getUserProperties();
}

function getSettings_() {
  const p          = userProps_();
  const calsJson   = p.getProperty(PROP_CALENDARS);
  const calendars  = calsJson ? JSON.parse(calsJson) : [];
  const triggerId  = p.getProperty(PROP_TRIGGER_ID) || null;
  const syncGroup  = p.getProperty(PROP_SYNC_GROUP) || '';
  const pastDays   = parseInt(p.getProperty(PROP_PAST_DAYS),   10) || DEFAULT_PAST_DAYS;
  const futureDays = parseInt(p.getProperty(PROP_FUTURE_DAYS), 10) || DEFAULT_FUTURE_DAYS;
  const lastSync   = p.getProperty(PROP_LAST_SYNC) || null;
  const nextRun    = p.getProperty(PROP_NEXT_RUN)  || null;
  return { calendars, triggerId, syncGroup, pastDays, futureDays, lastSync, nextRun };
}

function saveSettings_(calendars, pastDays, futureDays) {
  const p = userProps_();
  p.setProperty(PROP_CALENDARS,   JSON.stringify(calendars));
  p.setProperty(PROP_PAST_DAYS,   String(pastDays));
  p.setProperty(PROP_FUTURE_DAYS, String(futureDays));
  if (!p.getProperty(PROP_SYNC_GROUP)) {
    p.setProperty(PROP_SYNC_GROUP, Utilities.getUuid());
  }
}

function getPausedCals_() {
  const json = userProps_().getProperty(PROP_PAUSED_CALS);
  return json ? JSON.parse(json) : [];
}

function isPausedCal_(calId) {
  return getPausedCals_().includes(calId);
}

function setPausedCal_(calId, paused) {
  const p   = userProps_();
  let   arr = getPausedCals_();
  if (paused) {
    if (!arr.includes(calId)) arr.push(calId);
  } else {
    arr = arr.filter(id => id !== calId);
  }
  p.setProperty(PROP_PAUSED_CALS, JSON.stringify(arr));
}

function clearPausedCals_() {
  userProps_().deleteProperty(PROP_PAUSED_CALS);
}

function clearSyncTokens_() {
  const p    = userProps_();
  const keys = p.getKeys().filter(k => k.startsWith('syncToken_'));
  keys.forEach(k => p.deleteProperty(k));
}
