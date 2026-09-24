const MANAGED_TRIGGERS_ = new Set(['runSync', 'runInitialSync', 'runCleanup', 'runFullResync', 'runStopAndClear']);

function clearAllManagedTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (MANAGED_TRIGGERS_.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  userProps_().deleteProperty(PROP_TRIGGER_ID);
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
  try {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getUniqueId() === id) ScriptApp.deleteTrigger(t);
    });
  } catch (_) {}
}

function isTriggerAlive_(id) {
  try {
    return ScriptApp.getProjectTriggers().some(t => t.getUniqueId() === id);
  } catch (_) {
    return false;
  }
}
