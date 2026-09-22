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

  saveSettings_(calendars, pastDays, futureDays);
  createTrigger_();
  try { cleanupAllMirrors(); } catch (err) {
    Logger.log('Cleanup before resync error: ' + err);
  }
  try { syncAll_(true, false); } catch (err) {
    Logger.log('Initial sync error: ' + err);
  }

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync started!'))
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildMainCard_()))
    .build();
}

function onStartSync() {
  createTrigger_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync started.'))
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
  clearSyncTokens_();
  try {
    syncAll_(true, false);
    return notify_('Full resync complete.');
  } catch (err) {
    return notify_('Resync error: ' + err.message);
  }
}

function onCleanupMirrors() {
  try {
    cleanupAllMirrors();
    return notify_('All Busy blocks removed.');
  } catch (err) {
    return notify_('Cleanup error: ' + err.message);
  }
}

function onReconfigure() {
  const s = getSettings_();
  deleteTrigger_();
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
  deleteTrigger_();
  clearSyncTokens_();
  const p = userProps_();
  p.deleteProperty(PROP_CALENDARS);
  p.deleteProperty(PROP_SYNC_GROUP);
  p.deleteProperty(PROP_PAST_DAYS);
  p.deleteProperty(PROP_FUTURE_DAYS);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Sync stopped and all calendars removed.'))
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
