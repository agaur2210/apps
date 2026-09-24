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

// ── Trigger entry point ───────────────────────────────────────

function runSync() {
  syncAll_(false, false);
}

// Called by a one-time trigger after onSaveSettings — runs with the 6-minute limit.
function runInitialSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runInitialSync')
    .forEach(t => ScriptApp.deleteTrigger(t));
  cleanupAllMirrors();
  syncAll_(true, false);
}

// Called by a one-time trigger from onCleanupMirrors — runs with the 6-minute limit.
function runCleanup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runCleanup')
    .forEach(t => ScriptApp.deleteTrigger(t));
  cleanupAllMirrors();
}

// ── Utility entry points (run from the script editor) ─────────

function deleteAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  userProps_().deleteProperty(PROP_TRIGGER_ID);
  Logger.log('All triggers deleted.');
}

function testAuth() {
  const email = Session.getActiveUser().getEmail();
  Calendar.Events.list('primary', { maxResults: 1 });
  ScriptApp.getProjectTriggers();
  Logger.log('Auth OK: ' + email);
}
