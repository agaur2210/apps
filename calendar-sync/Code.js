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

  const p  = userProps_();
  const op = p.getProperty(PROP_PENDING_OP);
  p.deleteProperty(PROP_PENDING_OP);

  if (op === 'initialSync') {
    cleanupAllMirrors();
    syncAll_(true, false);
    createTrigger_();
  } else if (op === 'fullResync') {
    clearSyncTokens_();
    syncAll_(true, false);
  } else if (op === 'cleanup') {
    cleanupAllMirrors();
  } else if (op === 'stopAndClear') {
    const json = p.getProperty('pending_cleanup_cals');
    p.deleteProperty('pending_cleanup_cals');
    if (json) JSON.parse(json).forEach(calId => deleteMirrorsByPrivateProp_(calId));
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
