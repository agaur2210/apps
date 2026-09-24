// Deletes every project trigger and clears stored trigger state.
function clearAllManagedTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const p = userProps_();
  p.deleteProperty(PROP_TRIGGER_ID);
  p.deleteProperty(PROP_NEXT_RUN);
}

// Stores `op` in properties then replaces any existing runBackground trigger with a new one.
// At most one runBackground trigger exists at any time.
function scheduleBackground_(op) {
  userProps_().setProperty(PROP_PENDING_OP, op);
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runBackground') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runBackground').timeBased().after(1000).create();
}

function createTrigger_() {
  clearAllManagedTriggers_();
  const t = ScriptApp.newTrigger('runSync')
    .timeBased()
    .everyHours(1)
    .create();
  const p = userProps_();
  p.setProperty(PROP_TRIGGER_ID, t.getUniqueId());
  p.setProperty(PROP_NEXT_RUN, String(Date.now() + 60 * 60 * 1000));
}

function deleteTrigger_() {
  const p  = userProps_();
  const id = p.getProperty(PROP_TRIGGER_ID);
  if (id) {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getUniqueId() === id) ScriptApp.deleteTrigger(t);
    });
  }
  p.deleteProperty(PROP_TRIGGER_ID);
  p.deleteProperty(PROP_NEXT_RUN);
}

function isTriggerAlive_(id) {
  return ScriptApp.getProjectTriggers().some(t => t.getUniqueId() === id);
}
