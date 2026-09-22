# Calendar Sync — Setup Guide

## What you need

- A Google account
- Google Calendar open in a browser
- The Calendar Sync add-on installed

---

## Step 1 — Install the add-on

1. Open the [Google Workspace Marketplace](https://workspace.google.com/marketplace) and search for **Calendar Sync**
2. Click **Install** and follow the prompts
3. Grant the requested permissions when asked
4. Open [Google Calendar](https://calendar.google.com) — a **Calendar Sync** panel appears in the right sidebar

---

## Step 2 — Add your calendars

1. In the Calendar Sync panel, click **Settings**
2. **Calendar 1** is your primary calendar — enter your main Google account email (e.g. `you@work.com`)
3. Add your secondary calendars below (e.g. `you@gmail.com`, `you@client.com`)
4. You can add up to **10 calendars**

---

## Step 3 — Set your sync window

The sync window controls how far back and forward to create busy blocks.

- **Days in the past** — how many days back to mirror (default: 7)
- **Days in the future** — how many days ahead to mirror (default: 7)

Adjust these to match your scheduling horizon.

---

## Step 4 — Save and start

Click **Save & Start Sync**.

The add-on will:
1. Run a full sync immediately
2. Create **"Busy [domain]"** blocks on your primary calendar for every event found on your secondary calendars
3. Set up an **hourly trigger** to keep everything in sync automatically

---

## What the busy blocks look like

| Event on secondary calendar | What appears on your primary calendar |
|---|---|
| "Team standup" (work) | "Busy [yourcompany.com]" |
| "Doctor appointment" (personal) | "Busy [gmail.com]" |
| All-day event | All-day "Busy" block |
| Cancelled event | Mirror removed |
| Rescheduled event | Mirror updated |

No titles, descriptions, locations, or attendees are ever copied — only the time slot.

---

## Managing the sync

From the Calendar Sync panel you can:

| Action | What it does |
|---|---|
| **Pause** | Stops the hourly trigger (mirrors stay in place) |
| **Resume** | Restarts the hourly trigger |
| **Full Resync** | Deletes all mirrors and rebuilds from scratch |
| **Stop & Clean Up** | Deletes all mirrors and removes the trigger |

---

## Changing settings

If you update your calendars or sync window and click **Save**, the add-on automatically:
1. Removes all existing busy blocks
2. Runs a fresh full sync with the new settings

---

## Privacy

- Only the **time slot** is copied — never titles, descriptions, locations, or attendees
- Busy blocks are marked with hidden metadata only the add-on can read
- Calendar guests never see the mirror events or any metadata
