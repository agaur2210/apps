const MANAGED_TRIGGERS_ = new Set(['runSync', 'runInitialSync', 'runCleanup', 'runFullResync', 'runStopAndClear']);

// Deletes every managed trigger and clears the stored trigger ID.
// Use when starting fresh (onSaveSettings, onStopAndClear, createTrigger_).
function clearAllManagedTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (MANAGED_TRIGGERS_.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  userProps_().deleteProperty(PROP_TRIGGER_ID);
}

// Deletes any existing triggers for `name`, then creates a new one-shot trigger.
// Use for background ops (onFullResync, onCleanupMirrors) that must not touch runSync.
function replaceBackgroundTrigger_(name) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === name) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(name).timeBased().after(1000).create();
}

function createTrigger_() {
  clearAllManagedTriggers_();
  const t = ScriptApp.newTrigger('runSync')
    .timeBased()
    .everyHours(1)
    .create();
  userProps_().setProperty(PROP_TRIGGER_ID, t.getUniqueId());
}

function deleteTrigger_() {
  const p  = userProps_();
  const id = p.getProperty(PROP_TRIGGER_ID);
  if (id) removeTriggerById_(id);
  p.deleteProperty(PROP_TRIGGER_ID);
}

function removeTriggerById_(id) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getUniqueId() === id) ScriptApp.deleteTrigger(t);
  });
}

function isTriggerAlive_(id) {
  return ScriptApp.getProjectTriggers().some(t => t.getUniqueId() === id);
}
