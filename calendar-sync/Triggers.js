function createTrigger_() {
  const managed = new Set(['runSync', 'runInitialSync', 'runCleanup', 'runFullResync', 'runStopAndClear']);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (managed.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });

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
