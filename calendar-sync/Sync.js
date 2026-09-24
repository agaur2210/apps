function syncAll_(forceFullSync, dryRun) {
  const s = getSettings_();
  if (s.calendars.length < 2 || !s.syncGroup) {
    Logger.log('Calendar Sync: not configured.');
    return;
  }

  const lock = LockService.getUserLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Calendar Sync: another sync in progress, skipping.');
    return;
  }

  try {
    const primaryId = s.calendars[0];
    s.calendars.slice(1).forEach((srcId, i) => {
      if (isPausedCal_(srcId)) {
        Logger.log('Skipping paused calendar: ' + srcId);
        return;
      }
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
  const calHash  = calHash_(srcId);
  const t0       = Date.now();

  const params = { showDeleted: true, singleEvents: true, maxResults: 2500 };

  if (!forceFullSync && token) {
    params.syncToken = token;
  } else {
    const now = new Date();
    params.timeMin = new Date(now.getTime() - pastDays   * 86400000).toISOString();
    params.timeMax = new Date(now.getTime() + futureDays * 86400000).toISOString();
  }

  const mirrorCaches = {};
  dstIds.forEach(dstId => {
    const tc = Date.now();
    mirrorCaches[dstId] = loadMirrorCache_(dstId);
    const cacheSize = Object.keys(mirrorCaches[dstId]).length;
    Logger.log('[timing] loadMirrorCache ' + dstId + ': ' + (Date.now() - tc) + 'ms  (' + cacheSize + ' source keys)');
  });

  let pageToken, nextToken;
  const processedIds   = new Set();
  // Map from masterId → instances[] (all statuses, including cancelled).
  const pendingMasters = new Map();
  let   hasFbEvents    = false;
  // Guard against exhausting the 6-minute execution quota mid-pagination; if the
  // deadline is hit we skip stale cleanup to avoid deleting still-valid mirrors.
  const deadline          = Date.now() + 5 * 60 * 1000;
  let   paginationComplete = true;

  do {
    if (Date.now() > deadline) {
      Logger.log('Execution budget reached for ' + srcId + '; skipping stale cleanup this run.');
      paginationComplete = false;
      break;
    }

    if (pageToken) params.pageToken = pageToken;

    let resp;
    try {
      resp = Calendar.Events.list(srcId, params);
    } catch (err) {
      if (String(err).includes('410') && params.syncToken) {
        p.deleteProperty(tokenKey);
        Logger.log('Token expired for ' + srcId + '. Retrying with full sync.');
        delete params.syncToken;
        delete params.pageToken;
        const now = new Date();
        params.timeMin = new Date(now.getTime() - pastDays   * 86400000).toISOString();
        params.timeMax = new Date(now.getTime() + futureDays * 86400000).toISOString();
        resp = Calendar.Events.list(srcId, params);
      } else {
        throw err;
      }
    }

    (resp.items || []).forEach(ev => {
      if (!ev.id) {
        // Free/busy access with no event ID: assign a synthetic ID from the time slot.
        // Keyed by calHash (not position index) so IDs survive calendar list reorders.
        // Format avoids /_\d{8}T/ so instance-detection regex never triggers on these.
        if (!ev.start) return;
        const s = (ev.start.dateTime || ev.start.date || '').replace(/[^0-9T]/g, '');
        const e = (ev.end && (ev.end.dateTime || ev.end.date) || '').replace(/[^0-9T]/g, '');
        ev = Object.assign({}, ev, { id: 'fb_' + calHash + 'x' + s + (e ? 'x' + e : '') });
        hasFbEvents = true;
      }
      if (processedIds.has(ev.id)) return;  // deduplicate same-time free/busy slots
      const isInstance = ev.recurringEventId || /_\d{8}T/.test(ev.id);
      if (isInstance) {
        // Collect ALL instances (including cancelled) so we can detect series exceptions.
        const masterId = ev.recurringEventId || ev.id.replace(/_\d{8}T\w+$/, '');
        if (!pendingMasters.has(masterId)) pendingMasters.set(masterId, []);
        pendingMasters.get(masterId).push(ev);
        return;
      }
      processedIds.add(ev.id);
      try {
        processEvent_(ev, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches, !params.syncToken);
      } catch (err) {
        Logger.log('ERROR processing event ' + ev.id + ': ' + err);
      }
    });

    pageToken = resp.nextPageToken;
    nextToken = resp.nextSyncToken;

  } while (pageToken);

  pendingMasters.forEach((instances, masterId) => {
    if (processedIds.has(masterId)) return;

    const hasCancelled    = instances.some(i => i.status === 'cancelled');
    const activeInstances = instances.filter(i => i.status !== 'cancelled');
    // If none of the instances have a summary, this is a free/busy calendar — the master
    // fetch would either fail or return a master without a recurrence rule, so skip it and
    // go straight to per-instance mirroring. Saves one API call per series.
    const likelyFbCal = instances.every(i => !i.summary);

    let master = null;
    if (!likelyFbCal) {
      try {
        master = Calendar.Events.get(srcId, masterId);
      } catch (_) {
        master = null;
      }
    }

    // Use per-instance mirroring when: free/busy calendar, master unreachable, or the
    // series has cancelled instances (adding EXDATEs to the mirror is not supported).
    if (master && master.recurrence && master.recurrence.length && !hasCancelled) {
      // Full access, no exceptions: one recurring mirror for the whole series.
      try {
        processEvent_(master, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches, true);
      } catch (err) {
        Logger.log('ERROR processing master ' + masterId + ': ' + err);
      }
    } else {
      hasFbEvents = true;
      // Delete the series-level mirror (if one exists) when switching to per-instance mode.
      if (!likelyFbCal) {
        const cancelledMaster = { id: masterId, status: 'cancelled' };
        dstIds.forEach(dstId => {
          processMirror_(cancelledMaster, dstId, syncGroup, label, dryRun, mirrorCaches[dstId]);
        });
      }
      // Mirror each non-cancelled instance at its actual time.
      activeInstances.forEach(inst => {
        if (!inst.start) return;
        const s = (inst.start.dateTime || inst.start.date || '').replace(/[^0-9T]/g, '');
        const e = (inst.end && (inst.end.dateTime || inst.end.date) || '').replace(/[^0-9T]/g, '');
        const fbId = 'fb_' + calHash + 'x' + s + (e ? 'x' + e : '');
        if (processedIds.has(fbId)) return;
        const instWithFbId = Object.assign({}, inst, { id: fbId, recurringEventId: undefined });
        processedIds.add(fbId);
        try {
          processEvent_(instWithFbId, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches, true);
        } catch (err) {
          Logger.log('ERROR processing instance ' + fbId + ': ' + err);
        }
      });
    }
  });

  Logger.log('[timing] fetch+process events: ' + (Date.now() - t0) + 'ms');

  if (hasFbEvents) {
    // Free/busy calendar: clean up mirrors for slots no longer visible, and never use
    // sync tokens (the API can't track changes by ID, so always do a full scan).
    const fbPrefix = 'fb_' + calHash + 'x';
    const tClean   = Date.now();
    let   deleted  = 0;
    if (!paginationComplete) {
      Logger.log('Pagination incomplete — stale cleanup skipped to avoid deleting valid mirrors.');
    } else {
      dstIds.forEach(dstId => {
        const cache = mirrorCaches[dstId];
        if (!cache) return;
        Object.keys(cache).forEach(cacheKey => {
          // Delete stale mirrors for this source calendar (current hash format).
          // Also delete any mirrors in the legacy digit-indexed format (fb_Nx…) as a
          // one-time migration — those were created before stable hash IDs were used.
          const isCurrentFb = cacheKey.startsWith(fbPrefix) && !processedIds.has(cacheKey);
          const isLegacyFb  = /^fb_\d+x/.test(cacheKey)    && !processedIds.has(cacheKey);
          if (isCurrentFb || isLegacyFb) {
            cache[cacheKey].forEach(m => {
              Logger.log('DELETE stale fb mirror [' + m.id + ']' + (isLegacyFb && !isCurrentFb ? ' (legacy)' : ''));
              if (!dryRun) Calendar.Events.remove(dstId, m.id);
              deleted++;
            });
          }
        });
      });
    }
    Logger.log('[timing] stale cleanup: ' + (Date.now() - tClean) + 'ms  (' + deleted + ' deleted)');
    if (!dryRun) p.deleteProperty(tokenKey);
  } else {
    if (nextToken && !dryRun) p.setProperty(tokenKey, nextToken);
  }
  Logger.log('[timing] syncFrom_ total: ' + (Date.now() - t0) + 'ms');
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

function processEvent_(ev, dstIds, syncGroup, label, dryRun, pastDays, futureDays, mirrorCaches, fromFullScan) {
  if (!ev.id) return;
  if (isMirror_(ev)) return;
  if ((ev.eventType || 'default') !== 'default') return;
  if (ev.recurringEventId) return;
  if (!ev.start || !ev.end) return;

  const cancelled = ev.status === 'cancelled';
  const recurring = !!(ev.recurrence && ev.recurrence.length);
  // For full scans (timeMin/timeMax) the API already filtered events to those overlapping
  // the window, so trust it. For incremental syncs (syncToken) the API returns all changes
  // regardless of position, so we must check manually.
  const inWindow  = fromFullScan || isInWindow_(ev, pastDays, futureDays);

  dstIds.forEach(dstId => {
    const cache = mirrorCaches[dstId];
    if (cancelled || recurring || inWindow) {
      processMirror_(ev, dstId, syncGroup, label, dryRun, cache);
    } else {
      deleteStaleMirror_(ev, dstId, syncGroup, dryRun, cache);
    }
  });
}

function deleteStaleMirror_(ev, dstId, syncGroup, dryRun, cache) {
  const matches = findMirrors_(ev, dstId, cache);
  const keep    = dedup_(matches, dstId, dryRun);
  if (keep) {
    Logger.log('DELETE stale mirror [' + keep.id + '] (outside window)');
    if (!dryRun) Calendar.Events.remove(dstId, keep.id);
  }
}

function processMirror_(ev, dstId, syncGroup, label, dryRun, cache) {
  const matches = findMirrors_(ev, dstId, cache);
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
    if (!mirrorNeedsUpdate_(resource, keep)) {
      Logger.log('SKIP unchanged [' + ev.id + ']');
      return;
    }
    Logger.log('UPDATE mirror [' + ev.id + '] → [' + keep.id + ']');
    if (!dryRun) Calendar.Events.update(resource, dstId, keep.id);
    return;
  }

  Logger.log('CREATE mirror [' + ev.id + ']');
  if (!dryRun) Calendar.Events.insert(resource, dstId);
}

function mirrorNeedsUpdate_(resource, keep) {
  // For fb_ source IDs the time is encoded in the ID — if the cache has a match the
  // mirror times are already correct, so never issue an UPDATE.
  const srcId = (keep.extendedProperties &&
                 keep.extendedProperties.private &&
                 keep.extendedProperties.private[EXT_SOURCE_ID]) || '';
  if (srcId.startsWith('fb_')) return false;
  const toMs = f => f ? new Date(f.dateTime || f.date).getTime() : 0;
  if (toMs(resource.start) !== toMs(keep.start)) return true;
  if (toMs(resource.end)   !== toMs(keep.end))   return true;
  const evRr   = (resource.recurrence || []).join('\n');
  const keepRr = (keep.recurrence     || []).join('\n');
  return evRr !== keepRr;
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

function isMirror_(ev) {
  const sh = sharedProps_(ev);
  const pr = privateProps_(ev);
  // EXT_SYNC_GROUP is a shared (cross-account-visible) property — checking for its
  // presence (not a specific value) prevents mirrors from any installation being
  // re-mirrored when the add-on is installed on multiple accounts.
  if (hasText_(sh[EXT_SYNC_GROUP]) || pr[EXT_BY] === BY_VALUE || hasText_(pr[EXT_SOURCE_ID])) {
    return true;
  }
  // Fallback: when a calendar is accessed with free/busy-only permission, the API does
  // not return extendedProperties. Use the title as a sentinel so our own mirrors are
  // never re-mirrored into a loop. Events genuinely titled "Busy" or "Busy [domain]"
  // are treated as mirrors — document this in user-facing text.
  const title = ev.summary || '';
  return title === 'Busy' || title.startsWith('Busy [');
}

function findMirrors_(ev, dstId, cache) {
  return (cache[ev.id] || [])
    .filter(m => m.status !== 'cancelled')
    .sort((a, b) => new Date(a.created || 0) - new Date(b.created || 0));
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
