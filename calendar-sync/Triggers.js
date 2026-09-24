// Only two trigger types ever exist: runSync (hourly) and runBackground (one-shot).
const MANAGED_TRIGGERS_ = new Set(['runSync', 'runBackground']);

// Deletes all managed triggers and clears the stored trigger ID.
function clearAllManagedTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (MANAGED_TRIGGERS_.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  userProps_().deleteProperty(PROP_TRIGGER_ID);
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
  userProps_().setProperty(PROP_TRIGGER_ID, t.getUniqueId());
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
}

function isTriggerAlive_(id) {
  return ScriptApp.getProjectTriggers().some(t => t.getUniqueId() === id);
}
