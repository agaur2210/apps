function onAddCalendar(e) {
  const fi        = ((e || {}).commonEventObject || {}).formInputs || {};
  const calendars = readFields_(fi, 'cal');
  calendars.push('');
  const pastDays   = readIntField_(fi, 'pastDays',   DEFAULT_PAST_DAYS);
  const futureDays = readIntField_(fi, 'futureDays', DEFAULT_FUTURE_DAYS);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(
      buildSetupCard_({ calendars, pastDays, futureDays })
    ))
    .build();
}

function onSaveSettings(e) {
  const fi   = ((e || {}).commonEventObject || {}).formInputs || {};
  const seen = new Set();
  const calendars = readFields_(fi, 'cal')
    .map(v => v.trim().toLowerCase())
    .filter(v => v && !seen.has(v) && seen.add(v));

  if (calendars.length < 2) {
    return notify_('Add at least 2 calendar emails.');
  }

  const pastDays   = readIntField_(fi, 'pastDays',   DEFAULT_PAST_DAYS);
  const futureDays = readIntField_(fi, 'futureDays', DEFAULT_FUTURE_DAYS);

  if (pastDays < 1 || futureDays < 1) {
    return notify_('Sync window days must be at least 1.');
  }

  const prevCals = getSettings_().calendars;
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
    .setNotification(CardService.newNotification().setText('Settings saved. Sync starting in background...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onStartSync() {
  scheduleBackground_('startSync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync starting...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onStopSync() {
  deleteTrigger_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync paused.'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onFullResync() {
  return onRunNow();
}

function onRunNow() {
  scheduleBackground_('fullResync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync starting...'))
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
  deleteTrigger_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync paused.'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onResumeAll() {
  scheduleBackground_('startSync');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync resuming...'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onCleanupMirrors() {
  scheduleBackground_('cleanup');
  return notify_('Removing all sync blocks in background...');
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

function onRefreshStatus() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onRemoveCalendar(e) {
  const fi       = ((e || {}).commonEventObject || {}).formInputs || {};
  const params   = ((e || {}).commonEventObject || {}).parameters || {};
  const idx      = parseInt(params.index, 10);
  const calendars  = readFields_(fi, 'cal');
  const pastDays   = readIntField_(fi, 'pastDays',   DEFAULT_PAST_DAYS);
  const futureDays = readIntField_(fi, 'futureDays', DEFAULT_FUTURE_DAYS);
  calendars.splice(idx, 1);
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
  p.deleteProperty(PROP_CALENDARS);
  p.deleteProperty(PROP_SYNC_GROUP);
  p.deleteProperty(PROP_PAST_DAYS);
  p.deleteProperty(PROP_FUTURE_DAYS);
  clearSyncTokens_();
  clearAllManagedTriggers_();
  scheduleBackground_('stopAndClear');
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync stopped. Removing sync blocks in background...'))
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

function notify_(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}
