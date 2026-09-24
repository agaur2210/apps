/**
 * Run from the Apps Script editor to remove all Busy blocks.
 * Works even after settings have been cleared.
 */
function cleanupAllMirrors() {
  const s = getSettings_();
  if (!s.calendars.length) {
    Logger.log('No calendars configured.');
    return;
  }
  s.calendars.forEach(calId => deleteMirrorsByPrivateProp_(calId));
}

function deleteMirrorsByPrivateProp_(calId) {
  const deadline = Date.now() + 5 * 60 * 1000; // stop before 6-min limit
  let page, n = 0;
  do {
    if (Date.now() > deadline) {
      Logger.log('Time limit approaching — stopped at ' + n + ' mirrors. Run again to continue.');
      return;
    }
    const resp = Calendar.Events.list(calId, {
      privateExtendedProperty: EXT_BY + '=' + BY_VALUE,
      showDeleted:  false,
      maxResults:   2500,
      pageToken:    page || undefined,
    });
    (resp.items || []).forEach(ev => {
      if (privateProps_(ev)[EXT_BY] === BY_VALUE) {
        Calendar.Events.remove(calId, ev.id);
        n++;
      }
    });
    page = resp.nextPageToken;
  } while (page);
  Logger.log('Removed ' + n + ' mirrors from ' + calId);
}
