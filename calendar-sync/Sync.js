function syncAll_(forceFullSync, dryRun) {
  const s = getSettings_();
  if (s.calendars.length < 2 || !s.syncGroup) {
    Logger.log('Calendar Bridge: not configured.');
    return;
  }

  const lock = LockService.getUserLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Calendar Bridge: another sync in progress, skipping.');
    return;
  }

  try {
    // One-way sync: only read from secondary calendars, write Busy blocks to primary
    const primaryId = s.calendars[0];
    s.calendars.slice(1).forEach((srcId, i) => {
      syncFrom_(srcId, [primaryId], i + 1, s.syncGroup, forceFullSync, dryRun, s.pastDays, s.futureDays);
    });
    if (!dryRun) userProps_().setProperty(PROP_LAST_SYNC, new Date().toISOString());
  } finally {
    lock.releaseLock();
  }
}

function syncFrom_(srcId, dstIds, idx, syncGroup, forceFullSync, dryRun, pastDays, futureDays) {
  const p        = userProps_();
  const tokenKey = 'syncToken_' + idx;
  const token    = p.getProperty(tokenKey);
  const label    = domainLabel_(srcId);

  const params = { showDeleted: true, singleEvents: false, maxResults: 2500 };

  if (!forceFullSync && token) {
    params.syncToken = token;
  } else {
    const now = new Date();
    params.timeMin = new Date(now.getTime() - pastDays   * 86400000).toISOString();
    params.timeMax = new Date(now.getTime() + futureDays * 86400000).toISOString();
  }

  let pageToken, nextToken;

  do {
    if (pageToken) params.pageToken = pageToken;

    let resp;
    try {
      resp = Calendar.Events.list(srcId, params);
    } catch (err) {
      if (String(err).includes('410')) {
        p.deleteProperty(tokenKey);
        Logger.log('Token expired for ' + srcId + '. Cleared.');
        return;
      }
      throw err;
    }

    (resp.items || []).forEach(ev =>
      processEvent_(ev, dstIds, syncGroup, label, dryRun)
    );

    pageToken = resp.nextPageToken;
    nextToken = resp.nextSyncToken;

  } while (pageToken);

  if (nextToken && !dryRun) p.setProperty(tokenKey, nextToken);
  Logger.log('Synced ' + srcId + ' → ' + dstIds.length + ' calendar(s)');
}

function processEvent_(ev, dstIds, syncGroup, label, dryRun) {
  if (!ev.id) return;
  if (isMirror_(ev, syncGroup)) return;
  if ((ev.eventType || 'default') !== 'default') return;
  if (ev.recurringEventId) return;
  if (!ev.start || !ev.end) return;

  dstIds.forEach(dstId =>
    processMirror_(ev, dstId, syncGroup, label, dryRun)
  );
}

function processMirror_(ev, dstId, syncGroup, label, dryRun) {
  const matches = findMirrors_(ev, dstId, syncGroup);
  const keep    = dedup_(matches, dstId, dryRun);

  if (ev.status === 'cancelled') {
    if (keep) {
      Logger.log('DELETE mirror [' + keep.id + ']');
      if (!dryRun) Calendar.Events.remove(dstId, keep.id);
    }
    return;
  }

  const resource = buildMirror_(ev, syncGroup, label);

  if (keep) {
    Logger.log('UPDATE mirror [' + ev.id + '] → [' + keep.id + ']');
    if (!dryRun) Calendar.Events.update(resource, dstId, keep.id);
    return;
  }

  Logger.log('CREATE mirror [' + ev.id + ']');
  if (!dryRun) Calendar.Events.insert(resource, dstId);
}

function buildMirror_(ev, syncGroup, label) {
  const resource = {
    summary:      label ? 'Busy [' + label + ']' : 'Busy',
    start:         normDate_(ev.start),
    end:           normDate_(ev.end),
    transparency: 'opaque',
    extendedProperties: {
      private: {
        [EXT_SOURCE_ID]: ev.id,
        [EXT_BY]:        BY_VALUE,
      },
      shared: {
        [EXT_SYNC_GROUP]: syncGroup,
      },
    },
  };

  if (ev.recurrence && !ev.recurringEventId) {
    resource.recurrence = ev.recurrence;
  }

  return resource;
}

function isMirror_(ev, syncGroup) {
  const sh = sharedProps_(ev);
  const pr = privateProps_(ev);
  return (
    sh[EXT_SYNC_GROUP] === syncGroup ||
    pr[EXT_BY]         === BY_VALUE  ||
    hasText_(pr[EXT_SOURCE_ID])
  );
}

function findMirrors_(ev, dstId, syncGroup) {
  const seen = {};
  const out  = [];

  const collect = items => {
    (items || []).forEach(m => {
      if (m.status !== 'cancelled' && !seen[m.id]) {
        seen[m.id] = true;
        out.push(m);
      }
    });
  };

  try {
    collect(Calendar.Events.list(dstId, {
      privateExtendedProperty: EXT_SOURCE_ID + '=' + ev.id,
      showDeleted: true,
      maxResults:  50,
    }).items);
  } catch (_) {}

  if (ev.iCalUID) {
    try {
      (Calendar.Events.list(dstId, {
        iCalUID: ev.iCalUID, showDeleted: true, maxResults: 50,
      }).items || []).forEach(m => {
        if (m.status !== 'cancelled' && !seen[m.id] && isMirror_(m, syncGroup)) {
          seen[m.id] = true;
          out.push(m);
        }
      });
    } catch (_) {}
  }

  return out.sort((a, b) => new Date(a.created || 0) - new Date(b.created || 0));
}

function dedup_(matches, dstId, dryRun) {
  if (!matches || !matches.length) return null;
  const keep = matches[0];
  for (let i = 1; i < matches.length; i++) {
    Logger.log('DELETE dup [' + matches[i].id + ']');
    if (!dryRun) Calendar.Events.remove(dstId, matches[i].id);
  }
  return keep;
}
