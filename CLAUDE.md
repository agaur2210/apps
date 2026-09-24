# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This repo contains **Calendar Sync** — a Google Workspace Add-on (Apps Script) that mirrors free/busy time across multiple Google Calendars without copying event details. Mirror events appear as `"Busy [domain]"` on the primary calendar.

## Development workflow

There is no build step. The source files are plain `.js` pushed directly to Google Apps Script via [clasp](https://github.com/google/clasp).

### clasp commands (run from `calendar-sync/`)

```bash
clasp push          # deploy local files to Apps Script
clasp pull          # pull remote changes down
clasp push --watch  # auto-push on file save
clasp open          # open the project in the browser editor
clasp status        # show which local files are tracked
clasp logs          # tail execution logs
```

### Setup (one-time)

1. `npm install -g @google/clasp`
2. `clasp login` — opens browser OAuth flow; credentials saved to `~/.clasprc.json`
3. Create `.clasp.json` in `calendar-sync/` (gitignored — contains your personal script ID):
   ```json
   {
     "scriptId": "<YOUR_SCRIPT_ID>",
     "rootDir": "",
     "scriptExtensions": [".js", ".gs"],
     "htmlExtensions": [".html"],
     "jsonExtensions": [".json"]
   }
   ```
4. Enable **Google Calendar API** under **Services** in the Apps Script editor.

### Testing

There is no test runner. All testing is manual from the Apps Script editor.

| Function | What it tests |
|---|---|
| `testAuth()` | Verifies OAuth scopes; logs your email |
| `runSync()` | Runs an incremental sync; logs `Synced <calId> → N calendar(s)` |
| `deleteAllTriggers()` | Removes all project triggers; use to fully reset |
| `cleanupAllMirrors()` | Deletes all mirror events from all destination calendars |

**Dry-run a full sync** (no writes — paste into editor and run):
```js
function testDryRun() {
  syncAll_(true, true); // forceFullSync=true, dryRun=true
}
```
The execution log will show `CREATE mirror`, `UPDATE mirror`, and `DELETE mirror` for every event that would be touched.

## Architecture

### File responsibilities

| File | Role |
|---|---|
| `Code.js` | Add-on entry points (`buildHomepage`, `runSync`, `runBackground`, `testAuth`, `deleteAllTriggers`) |
| `Constants.js` | All property key names, extended-property tag values, and defaults |
| `Settings.js` | Read/write user properties (calendar list, sync window, sync group UUID) |
| `Triggers.js` | Create/delete the hourly `runSync` trigger and the one-shot `runBackground` trigger |
| `Cards.js` | Build the sidebar UI cards (setup form, status card) |
| `Handlers.js` | Card action callbacks (save, pause, resume, resync, stop) |
| `Sync.js` | Core sync engine — diff, create, update, delete mirror events |
| `Cleanup.js` | Bulk-remove all mirrors from all destination calendars |
| `Utils.js` | Pure utility functions shared across modules |

### Sync engine key concepts

**Mirror identification** — mirrors are tagged with three private/shared extended properties:
- `cb_source_id` — ID of the source event
- `cb_by` — always `"calendar-bridge"` 
- `cb_sync_group` (shared) — per-user UUID that prevents cross-user collisions

**Two trigger types:**
- `runSync` — hourly time-based trigger; runs incremental sync using sync tokens
- `runBackground` — one-shot trigger (fires ~1 s after creation); used for save-settings operations. The desired operation is stored in `PROP_PENDING_OP` before scheduling; `runBackground` reads and clears it on execution. Only one `runBackground` trigger exists at a time.

**Incremental vs. full sync:**
- Incremental: uses per-calendar sync tokens stored in user properties (`syncToken_<idx>`). Only changed events are returned by Google.
- Full resync: `forceFullSync=true` ignores tokens and fetches all events within the configured `pastDays`/`futureDays` window.

**Recurring event handling** — sync token responses may return hundreds of individual instances when a series is edited. The engine detects instances by `recurringEventId` field or `_YYYYMMDDTHHMMSSZ` suffix in the event ID, extracts the unique master IDs, fetches each master directly, and writes a single mirror per series.

**Mirror cache** — `loadMirrorCache_(dstId)` pre-fetches all mirrors for a destination calendar in one paginated API call before processing events. This avoids per-event API calls during normal sync; the cache is bypassed in dry-run mode.

**Sync window enforcement** — applied on every sync run, not just the initial one. Recurring series are always mirrored regardless of window (they have future occurrences). Valid range: 1–365 days.

**Calendar limit** — controlled by `MAX_CALENDARS` in `Constants.js` (default 3: 1 primary + 2 sources). Calendar 1 is read-only in the UI — always pre-filled from `Session.getActiveUser().getEmail()`.

**Per-calendar error handling** — if one source calendar is inaccessible (404 Not Found, 403 Forbidden), `syncAll_` catches the error, logs it, and continues with remaining calendars. The error is surfaced via `PROP_LAST_OP_RESULT` and displayed as a one-time banner in the status card.

**Background job completion banner** — after `runBackground` finishes, it writes `PROP_LAST_OP_RESULT` (`{ ok, op, ts }`). `buildStatusCard_` reads it, deletes it immediately, and shows a banner only if the result is less than 2 minutes old.

### Background operation flow (save settings)

1. Handler stores new settings, writes `pendingOp` to user properties; clears `PROP_LAST_OP_RESULT`
2. `scheduleBackground_('initialSync')` (or `'fullResync'`, `'cleanup'`, `'stopAndClear'`) creates a ~1 s one-shot trigger
3. `runBackground` self-deletes (to avoid counting against the 20-trigger limit), reads the op, executes the appropriate function, then writes the result to `PROP_LAST_OP_RESULT`

### OAuth scopes (defined in `appsscript.json`)

- `userinfo.email` — identify the running account (pre-fill Calendar 1)
- `calendar.calendarlist.readonly` — validate calendar emails
- `calendar.events` — read source events, write/delete mirrors
- `calendar.addons.execute` — required for Workspace Add-ons
- `script.scriptapp` — create/manage time-based triggers
