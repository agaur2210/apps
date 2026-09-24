# Calendar Sync

A Google Workspace Add-on that keeps your free/busy time in sync across multiple Google Calendars — without sharing event details.

## What it does

When you work across multiple Google accounts (personal, work, client), attendees can't see your real availability on your other calendars. Calendar Sync solves this by reading events from your secondary calendars and creating private **"Busy [domain]"** blocks on your primary calendar automatically.

**Key behaviours:**

- **One-way, privacy-preserving sync** — only the time slot is copied. Titles, descriptions, locations, and attendees are never shared.
- **Incremental sync** — uses Google Calendar sync tokens so only changed events are processed on each run.
- **Automatic deduplication** — duplicate mirror events are detected and removed.
- **Runs on a schedule** — a time-based trigger fires every hour, no manual action needed.
- **Configurable sync window** — choose how many days in the past and future to keep in sync (default: 7 days each way).
- **Configurable calendar limit** — default is 3 calendars (1 primary + 2 sources); change `MAX_CALENDARS` in `Constants.js` to raise the limit.

### How events appear

The mirror title is always `Busy [<domain>]`, where `<domain>` is the full domain of the source calendar email address.

| Source calendar event | What appears on your primary calendar |
|---|---|
| "Team standup" on work@yourcompany.com | "Busy [yourcompany.com]" |
| "Doctor appointment" on you@gmail.com | "Busy [gmail.com]" |
| All-day event | All-day "Busy [domain]" block |
| Recurring event | Single recurring "Busy [domain]" block (one mirror for the whole series) |
| Deleted event | Mirror is removed |
| Event rescheduled, still overlaps window | Mirror updated to new time |
| Event moved entirely outside window | Mirror deleted |

### Per-calendar error handling

If one source calendar is inaccessible (wrong email, calendar deleted, permissions revoked), that calendar is skipped and the sync continues for the remaining calendars. A completion banner is shown in the add-on panel with a human-readable error (e.g. "you@domain.com: calendar not found. Check the email address.").

### Sync behaviour in detail

**Full sync vs. incremental sync**

The first sync (and any manual "Full Resync") fetches every event within your configured window (`-past / +future days`) using `timeMin`/`timeMax`. Every subsequent hourly sync uses a **sync token** — Google returns only what changed since the last run, with no time boundary.

**Recurring events**

A recurring series is mirrored as a single recurring "Busy" block, not as individual instances. When the series is edited (time, recurrence rule, etc.), Google's sync token response may return hundreds of individual instances instead of the master event. The sync engine:

1. Detects all instances (by `recurringEventId` field or the `_20260923T140000Z` suffix in the event ID)
2. Extracts one unique master ID from all of them
3. Fetches the master event directly with `Calendar.Events.get`
4. Updates the single mirror — one API write regardless of how many instances Google returned

Example — weekly standup edited to move 30 minutes later:
```
Sync token returns: 200 instances of abc123_20240101T..., abc123_20240108T..., ...
Engine detects:     all are instances of master "abc123"
Engine fetches:     Calendar.Events.get("abc123") → master event with new time
Engine writes:      UPDATE mirror [abc123] → [existing-mirror-id]   (1 write)
```

**Sync window enforcement**

The window setting controls which events get mirrors. It is enforced on every sync run, not just the initial one. An event is considered "in window" if **any part of it overlaps** the configured window — so a multi-day event that started before the window but ends within it will still be mirrored.

| Scenario | What happens |
|---|---|
| Event overlaps the window (even partially) | Mirror created |
| Event rescheduled, still overlaps window | Mirror updated |
| Event rescheduled entirely outside window | Mirror deleted |
| Event entirely outside window | Skipped, no mirror |
| Recurring series (any start date) | Always mirrored — the series has future occurrences |
| Cancelled event | Mirror always deleted, regardless of window |

Example — sync window is `−1 / +2 days`, today is Wednesday:

```
Monday meeting, ends Monday (2 days ago)       → entirely outside window → no mirror
Monday–Wednesday meeting (starts 2 days ago)   → overlaps window        → mirror created
Tuesday meeting (1 day ago)                    → inside window          → mirror created
Thursday meeting (1 day ahead)                 → inside window          → mirror created
Friday meeting (2 days ahead)                  → inside window          → mirror created
Next Monday meeting (5 days, 1 hour)           → entirely outside window → no mirror
Weekly standup (recurring)                     → always mirrored (has future occurrences)
```

**Changing the sync window**

When you save new settings, the add-on:
1. Deletes **all** existing mirrors (`cleanupAllMirrors`)
2. Runs a full resync with the new window

This ensures mirrors from the old window are not left as stale busy blocks.

Example — window changed from `+30 days` to `+7 days`:
```
Before: mirrors exist for events on days 1–30
Save settings: all mirrors deleted
After resync:  mirrors recreated only for days 1–7
```

**Individual instance exceptions**

If a single occurrence of a recurring series is rescheduled (e.g. next week's standup moves from 2pm to 4pm), the mirror retains the original series time for that slot. The add-on syncs at the series level — individual exceptions are not tracked. The busy block is still correct to within the rescheduled duration.

## Project structure

| File | Purpose |
|---|---|
| `Code.js` | Add-on entry points (`buildHomepage`, `runSync`, etc.) |
| `Constants.js` | Property keys and default values |
| `Settings.js` | Read/write user properties |
| `Triggers.js` | Create and manage the hourly time trigger |
| `Cards.js` | Build the setup and status UI cards |
| `Handlers.js` | Card action callbacks |
| `Sync.js` | Core sync engine — diff, create, update, delete mirrors |
| `Cleanup.js` | Bulk-remove all mirror events |
| `Utils.js` | Shared utility functions |
| `appsscript.json` | Apps Script manifest (scopes, runtime, add-on config) |

## Quick start: install & test

Follow these steps in order to go from a fresh clone to a running, verified sync.

### Step 1 — Install clasp

```bash
npm install -g @google/clasp
```

Enable the Apps Script API for your account (one-time):
[script.google.com/home/usersettings](https://script.google.com/home/usersettings) → turn on **Google Apps Script API**.

### Step 2 — Authenticate

```bash
clasp login
```

A browser window opens; sign in with the Google account that owns the target calendar. Credentials are stored at `~/.clasprc.json`.

### Step 3 — Create an Apps Script project

If you don't have one yet:

```bash
clasp create --title "Calendar Sync" --type standalone
```

This creates a new script and writes `.clasp.json` locally. If you already have a project, skip to Step 4.

### Step 4 — Configure `.clasp.json`

`.clasp.json` is gitignored — create it manually in the `calendar-sync/` directory if it doesn't exist:

```json
{
  "scriptId": "<YOUR_SCRIPT_ID>",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

Find your script ID: Apps Script editor → **Project Settings** (gear icon) → **Script ID**.

### Step 5 — Push the code

```bash
clasp push
```

Verify the upload:

```bash
clasp status   # shows which local files are tracked
clasp open     # opens the project in the browser editor
```

### Step 6 — Enable the Calendar Advanced Service

In the Apps Script editor: **Services** (+ icon in the left sidebar) → find **Google Calendar API** → click **Add**.

This is required for `Calendar.Events.list/insert/update/remove` calls to work.

### Step 7 — Grant OAuth permissions

In the editor, select `testAuth` from the function dropdown and click **Run**. You will be prompted to grant permissions. After accepting, the execution log should show:

```
Auth OK: you@yourdomain.com
```

If you see a scope error, re-check Step 6.

### Step 8 — Dry-run the sync (no writes)

Before touching any real calendar data, verify the sync logic by pasting this into the editor and running it:

```js
function testDryRun() {
  syncAll_(true, true); // forceFullSync=true, dryRun=true
}
```

The execution log will show `CREATE mirror`, `UPDATE mirror`, or `DELETE mirror` lines for every event that would be touched — **nothing is written**. If you see no output, confirm at least 2 calendars are configured in settings.

### Step 9 — Deploy as a test add-on

In the Apps Script editor:

1. **Deploy** → **Test deployments** → **Install**
2. Open [Google Calendar](https://calendar.google.com) — the **Calendar Sync** panel appears in the right sidebar.
3. Enter your calendar emails (Calendar 1 = primary), set the sync window, and click **Save & Start Sync**.

### Step 10 — Verify the sync

After saving settings, a full sync runs immediately. Check:

- **Execution log** (`clasp logs` or View → Logs in editor): should show `Synced <calId> → 1 calendar(s)` for each secondary calendar.
- **Primary calendar**: events from secondary calendars appear as **"Busy [domain]"** blocks with no titles, descriptions, or attendees.
- **Status card**: shows sync as active and a "Last synced: Just now" timestamp.

Run a quick incremental sync manually from the status card or by running `runSync()` in the editor.

---

## Local development with clasp

[clasp](https://github.com/google/clasp) lets you edit Apps Script projects locally and push changes from the command line.

### 1. Install clasp

```bash
npm install -g @google/clasp
```

### 2. Log in

```bash
clasp login
```

This opens a browser to authenticate with your Google account. Credentials are saved to `~/.clasprc.json`.

### 3. Create `.clasp.json`

`.clasp.json` is **not committed** (it contains your personal script ID). Create it in the `calendar-sync/` directory:

```json
{
  "scriptId": "<YOUR_SCRIPT_ID>",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
```

To find your script ID: open the Apps Script project → **Project Settings** → copy the **Script ID**.

### 4. Enable the Apps Script API

Go to [script.google.com/home/usersettings](https://script.google.com/home/usersettings) and turn on **Google Apps Script API**.

### 5. Common clasp commands

```bash
# Push local files to Apps Script
clasp push

# Pull remote changes down to local
clasp pull

# Open the project in the browser editor
clasp open

# Watch for changes and push automatically
clasp push --watch

# List project files
clasp status
```

## First-time setup (add-on)

1. Push the code with `clasp push`.
2. In the Apps Script editor, run `testAuth` once to trigger the OAuth consent screen and grant required permissions.
3. Deploy the project as a **Google Workspace Add-on** (Apps Script editor → Deploy → Test deployments, or a versioned deployment).
4. Open Google Calendar — the **Calendar Sync** panel appears in the right sidebar.
5. Enter your calendar email addresses (Calendar 1 is your primary account; add secondary calendars below).
6. Set the sync window and click **Save & Start Sync**.

The add-on creates an hourly trigger. The status card shows the last sync time and lets you pause, resume, or run a full resync.

## Required OAuth scopes

| Scope | Why |
|---|---|
| `userinfo.email` | Pre-fill Calendar 1 with your email |
| `calendar.calendarlist.readonly` | List calendars for validation |
| `calendar.events` | Read source events, write/delete mirror events |
| `calendar.addons.execute` | Required for Workspace Add-ons |
| `script.scriptapp` | Create and manage the time-based trigger |

## Configuration

| Constant | File | Default | Description |
|---|---|---|---|
| `MAX_CALENDARS` | `Constants.js` | `3` | Max calendars (1 primary + N−1 sources). Change here to adjust the limit everywhere. |
| `DEFAULT_PAST_DAYS` | `Constants.js` | `7` | Default sync window — days in the past |
| `DEFAULT_FUTURE_DAYS` | `Constants.js` | `7` | Default sync window — days in the future |

Sync window accepts values 1–365. Calendar 1 (primary) is read-only in the UI — it is always pre-filled from the running Google account's email.

## Utility functions (run from Apps Script editor)

| Function | What it does |
|---|---|
| `testAuth()` | Verifies auth scopes are granted; logs your email |
| `deleteAllTriggers()` | Removes all project triggers (use to fully stop sync) |
| `checkCalendarAccess()` | Shows access role and event visibility for each configured calendar |
| `runDiagnostic()` | Full diagnostic: lists source events, existing mirrors, and runs a dry-run sync |

## Testing

Apps Script has no built-in test runner. Testing is done manually from the script editor's **Run** menu and **Execution log** (View → Logs, or `Cmd+Enter`).

### Smoke tests (run from the Apps Script editor)

| Function to run | What to check in the log |
|---|---|
| `testAuth()` | Logs your email and confirms all OAuth scopes are granted |
| `runSync()` | Logs `Synced <calId> → N calendar(s)` for each secondary calendar |
| `deleteAllTriggers()` | Logs "All triggers deleted" — use to fully reset trigger state |
| `cleanupAllMirrors()` | Logs "Removed N mirrors from <calId>" — safe to run repeatedly |

### Dry-run a full sync (no writes)

The sync engine accepts a `dryRun` flag. To inspect what *would* happen without creating or deleting any events, paste this into the editor and run it:

```js
function testDryRun() {
  syncAll_(true, true); // forceFullSync=true, dryRun=true
}
```

The execution log will show `CREATE mirror`, `UPDATE mirror`, and `DELETE mirror` entries for every event that would be touched — without making any actual changes.

### Verify mirror events

After a real sync, open the primary calendar and check:

- Events from secondary calendars appear as **"Busy [domain]"** blocks, where `domain` is the full domain of the source calendar (e.g. `Busy [opisnet.com]`, `Busy [gmail.com]`)
- Mirror events have no title leak, no description, no attendees
- Deleting an event on the secondary calendar causes its mirror to disappear on the next hourly run (or after a manual `runSync()`)

### Incremental vs. full sync

- `runSync()` — incremental (uses sync tokens, only processes changes since last run; window enforced per event)
- `syncAll_(true, false)` — full resync (ignores tokens, re-reads the entire sync window from scratch)

Saving settings via the add-on UI automatically wipes all mirrors and runs a full resync — you don't need to do this manually after a window change.

## Privacy notes

Mirror events use private extended properties (`cb_source_id`, `cb_by`, `cb_sync_group`) to track which events belong to this add-on. These properties are never visible to calendar guests. The sync group UUID is unique per user installation, preventing cross-user collisions.
