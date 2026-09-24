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

  // Pre-load all mirrors into a cache to avoid per-event API calls in findMirrors_
  const mirrorCaches = {};
  if (!dryRun) {
    dstIds.forEach(dstId => {
      mirrorCaches[dstId] = loadMirrorCache_(dstId);
    });
  }

  let pageToken, nextToken;
  const processedIds   = new Set();
  const pendingMasters = new Set();

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

    (resp.items || []).forEach(ev => {
      if (!ev.id) return;
      const isInstance = ev.recurringEventId || /_\d{8}T/.test(ev.id);
      if (isInstance) {
        const masterId = ev.recurringEventId || ev.id.replace(/_\d{8}T\w+$/, '');
        pendingMasters.add(masterId);
        return;
      }
      processedIds.add(ev.id);
      processEvent_(ev, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches);
    });

    pageToken = resp.nextPageToken;
    nextToken = resp.nextSyncToken;

  } while (pageToken);

  pendingMasters.forEach(masterId => {
    if (processedIds.has(masterId)) return;
    try {
      const master = Calendar.Events.get(srcId, masterId);
      processEvent_(master, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches);
    } catch (_) {}
  });

  if (nextToken && !dryRun) p.setProperty(tokenKey, nextToken);
  Logger.log('Synced ' + srcId + ' → ' + dstIds.length + ' calendar(s)');
}

// Load all mirrors for a calendar into a map keyed by source event ID.
// Replaces N*2 per-event API calls with a single paginated fetch.
function loadMirrorCache_(dstId) {
  const cache = {};
  let page;
  do {
    const resp = Calendar.Events.list(dstId, {
      privateExtendedProperty: EXT_BY + '=' + BY_VALUE,
      showDeleted: false,
      maxResults: 2500,
      pageToken: page || undefined,
    });
    (resp.items || []).forEach(m => {
      const sourceId = privateProps_(m)[EXT_SOURCE_ID];
      if (sourceId) {
        if (!cache[sourceId]) cache[sourceId] = [];
        cache[sourceId].push(m);
      }
    });
    page = resp.nextPageToken;
  } while (page);
  return cache;
}

function processEvent_(ev, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches) {
  if (!ev.id) return;
  if (isMirror_(ev, syncGroup)) return;
  if ((ev.eventType || 'default') !== 'default') return;
  if (ev.recurringEventId) return;
  if (!ev.start || !ev.end) return;

  const cancelled = ev.status === 'cancelled';
  const recurring = !!(ev.recurrence && ev.recurrence.length);
  const inWindow  = isInWindow_(ev, pastDays, futureDays);

  dstIds.forEach(dstId => {
    const cache = mirrorCaches ? mirrorCaches[dstId] : null;
    if (cancelled || recurring || inWindow) {
      processMirror_(ev, dstId, syncGroup, label, dryRun, cache);
    } else {
      deleteStaleMirror_(ev, dstId, syncGroup, dryRun, cache);
    }
  });
}

function deleteStaleMirror_(ev, dstId, syncGroup, dryRun, cache) {
  const matches = findMirrors_(ev, dstId, syncGroup, cache);
  const keep    = dedup_(matches, dstId, dryRun);
  if (keep) {
    Logger.log('DELETE stale mirror [' + keep.id + '] (outside window)');
    if (!dryRun) Calendar.Events.remove(dstId, keep.id);
  }
}

function processMirror_(ev, dstId, syncGroup, label, dryRun, cache) {
  const matches = findMirrors_(ev, dstId, syncGroup, cache);
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

// Use the pre-loaded cache when available; fall back to API calls for dryRun.
function findMirrors_(ev, dstId, syncGroup, cache) {
  if (cache) {
    return (cache[ev.id] || [])
      .filter(m => m.status !== 'cancelled')
      .sort((a, b) => new Date(a.created || 0) - new Date(b.created || 0));
  }

  // dryRun fallback: original per-event API lookup
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
