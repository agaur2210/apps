// Deletes all triggers for this script (getProjectTriggers is already scoped to this project).
function clearAllManagedTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const p = userProps_();
  p.deleteProperty(PROP_TRIGGER_ID);
  p.deleteProperty(PROP_NEXT_RUN);
}

// Stores `op` in properties, wipes all triggers (prevents the 20-trigger limit from
// stale runSync/runBackground accumulation), then creates a fresh runBackground.
// Saves whether sync was running so ops that don't explicitly restart it can restore the state.
// A user lock serialises concurrent calls (e.g. two browser sessions hitting Save at once)
// so only one runBackground trigger is ever outstanding at a time.
function scheduleBackground_(op) {
  const lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    const p = userProps_();
    const triggerId = p.getProperty(PROP_TRIGGER_ID);
    const wasSyncRunning = !!(triggerId && isTriggerAlive_(triggerId));
    p.setProperty('bgWasSyncRunning', wasSyncRunning ? '1' : '0');
    p.setProperty(PROP_PENDING_OP, op);
    clearAllManagedTriggers_();
    ScriptApp.newTrigger('runBackground').timeBased().after(1000).create();
  } finally {
    lock.releaseLock();
  }
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
