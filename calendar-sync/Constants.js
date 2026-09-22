// User property keys
const PROP_TRIGGER_ID = 'triggerId';
const PROP_CALENDARS  = 'calendars';
const PROP_SYNC_GROUP = 'syncGroup';

// Sync window — user-configurable, these are the fallback defaults
const PROP_PAST_DAYS      = 'pastDays';
const PROP_FUTURE_DAYS    = 'futureDays';
const DEFAULT_PAST_DAYS   = 7;
const DEFAULT_FUTURE_DAYS = 7;

// Extended property keys & values used to tag mirror events
const EXT_SOURCE_ID  = 'cb_source_id';
const EXT_BY         = 'cb_by';
const EXT_SYNC_GROUP = 'cb_sync_group';
const BY_VALUE       = 'calendar-bridge';

// Max number of calendar input fields in the setup form
const MAX_LOOP = 10;

// Last sync timestamp key
const PROP_LAST_SYNC = 'lastSync';
