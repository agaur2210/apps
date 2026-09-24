function cleanupAllMirrors() {
  const s = getSettings_();
  if (!s.calendars.length) {
    Logger.log('No calendars configured.');
    return;
  }
  // Mirrors are only written to Calendar 1 (the installed/primary calendar).
  // Attempting to delete from source calendars fails if they are free/busy-only.
  const primaryId = s.calendars[0];
  deleteMirrorsByQuery_(primaryId, { privateExtendedProperty: EXT_BY + '=' + BY_VALUE });
  if (s.syncGroup) {
    deleteMirrorsByQuery_(primaryId, { sharedExtendedProperty: EXT_SYNC_GROUP + '=' + s.syncGroup });
  }
}

function deleteMirrorsByQuery_(calId, filter) {
  const deadline = Date.now() + 5 * 60 * 1000;
  let page, n = 0;
  do {
    if (Date.now() > deadline) {
      Logger.log('Time limit — stopped at ' + n + '. Run again to continue.');
      return;
    }
    const resp = Calendar.Events.list(calId, Object.assign({
      showDeleted: false,
      maxResults:  2500,
      pageToken:   page || undefined,
    }, filter));
    (resp.items || []).forEach(ev => {
      if (!isMirror_(ev)) {
        Logger.log('SKIP non-mirror ' + ev.id + ' (' + (ev.summary || '(no title)') + ')');
        return;
      }
      Logger.log('DELETE ' + ev.id + ' (' + (ev.summary || '(no title)') + ')');
      Calendar.Events.remove(calId, ev.id);
      n++;
    });
    page = resp.nextPageToken;
  } while (page);
  Logger.log('Removed ' + n + ' via ' + JSON.stringify(filter) + ' from ' + calId);
}
