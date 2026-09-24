function onAddCalendar(e) {
  const fi = ((e || {}).commonEventObject || {}).formInputs || {};
  let primary = '';
  try { primary = Session.getActiveUser().getEmail(); } catch (_) {}
  if (!primary) primary = getSettings_().calendars[0] || '';
  const sources = [];
  for (let i = 1; i < MAX_CALENDARS; i++) {
    const key = 'cal' + i;
    if (!fi[key]) break;
    sources.push(fi[key].stringInputs.value[0] || '');
  }
  sources.push('');
  const calendars  = [primary, ...sources];
  const pastDays   = readIntField_(fi, 'pastDays',   DEFAULT_PAST_DAYS);
  const futureDays = readIntField_(fi, 'futureDays', DEFAULT_FUTURE_DAYS);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(
      buildSetupCard_({ calendars, pastDays, futureDays })
    ))
    .build();
}

function onSaveSettings(e) {
  const fi = ((e || {}).commonEventObject || {}).formInputs || {};
  // Primary is the running account — not submitted via form (read-only display)
  let primaryEmail = '';
  try { primaryEmail = Session.getActiveUser().getEmail().trim().toLowerCase(); } catch (_) {}
  if (!primaryEmail) primaryEmail = (getSettings_().calendars[0] || '').trim().toLowerCase();

  const seen = new Set([primaryEmail].filter(Boolean));
  const sources = [];
  for (let i = 1; i < MAX_CALENDARS; i++) {
    const key = 'cal' + i;
    if (!fi[key]) break;
    const v = (fi[key].stringInputs.value[0] || '').trim().toLowerCase();
    if (v && !seen.has(v)) { seen.add(v); sources.push(v); }
  }
  const calendars = primaryEmail ? [primaryEmail, ...sources] : sources;

  if (calendars.length < 2) {
    return notify_('Add at least 1 source calendar.', 'error');
  }

  const pastRaw    = fi['pastDays']   && fi['pastDays'].stringInputs   && fi['pastDays'].stringInputs.value[0];
  const futureRaw  = fi['futureDays'] && fi['futureDays'].stringInputs && fi['futureDays'].stringInputs.value[0];
  const pastDays   = parseInt(pastRaw,   10);
  const futureDays = parseInt(futureRaw, 10);

  if (isNaN(pastDays)   || pastDays   < 1 || pastDays   > 365) {
    return notify_('Days in the past must be a number between 1 and 365.', 'error');
  }
  if (isNaN(futureDays) || futureDays < 1 || futureDays > 365) {
    return notify_('Days in the future must be a number between 1 and 365.', 'error');
  }

  const prevCals   = getSettings_().calendars;
  const oldPrimary = prevCals[0] || null;
  const newPrimary = calendars[0];
  if (oldPrimary && oldPrimary !== newPrimary) {
    userProps_().setProperty('prev_primary', oldPrimary);
  }
  saveSettings_(calendars, pastDays, futureDays);
  clearSyncTokens_();
  // Unpause only calendars that weren't in the previous config.
  // Existing paused calendars keep their paused state.
  calendars.forEach(calId => {
    if (!prevCals.includes(calId)) setPausedCal_(calId, false);
  });
  clearAllManagedTriggers_();
  scheduleBackground_('initialSync');

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('✅  Settings saved. Sync starting...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onStartSync() {
  scheduleBackground_('startSync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('🔄  Sync starting...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onStopSync() {
  // clearAllManagedTriggers_ instead of deleteTrigger_ to prevent orphan triggers
  // (triggers not tracked by PROP_TRIGGER_ID) from continuing to fire after pause.
  clearAllManagedTriggers_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('✅  Sync paused.'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onFullResync() {
  return onRunNow();
}

function onRunNow() {
  if (userProps_().getProperty(PROP_PENDING_OP)) {
    return notify_('Sync already in progress. Please wait.', 'warning');
  }
  scheduleBackground_('fullResync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('🔄  Sync starting...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onPauseCalendar(e) {
  const params = ((e || {}).commonEventObject || {}).parameters || {};
  setPausedCal_(params.calId, params.paused === 'true');
  return CardService.newActionResponseBuilder()
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onPauseAll() {
  clearAllManagedTriggers_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('✅  Sync paused.'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onResumeAll() {
  scheduleBackground_('startSync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('🔄  Sync resuming...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onCleanupMirrors() {
  scheduleBackground_('cleanup');
  return notify_('Removing all sync blocks in background...', 'working');
}

function onReconfigure() {
  const s = getSettings_();
  return CardService.newActionResponseBuilder()
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(
      buildSetupCard_(s.calendars.length
        ? { calendars: s.calendars, pastDays: s.pastDays, futureDays: s.futureDays }
        : undefined)
    ))
    .build();
}

function onCancelReconfigure() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}


function onRemoveCalendar(e) {
  const fi     = ((e || {}).commonEventObject || {}).formInputs || {};
  const params = ((e || {}).commonEventObject || {}).parameters || {};
  const idx    = parseInt(params.index, 10);
  let primary = '';
  try { primary = Session.getActiveUser().getEmail(); } catch (_) {}
  if (!primary) primary = getSettings_().calendars[0] || '';
  const sources = [];
  for (let i = 1; i < MAX_CALENDARS; i++) {
    const key = 'cal' + i;
    if (!fi[key]) break;
    sources.push(fi[key].stringInputs.value[0] || '');
  }
  sources.splice(idx - 1, 1);
  const calendars  = [primary, ...sources];
  const pastDays   = readIntField_(fi, 'pastDays',   DEFAULT_PAST_DAYS);
  const futureDays = readIntField_(fi, 'futureDays', DEFAULT_FUTURE_DAYS);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(
      buildSetupCard_({ calendars, pastDays, futureDays })
    ))
    .build();
}

function onStopAndClear() {
  const s = getSettings_();
  const p = userProps_();
  if (s.calendars.length) {
    // Store only the primary calendar — mirrors only ever live there.
    p.setProperty('pending_cleanup_primary', s.calendars[0]);
  }
  // Preserve the sync group ID for the background cleanup BEFORE deleting it from
  // user properties; the background op reads it to run the shared-property query.
  if (s.syncGroup) p.setProperty('pending_cleanup_sg', s.syncGroup);
  p.deleteProperty(PROP_CALENDARS);
  p.deleteProperty(PROP_SYNC_GROUP);
  p.deleteProperty(PROP_PAST_DAYS);
  p.deleteProperty(PROP_FUTURE_DAYS);
  clearSyncTokens_();
  clearAllManagedTriggers_();
  scheduleBackground_('stopAndClear');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('✅  Sync stopped. Removing blocks in background...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onShowCalendarInfo() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildInfoCard_()))
    .build();
}

function onBackFromInfo() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

// type: 'success' | 'error' | 'warning' | 'working' (default: no prefix)
function notify_(text, type) {
  const prefix = { success: '✅  ', error: '❌  ', warning: '⚠️  ', working: '🔄  ' }[type] || '';
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(prefix + text))
    .build();
}
