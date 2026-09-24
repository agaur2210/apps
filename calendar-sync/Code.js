/**
 * Calendar Sync — Google Workspace Add-on
 *
 * Multi-calendar sync. Calendar 1 is always the current account.
 * Events from each calendar appear as "Busy [domain]" on the others.
 * No titles, descriptions, or attendees are shared.
 *
 * Entry points only — logic lives in the module files:
 *   Constants.js  — constants & config
 *   Settings.js   — user properties helpers
 *   Utils.js      — pure utility functions
 *   Triggers.js   — trigger management
 *   Cards.js      — card builders
 *   Handlers.js   — card action handlers
 *   Sync.js       — sync engine
 *   Cleanup.js    — mirror cleanup
 */

// ── Add-on entry points ───────────────────────────────────────

function buildHomepage() {
  try { return buildMainCard_(); } catch (e) { return errorCard_(e); }
}

function buildCalendarHomepage() {
  try { return buildMainCard_(); } catch (e) { return errorCard_(e); }
}

// ── Trigger entry points ──────────────────────────────────────

function runSync() {
  // Remove any duplicate runSync triggers that may have accumulated
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runSync');
  triggers.slice(1).forEach(t => ScriptApp.deleteTrigger(t));

  userProps_().setProperty(PROP_NEXT_RUN, String(Date.now() + 60 * 60 * 1000));
  syncAll_(false, false);
}

// Single background trigger. Operation is determined by PROP_PENDING_OP.
// Replaces runInitialSync, runFullResync, runCleanup, runStopAndClear.
function runBackground() {
  // Self-delete first so it doesn't count against the limit during execution.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runBackground') ScriptApp.deleteTrigger(t);
  });

  const p              = userProps_();
  const op             = p.getProperty(PROP_PENDING_OP);
  const wasSyncRunning = p.getProperty('bgWasSyncRunning') === '1';
  p.deleteProperty(PROP_PENDING_OP);
  p.deleteProperty('bgWasSyncRunning');

  if (op === 'initialSync') {
    // If Calendar 1 changed, clean mirrors off the old primary before touching the new one.
    const oldPrimary = p.getProperty('prev_primary');
    if (oldPrimary) {
      p.deleteProperty('prev_primary');
      deleteMirrorsByQuery_(oldPrimary, { privateExtendedProperty: EXT_BY + '=' + BY_VALUE });
    }
    cleanupAllMirrors();
    syncAll_(true, false);
    createTrigger_();
  } else if (op === 'startSync') {
    clearSyncTokens_();
    syncAll_(true, false);
    createTrigger_();
  } else if (op === 'fullResync') {
    clearSyncTokens_();
    syncAll_(true, false);
    createTrigger_();
  } else if (op === 'cleanup') {
    cleanupAllMirrors();
    // Restore the hourly trigger if sync was running before cleanup was triggered.
    if (wasSyncRunning) createTrigger_();
  } else if (op === 'stopAndClear') {
    const primaryId = p.getProperty('pending_cleanup_primary');
    const sg        = p.getProperty('pending_cleanup_sg');
    p.deleteProperty('pending_cleanup_primary');
    p.deleteProperty('pending_cleanup_sg');
    if (primaryId) {
      deleteMirrorsByQuery_(primaryId, { privateExtendedProperty: EXT_BY + '=' + BY_VALUE });
      if (sg) deleteMirrorsByQuery_(primaryId, { sharedExtendedProperty: EXT_SYNC_GROUP + '=' + sg });
    }
  }
}

// ── Utility entry points (run from the script editor) ─────────

function deleteAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  userProps_().deleteProperty(PROP_TRIGGER_ID);
  userProps_().deleteProperty(PROP_PENDING_OP);
  Logger.log('All triggers deleted.');
}

function testAuth() {
  const email = Session.getActiveUser().getEmail();
  Calendar.Events.list('primary', { maxResults: 1 });
  ScriptApp.getProjectTriggers();
  Logger.log('Auth OK: ' + email);
}

// Run from the Apps Script editor to see what access each calendar grants this account.
function checkCalendarAccess() {
  const s = getSettings_();
  Logger.log('Running as : ' + Session.getActiveUser().getEmail());
  Logger.log('');

  s.calendars.forEach((calId, i) => {
    Logger.log('=== Calendar ' + (i + 1) + ': ' + calId + ' ===');

    try {
      const entry = Calendar.CalendarList.get(calId);
      Logger.log('  Name       : ' + (entry.summary || '(hidden)'));
      Logger.log('  Access role: ' + entry.accessRole);
      // owner | writer | reader | freeBusyReader
    } catch (err) {
      Logger.log('  CalendarList error: ' + err);
    }

    try {
      const now  = new Date();
      const resp = Calendar.Events.list(calId, {
        timeMin:      new Date(now.getTime() - 7 * 86400000).toISOString(),
        timeMax:      new Date(now.getTime() + 7 * 86400000).toISOString(),
        showDeleted:  false,
        singleEvents: true,
        maxResults:   5,
      });
      const items     = resp.items || [];
      const hasIds    = items.some(e => !!e.id);
      const hasTitles = items.some(e => !!e.summary);
      Logger.log('  Events ±7d : ' + items.length + (resp.nextPageToken ? '+' : ''));
      Logger.log('  Sees IDs   : ' + hasIds);
      Logger.log('  Sees titles: ' + hasTitles);
      Logger.log('  Effective  : ' + (hasTitles ? 'Full details' : hasIds ? 'Details hidden (free/busy with IDs)' : 'Free/busy only (no IDs)'));
      items.forEach(ev => {
        const start = ev.start && (ev.start.dateTime || ev.start.date) || '?';
        Logger.log('    id=' + (ev.id || 'NONE') + '  ' + start + '  "' + (ev.summary || '(no title)') + '"');
      });
    } catch (err) {
      Logger.log('  Events.list error: ' + err);
    }

    Logger.log('');
  });
}

// Run from the Apps Script editor to diagnose why events are not being mirrored.
// Edit FROM_DATE / TO_DATE before running to inspect a specific range.
function runDiagnostic() {
  // ── Date range for the events listing ─────────────────────────────────────────
  // Leave empty to use your configured sync window (pastDays / futureDays).
  const FROM_DATE = '';  // YYYY-MM-DD  e.g. '2026-09-20'
  const TO_DATE   = '';  // YYYY-MM-DD  e.g. '2026-09-30'
  // ─────────────────────────────────────────────────────────────────────────────

  const s = getSettings_();
  Logger.log('Account  : ' + Session.getActiveUser().getEmail());
  Logger.log('Calendars: ' + JSON.stringify(s.calendars));
  Logger.log('Configured window: -' + s.pastDays + ' days / +' + s.futureDays + ' days');

  if (s.calendars.length < 2) {
    Logger.log('ERROR: fewer than 2 calendars configured.');
    return;
  }

  const now     = new Date();
  const timeMin = FROM_DATE
    ? new Date(FROM_DATE).toISOString()
    : new Date(now.getTime() - s.pastDays * 86400000).toISOString();
  const timeMax = TO_DATE
    ? new Date(TO_DATE + 'T23:59:59.999Z').toISOString()
    : new Date(now.getTime() + s.futureDays * 86400000).toISOString();
  Logger.log('Listing  : ' + timeMin.slice(0, 10) + ' → ' + timeMax.slice(0, 10));

  // ── Events received from each source calendar ─────────────────────────────────
  s.calendars.slice(1).forEach((calId, i) => {
    Logger.log('');
    Logger.log('=== Source calendar ' + (i + 2) + ': ' + calId + ' ===');
    try {
      const resp = Calendar.Events.list(calId, {
        timeMin, timeMax,
        showDeleted: false,
        singleEvents: true,
        maxResults: 100,
      });
      const items = resp.items || [];
      Logger.log('Events received: ' + items.length);
      items.forEach(ev => {
        const start = ev.start && (ev.start.dateTime || ev.start.date) || '?';
        const end   = ev.end   && (ev.end.dateTime   || ev.end.date)   || '?';
        Logger.log('  [' + (ev.status || 'confirmed') + ']'
          + '  ' + start + ' → ' + end
          + '  id=' + (ev.id || 'NONE (free/busy access)')
          + '  "' + (ev.summary || '(no title)') + '"');
      });
    } catch (err) {
      Logger.log('ERROR listing calendar: ' + err);
    }
  });

  // ── Existing mirrors on Calendar 1 ────────────────────────────────────────────
  Logger.log('');
  Logger.log('=== Existing mirrors on ' + s.calendars[0] + ' ===');
  try {
    const resp = Calendar.Events.list(s.calendars[0], {
      privateExtendedProperty: EXT_BY + '=' + BY_VALUE,
      showDeleted: false,
      maxResults: 100,
    });
    const items = resp.items || [];
    Logger.log('Mirror count: ' + items.length);
    items.forEach(ev => {
      const start = ev.start && (ev.start.dateTime || ev.start.date) || '?';
      const pr    = (ev.extendedProperties && ev.extendedProperties.private) || {};
      Logger.log('  ' + start + '  "' + (ev.summary || '(no title)') + '"  source=' + (pr[EXT_SOURCE_ID] || '?'));
    });
  } catch (err) {
    Logger.log('ERROR reading mirrors: ' + err);
  }

  // ── Dry-run: what the sync engine would add / update / delete ─────────────────
  // Uses the configured sync window (pastDays / futureDays), not FROM_DATE / TO_DATE.
  Logger.log('');
  Logger.log('=== Dry-run sync (configured window — no writes) ===');
  syncAll_(true, true);
  Logger.log('=== End diagnostic ===');
}
