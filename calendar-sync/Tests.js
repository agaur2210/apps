// Run `runTests()` from the Apps Script editor. Results appear in the Execution log.
// Covers pure utility functions and sync helper logic — no Google API calls.

function runTests() {
  let passed = 0, failed = 0;
  let _secLabel = '', _secBase = { passed: 0, failed: 0 };
  const _sections = [];

  function startSection_(name) {
    if (_secLabel) {
      _sections.push({ name: _secLabel, passed: passed - _secBase.passed, failed: failed - _secBase.failed });
    }
    _secLabel = name;
    _secBase  = { passed: passed, failed: failed };
    Logger.log('--- ' + name);
  }

  function assert(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { Logger.log('PASS  ' + name); passed++; }
    else {
      Logger.log('FAIL  ' + name);
      Logger.log('      expected: ' + JSON.stringify(expected));
      Logger.log('      actual  : ' + JSON.stringify(actual));
      failed++;
    }
  }
  function assertTrue(name, v)  { assert(name, !!v, true);  }
  function assertFalse(name, v) { assert(name, !!v, false); }

  // ── domainLabel_ ─────────────────────────────────────────────
  startSection_('domainLabel_');
  assert('normal email',       domainLabel_('user@example.com'),    'example.com');
  assert('gmail',              domainLabel_('me@gmail.com'),         'gmail.com');
  assert('subdomain',          domainLabel_('u@sub.company.io'),     'sub.company.io');
  assert('no @ → empty',       domainLabel_('notanemail'),           '');
  assert('empty string',       domainLabel_(''),                     '');

  // ── hasText_ ─────────────────────────────────────────────────
  startSection_('hasText_');
  assertTrue ('non-empty string',   hasText_('hello'));
  assertTrue ('string with spaces', hasText_('  hi  '));
  assertFalse('empty string',       hasText_(''));
  assertFalse('whitespace only',    hasText_('   '));
  assertFalse('null',               hasText_(null));
  assertFalse('undefined',          hasText_(undefined));

  // ── normDate_ ────────────────────────────────────────────────
  startSection_('normDate_');
  assert('dateTime only',
    normDate_({ dateTime: '2026-01-01T10:00:00Z' }),
    { dateTime: '2026-01-01T10:00:00Z' });
  assert('date only',
    normDate_({ date: '2026-01-01' }),
    { date: '2026-01-01' });
  assert('dateTime + timeZone',
    normDate_({ dateTime: '2026-01-01T10:00:00Z', timeZone: 'Europe/Madrid' }),
    { dateTime: '2026-01-01T10:00:00Z', timeZone: 'Europe/Madrid' });
  assert('strips extra fields',
    normDate_({ date: '2026-01-01', unknown: 'x' }),
    { date: '2026-01-01' });
  assert('empty object', normDate_({}), {});

  // ── calHash_ ─────────────────────────────────────────────────
  startSection_('calHash_');
  const h1 = calHash_('user@example.com');
  assert('produces 6 chars',           h1.length, 6);
  assert('deterministic',              calHash_('user@example.com'), h1);
  assertFalse('different inputs differ', calHash_('other@example.com') === h1);

  // ── isInWindow_ ──────────────────────────────────────────────
  startSection_('isInWindow_');
  const now = Date.now();
  const ms  = d => new Date(d).toISOString();

  assertTrue('timed event inside window', isInWindow_(
    { start: { dateTime: ms(now - 3600000) }, end: { dateTime: ms(now + 3600000) } }, 7, 7));

  assertFalse('timed event before window', isInWindow_(
    { start: { dateTime: ms(now - 9 * 86400000) }, end: { dateTime: ms(now - 8 * 86400000) } }, 7, 7));

  assertFalse('timed event after window', isInWindow_(
    { start: { dateTime: ms(now + 8 * 86400000) }, end: { dateTime: ms(now + 9 * 86400000) } }, 7, 7));

  assertTrue('multi-day event spans window start', isInWindow_(
    { start: { dateTime: ms(now - 9 * 86400000) }, end: { dateTime: ms(now - 5 * 86400000) } }, 7, 7));

  const todayDate    = new Date(now).toISOString().slice(0, 10);
  const tomorrowDate = new Date(now + 86400000).toISOString().slice(0, 10);
  assertTrue('all-day event in window', isInWindow_(
    { start: { date: todayDate }, end: { date: tomorrowDate } }, 7, 7));

  assertFalse('missing start field', isInWindow_({ end: { dateTime: ms(now) } }, 7, 7));

  // ── mirrorNeedsUpdate_ ───────────────────────────────────────
  startSection_('mirrorNeedsUpdate_');
  const t1 = '2026-09-25T10:00:00Z';
  const t2 = '2026-09-25T11:00:00Z';
  const t3 = '2026-09-25T12:00:00Z';

  const baseResource = { start: { dateTime: t1 }, end: { dateTime: t2 }, recurrence: [] };
  const makeKeep = (srcId, start, end, rr) => ({
    start: { dateTime: start }, end: { dateTime: end }, recurrence: rr || [],
    extendedProperties: { private: { [EXT_SOURCE_ID]: srcId, [EXT_BY]: BY_VALUE } }
  });

  assertFalse('no change',         mirrorNeedsUpdate_(baseResource, makeKeep('abc', t1, t2)));
  assertTrue ('start changed',     mirrorNeedsUpdate_(baseResource, makeKeep('abc', t3, t2)));
  assertTrue ('end changed',       mirrorNeedsUpdate_(baseResource, makeKeep('abc', t1, t3)));
  assertFalse('fb_ source → never update',
    mirrorNeedsUpdate_(baseResource, makeKeep('fb_abc', t3, t2)));
  assertTrue ('recurrence changed',
    mirrorNeedsUpdate_(
      { start: { dateTime: t1 }, end: { dateTime: t2 }, recurrence: ['RRULE:FREQ=WEEKLY'] },
      makeKeep('abc', t1, t2, ['RRULE:FREQ=DAILY'])));
  assertFalse('same recurrence — no update',
    mirrorNeedsUpdate_(
      { start: { dateTime: t1 }, end: { dateTime: t2 }, recurrence: ['RRULE:FREQ=WEEKLY'] },
      makeKeep('abc', t1, t2, ['RRULE:FREQ=WEEKLY'])));

  // ── buildMirror_ ─────────────────────────────────────────────
  startSection_('buildMirror_');
  const simpleEv = { id: 'event1', start: { dateTime: t1 }, end: { dateTime: t2 } };
  const m = buildMirror_(simpleEv, 'sg-uuid', 'example.com');
  assert('summary',          m.summary,       'Busy [example.com]');
  assert('start',            m.start,         { dateTime: t1 });
  assert('end',              m.end,           { dateTime: t2 });
  assert('transparency',     m.transparency,  'opaque');
  assert('EXT_SOURCE_ID',    m.extendedProperties.private[EXT_SOURCE_ID], 'event1');
  assert('EXT_BY',           m.extendedProperties.private[EXT_BY],        BY_VALUE);
  assert('EXT_SYNC_GROUP',   m.extendedProperties.shared[EXT_SYNC_GROUP], 'sg-uuid');
  assertFalse('no recurrence on non-recurring', 'recurrence' in m);

  const recurEv = { id: 'r1', start: { dateTime: t1 }, end: { dateTime: t2 },
                    recurrence: ['RRULE:FREQ=WEEKLY'] };
  assert('recurrence copied from master', buildMirror_(recurEv, 'sg', 'e.com').recurrence,
         ['RRULE:FREQ=WEEKLY']);

  const instanceEv = { id: 'r1_20260925T100000Z', recurringEventId: 'r1',
                       start: { dateTime: t1 }, end: { dateTime: t2 },
                       recurrence: ['RRULE:FREQ=WEEKLY'] };
  assertFalse('no recurrence on instance (has recurringEventId)',
              'recurrence' in buildMirror_(instanceEv, 'sg', 'e.com'));

  const noLabelMirror = buildMirror_(simpleEv, 'sg', '');
  assert('summary without label', noLabelMirror.summary, 'Busy');

  // ── isMirror_ ────────────────────────────────────────────────
  startSection_('isMirror_');
  assertTrue ('EXT_BY prop',
    isMirror_({ extendedProperties: { private: { [EXT_BY]: BY_VALUE } } }));
  assertTrue ('EXT_SOURCE_ID prop',
    isMirror_({ extendedProperties: { private: { [EXT_SOURCE_ID]: 'abc' } } }));
  assertTrue ('EXT_SYNC_GROUP shared',
    isMirror_({ extendedProperties: { shared: { [EXT_SYNC_GROUP]: 'some-uuid' } } }));
  assertTrue ('title "Busy"',            isMirror_({ summary: 'Busy' }));
  assertTrue ('title "Busy [domain]"',   isMirror_({ summary: 'Busy [example.com]' }));
  assertFalse('regular event',           isMirror_({ summary: 'Team standup' }));
  assertFalse('no props, no title',      isMirror_({}));
  assertFalse('unrelated title',         isMirror_({ summary: 'Lunch' }));

  // ── Recurring event: instance detection ─────────────────────
  // Mirrors the inline logic in syncFrom_:
  //   const isInstance = ev.recurringEventId || /_\d{8}T/.test(ev.id);
  startSection_('recurring: instance detection');
  const isInstance = (ev) => !!(ev.recurringEventId || /_\d{8}T/.test(ev.id));

  assertFalse('regular event is not instance',        isInstance({ id: 'abc123' }));
  assertTrue ('recurringEventId marks as instance',   isInstance({ id: 'abc123', recurringEventId: 'abc' }));
  assertTrue ('_YYYYMMDDTHHMMSSZ suffix — instance',  isInstance({ id: 'abc123_20260925T100000Z' }));
  assertTrue ('_YYYYMMDDTHHMMSS (no Z) — instance',   isInstance({ id: 'abc123_20260925T100000' }));
  assertFalse('fb_ synthetic id is not instance',     isInstance({ id: 'fb_xk3j2yx20260925T100000x20260925T110000' }));
  assertFalse('id with date but no T — not instance', isInstance({ id: 'abc_20260925' }));

  // ── Recurring event: master ID extraction ────────────────────
  // Mirrors the inline logic in syncFrom_:
  //   ev.recurringEventId || ev.id.replace(/_\d{8}T\w+$/, '')
  startSection_('recurring: master ID extraction');
  const extractMasterId = (ev) =>
    ev.recurringEventId || ev.id.replace(/_\d{8}T\w+$/, '');

  assert('recurringEventId used directly',
    extractMasterId({ id: 'abc_20260925T100000Z', recurringEventId: 'abc' }), 'abc');
  assert('strips _YYYYMMDDTHHMMSSZ suffix',
    extractMasterId({ id: 'abc123_20260925T100000Z' }), 'abc123');
  assert('strips _YYYYMMDDTHHMMSS (no Z)',
    extractMasterId({ id: 'event_20260101T090000' }), 'event');
  assert('plain id returns unchanged',
    extractMasterId({ id: 'masteronly' }), 'masteronly');
  assert('long base id preserved',
    extractMasterId({ id: 'xyz_abc_20260101T000000Z' }), 'xyz_abc');

  // ── Recurring event: buildMirror_ behaviour ──────────────────
  startSection_('recurring: buildMirror_ recurrence handling');

  // Master with recurrence → rule is copied
  const masterEv = { id: 'master1', start: { dateTime: t1 }, end: { dateTime: t2 },
                     recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'] };
  const masterMirror = buildMirror_(masterEv, 'sg', 'example.com');
  assert('master: recurrence rule copied',
    masterMirror.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=MO']);

  // Instance (has recurringEventId) → recurrence NOT copied even if field present
  const instanceEv2 = { id: 'master1_20260929T100000Z', recurringEventId: 'master1',
                        start: { dateTime: t1 }, end: { dateTime: t2 },
                        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'] };
  assertFalse('instance: recurrence NOT copied (recurringEventId set)',
    'recurrence' in buildMirror_(instanceEv2, 'sg', 'example.com'));

  // Event without recurrence field → no recurrence on mirror
  const singleEv = { id: 'single1', start: { dateTime: t1 }, end: { dateTime: t2 } };
  assertFalse('single event: no recurrence field', 'recurrence' in buildMirror_(singleEv, 'sg', 'e.com'));

  // mirrorNeedsUpdate_ when recurrence rule changes (e.g. WEEKLY → DAILY)
  assertTrue ('recurrence rule change → needs update',
    mirrorNeedsUpdate_(
      { start: { dateTime: t1 }, end: { dateTime: t2 }, recurrence: ['RRULE:FREQ=DAILY'] },
      makeKeep('master1', t1, t2, ['RRULE:FREQ=WEEKLY'])));

  // mirrorNeedsUpdate_ when recurrence is removed (series ended)
  assertTrue ('recurrence removed → needs update',
    mirrorNeedsUpdate_(
      { start: { dateTime: t1 }, end: { dateTime: t2 }, recurrence: [] },
      makeKeep('master1', t1, t2, ['RRULE:FREQ=WEEKLY'])));

  // ── Date range: isInWindow_ edge cases ───────────────────────
  startSection_('date range: isInWindow_ edge cases');

  // Boundary: event ends exactly at window start → false (evEnd > windowStart is strict)
  // We approximate "exactly" as 1 ms before to avoid clock jitter.
  assertFalse('event ends at window start boundary (exclusive)',
    isInWindow_(
      { start: { dateTime: ms(now - 8 * 86400000) },
        end:   { dateTime: ms(now - 7 * 86400000) } },
      7, 7));

  // Event starts 1 hour past window end → outside window.
  // We can't test the exact boundary (isInWindow_ calls Date.now() internally,
  // so its window end is always a few ms ahead of the captured `now`).
  assertFalse('event starts 1h past window end → outside window',
    isInWindow_(
      { start: { dateTime: ms(now + 7 * 86400000 + 3600000) },
        end:   { dateTime: ms(now + 8 * 86400000) } },
      7, 7));

  // Zero-width window: only events in progress right now qualify
  assertTrue ('zero window: event spanning now qualifies',
    isInWindow_(
      { start: { dateTime: ms(now - 1000) }, end: { dateTime: ms(now + 1000) } },
      0, 0));
  assertFalse('zero window: past event does not qualify',
    isInWindow_(
      { start: { dateTime: ms(now - 2 * 86400000) }, end: { dateTime: ms(now - 1 * 86400000) } },
      0, 0));

  // Multi-day event that spans the entire window
  assertTrue ('multi-day event spanning full window',
    isInWindow_(
      { start: { dateTime: ms(now - 10 * 86400000) }, end: { dateTime: ms(now + 10 * 86400000) } },
      7, 7));

  // All-day: event yesterday within a ±7-day window
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  assertTrue ('all-day event yesterday in ±7 window',
    isInWindow_({ start: { date: yesterday }, end: { date: todayDate } }, 7, 7));

  // All-day: event 8 days ago outside a ±7-day window
  const eightDaysAgo = new Date(now - 8 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  assertFalse('all-day event 8 days ago outside ±7 window',
    isInWindow_({ start: { date: eightDaysAgo }, end: { date: sevenDaysAgo } }, 7, 7));

  // ── Mock data: findMirrors_ ───────────────────────────────────
  // findMirrors_ is pure — it reads a pre-built cache object and returns an array.
  startSection_('mock: findMirrors_');

  const SG   = 'test-uuid-sg';
  const LABE = 'example.com';

  function makeMockMirror(mirrorId, srcId, startIso, endIso, createdIso, status) {
    return {
      id: mirrorId,
      summary: 'Busy [' + LABE + ']',
      status: status || 'confirmed',
      start: { dateTime: startIso },
      end:   { dateTime: endIso },
      created: createdIso || '2026-01-01T00:00:00Z',
      extendedProperties: {
        private: { [EXT_SOURCE_ID]: srcId, [EXT_BY]: BY_VALUE },
        shared:  { [EXT_SYNC_GROUP]: SG },
      },
    };
  }

  const m1 = makeMockMirror('mirror_001', 'src_abc', t1, t2, '2026-09-01T00:00:00Z');
  const m2 = makeMockMirror('mirror_002', 'src_abc', t1, t2, '2026-09-02T00:00:00Z');
  const mCancelled = makeMockMirror('mirror_003', 'src_abc', t1, t2, '2026-09-03T00:00:00Z', 'cancelled');

  const emptyCache    = {};
  const oneActive     = { 'src_abc': [m1] };
  const twoCopies     = { 'src_abc': [m2, m1] };          // m2 created after m1
  const onlyCancelled = { 'src_abc': [mCancelled] };
  const mixedCache    = { 'src_abc': [m1, mCancelled] };

  const fakeEv = { id: 'src_abc' };

  assert('no cache entry → []',
    findMirrors_(fakeEv, 'cal', emptyCache), []);
  assert('one active mirror → [m1]',
    findMirrors_(fakeEv, 'cal', oneActive), [m1]);
  assert('cancelled mirror filtered out → []',
    findMirrors_(fakeEv, 'cal', onlyCancelled), []);
  assert('mixed: only active returned',
    findMirrors_(fakeEv, 'cal', mixedCache), [m1]);
  assert('two copies sorted by created — oldest first',
    findMirrors_(fakeEv, 'cal', twoCopies), [m1, m2]);  // m1 created earlier

  // ── Mock data: dedup_ ─────────────────────────────────────────
  startSection_('mock: dedup_');

  assert('null → null',  dedup_(null,  'cal', true), null);
  assert('[] → null',    dedup_([],    'cal', true), null);
  assert('[m1] → m1',    dedup_([m1],  'cal', true), m1);
  assert('[m1,m2] → m1 (m2 logged as dup, not deleted in dryRun)',
    dedup_([m1, m2], 'cal', true), m1);

  // ── Mock data: scenario tests ─────────────────────────────────
  // describeAction_ traces the same decision tree as processMirror_ using only
  // pure helpers — no Calendar API calls. Returns 'CREATE', 'UPDATE', 'NOOP',
  // 'DELETE', or 'SKIP_CANCELLED'.
  startSection_('mock: scenarios');

  function describeAction_(ev, cache) {
    const matches = findMirrors_(ev, null, cache);
    const keep    = matches.length ? matches[0] : null;
    if (ev.status === 'cancelled') return keep ? 'DELETE' : 'SKIP_CANCELLED';
    const resource = buildMirror_(ev, SG, LABE);
    if (!keep) return 'CREATE';
    return mirrorNeedsUpdate_(resource, keep) ? 'UPDATE' : 'NOOP';
  }

  // Scenario helpers — mock source events
  function srcEv(id, startIso, endIso, extra) {
    return Object.assign({ id: id, status: 'confirmed',
      start: { dateTime: startIso }, end: { dateTime: endIso } }, extra || {});
  }
  function cacheFor(srcId, mirror) {
    const c = {}; if (mirror) c[srcId] = [mirror]; return c;
  }

  const active = srcEv('src_1', t1, t2);
  const exactMirror = makeMockMirror('m_1', 'src_1', t1, t2);        // identical times
  const staleMirror = makeMockMirror('m_1', 'src_1', t1, t3);        // mirror has old end time

  assert('new event, no mirror → CREATE',
    describeAction_(active, emptyCache), 'CREATE');

  assert('active event, mirror matches → NOOP',
    describeAction_(active, cacheFor('src_1', exactMirror)), 'NOOP');

  assert('active event, mirror time changed → UPDATE',
    describeAction_(active, cacheFor('src_1', staleMirror)), 'UPDATE');

  // Recurrence change → UPDATE
  const recurSrc    = srcEv('src_2', t1, t2, { recurrence: ['RRULE:FREQ=DAILY'] });
  const recurMirror = makeMockMirror('m_2', 'src_2', t1, t2);
  recurMirror.recurrence = ['RRULE:FREQ=WEEKLY'];
  assert('recurring event, rule changed → UPDATE',
    describeAction_(recurSrc, cacheFor('src_2', recurMirror)), 'UPDATE');

  // Cancelled event with mirror → DELETE
  const cancelled = { id: 'src_1', status: 'cancelled' };
  assert('cancelled event, mirror exists → DELETE',
    describeAction_(cancelled, cacheFor('src_1', exactMirror)), 'DELETE');

  // Cancelled event, no mirror → SKIP_CANCELLED
  assert('cancelled event, no mirror → SKIP_CANCELLED',
    describeAction_(cancelled, emptyCache), 'SKIP_CANCELLED');

  // All-day event, no mirror → CREATE
  const allDay = { id: 'src_3', status: 'confirmed',
                   start: { date: todayDate }, end: { date: tomorrowDate } };
  assert('all-day event, no mirror → CREATE',
    describeAction_(allDay, emptyCache), 'CREATE');

  // All-day event, unchanged mirror → NOOP
  const allDayMirror = makeMockMirror('m_3', 'src_3', t1, t2);
  allDayMirror.start = { date: todayDate };
  allDayMirror.end   = { date: tomorrowDate };
  assert('all-day event, mirror matches → NOOP',
    describeAction_(allDay, cacheFor('src_3', allDayMirror)), 'NOOP');

  // ── Mock data: processEvent_ guards ──────────────────────────
  // processEvent_ skips events that are mirrors, instances, missing start/end,
  // or non-default eventType. We test each guard condition using the pure helpers
  // it relies on (isMirror_, recurringEventId check) rather than calling the
  // function directly (which would require a live Calendar service).
  startSection_('mock: processEvent_ guard conditions');

  assertTrue ('mirror event skipped (isMirror_ by EXT_BY)',
    isMirror_({ extendedProperties: { private: { [EXT_BY]: BY_VALUE } } }));
  assertTrue ('mirror event skipped (isMirror_ by title)',
    isMirror_({ summary: 'Busy [example.com]' }));
  assertTrue ('instance skipped (has recurringEventId)',
    !!{ id: 'abc_inst', recurringEventId: 'abc' }.recurringEventId);
  assertFalse('master not skipped (no recurringEventId)',
    !!{ id: 'abc', recurrence: ['RRULE:FREQ=WEEKLY'] }.recurringEventId);
  assertFalse('missing start → would be skipped',
    !!{ id: 'x', end: { dateTime: t1 } }.start);
  assertFalse('non-default eventType → would be skipped',
    (({ eventType: 'outOfOffice' }).eventType || 'default') === 'default');
  assertTrue ('default eventType passes guard',
    (({ eventType: 'default' }).eventType || 'default') === 'default');
  assertTrue ('missing eventType treated as default',
    (({}).eventType || 'default') === 'default');

  // ── 3-calendar: B→A and C→A (A=primary, B+C=sources) ────────
  // Architecture: syncAll_ calls syncFrom_(B,[A]) then syncFrom_(C,[A]).
  // Each source writes mirrors keyed by its own event IDs into A's cache.
  startSection_('3-calendar: A=primary B+C=sources');

  const CAL_A   = 'a@personal.com';
  const CAL_B   = 'b@company.com';
  const CAL_C   = 'c@client.org';
  const LABEL_B = domainLabel_(CAL_B);   // 'company.com'
  const LABEL_C = domainLabel_(CAL_C);   // 'client.org'

  // Parameterised version of describeAction_ so each source uses its own label.
  function describeActionFor_(ev, cache, label) {
    const matches = findMirrors_(ev, null, cache);
    const keep    = matches.length ? matches[0] : null;
    if (ev.status === 'cancelled') return keep ? 'DELETE' : 'SKIP_CANCELLED';
    const resource = buildMirror_(ev, SG, label);
    if (!keep) return 'CREATE';
    return mirrorNeedsUpdate_(resource, keep) ? 'UPDATE' : 'NOOP';
  }

  function makeMirrorFor_(mirrorId, srcId, label, startIso, endIso, createdIso) {
    return {
      id: mirrorId,
      summary: 'Busy [' + label + ']',
      status: 'confirmed',
      start: { dateTime: startIso },
      end:   { dateTime: endIso },
      created: createdIso || '2026-01-01T00:00:00Z',
      extendedProperties: {
        private: { [EXT_SOURCE_ID]: srcId, [EXT_BY]: BY_VALUE },
        shared:  { [EXT_SYNC_GROUP]: SG },
      },
    };
  }

  // Domain labels extracted correctly
  assert('domainLabel_ for B', LABEL_B, 'company.com');
  assert('domainLabel_ for C', LABEL_C, 'client.org');

  // New events from B and C → both CREATE on A
  const evB = srcEv('b_ev1', t1, t2);
  const evC = srcEv('c_ev1', t1, t2);
  assert('B new event → CREATE on A', describeActionFor_(evB, {}, LABEL_B), 'CREATE');
  assert('C new event → CREATE on A', describeActionFor_(evC, {}, LABEL_C), 'CREATE');

  // Mirrors have distinct labels — no collision even at the same time slot
  const mirB = buildMirror_(evB, SG, LABEL_B);
  const mirC = buildMirror_(evC, SG, LABEL_C);
  assert('B mirror summary', mirB.summary, 'Busy [company.com]');
  assert('C mirror summary', mirC.summary, 'Busy [client.org]');
  assertFalse('B and C mirrors have different summaries', mirB.summary === mirC.summary);

  // A's cache after first sync: both mirrors stored under their own source event IDs
  const mirB1 = makeMirrorFor_('mb_1', 'b_ev1', LABEL_B, t1, t2);
  const mirC1 = makeMirrorFor_('mc_1', 'c_ev1', LABEL_C, t1, t2);
  const cacheA3 = { 'b_ev1': [mirB1], 'c_ev1': [mirC1] };

  // Second sync pass: both events unchanged → NOOP for both
  assert('B unchanged on 2nd pass → NOOP', describeActionFor_(evB, cacheA3, LABEL_B), 'NOOP');
  assert('C unchanged on 2nd pass → NOOP', describeActionFor_(evC, cacheA3, LABEL_C), 'NOOP');

  // B event rescheduled → UPDATE B mirror; C mirror untouched
  const evBMoved = srcEv('b_ev1', t1, t3);   // end shifted
  assert('B rescheduled → UPDATE B mirror',  describeActionFor_(evBMoved, cacheA3, LABEL_B), 'UPDATE');
  assert('C unchanged after B reschedule → NOOP', describeActionFor_(evC, cacheA3, LABEL_C), 'NOOP');

  // B event cancelled → DELETE B mirror; C mirror unaffected
  const cancelB = { id: 'b_ev1', status: 'cancelled' };
  assert('B cancelled → DELETE B mirror',      describeActionFor_(cancelB, cacheA3, LABEL_B), 'DELETE');
  assert('C unaffected by B cancellation → NOOP', describeActionFor_(evC, cacheA3, LABEL_C), 'NOOP');

  // C event cancelled → DELETE C mirror; B mirror unaffected
  const cancelC = { id: 'c_ev1', status: 'cancelled' };
  assert('C cancelled → DELETE C mirror',      describeActionFor_(cancelC, cacheA3, LABEL_C), 'DELETE');
  assert('B unaffected by C cancellation → NOOP', describeActionFor_(evB, cacheA3, LABEL_B), 'NOOP');

  // Source ID isolation: B's event ID does not find C's mirror and vice versa
  assert('B event ID misses C mirror', findMirrors_({ id: 'b_ev1' }, CAL_A, { 'c_ev1': [mirC1] }), []);
  assert('C event ID misses B mirror', findMirrors_({ id: 'c_ev1' }, CAL_A, { 'b_ev1': [mirB1] }), []);

  // Loop prevention: mirrors on A must NOT be re-mirrored when B or C processes A's events.
  // processEvent_ calls isMirror_(ev) and returns early if true.
  assertTrue ('B mirror on A: isMirror_ by EXT_BY',        isMirror_(mirB1));
  assertTrue ('C mirror on A: isMirror_ by EXT_BY',        isMirror_(mirC1));
  assertTrue ('B mirror on A: isMirror_ by title fallback', isMirror_({ summary: 'Busy [company.com]' }));
  assertTrue ('C mirror on A: isMirror_ by title fallback', isMirror_({ summary: 'Busy [client.org]' }));
  assertFalse('Regular event on A: not a mirror',           isMirror_({ summary: 'Team standup' }));

  // ── Bidirectional A↔B: no duplicates or mirror-of-mirror loops ──
  // Scenario: two separate add-on installations.
  //   Installation-1 on account A: calendars=[A,B] → syncFrom_(B,[A])
  //   Installation-2 on account B: calendars=[B,A] → syncFrom_(A,[B])
  // Risk: could the mirror placed on A by installation-1 get re-mirrored
  // onto B by installation-2, and vice versa ad infinitum?
  startSection_('bidirectional A↔B: mirror-of-mirror / duplicate guard');

  const SG_INST1 = 'sg-installation-1';   // sync group UUID for account A's install
  const SG_INST2 = 'sg-installation-2';   // sync group UUID for account B's install
  const LABEL_A  = 'personal.com';
  const LABEL_B2 = 'company.com';

  // Real events (not mirrors) — one on each calendar
  const realEvOnA = { id: 'a_real_1', status: 'confirmed',
                      start: { dateTime: t1 }, end: { dateTime: t2 },
                      summary: 'Doctor appointment' };
  const realEvOnB = { id: 'b_real_1', status: 'confirmed',
                      start: { dateTime: t1 }, end: { dateTime: t2 },
                      summary: 'Team standup' };

  // Installation-1 runs: b_real_1 on B → mirror placed on A
  const mirrorOfB_onA = {
    id: 'mir_b_on_a', summary: 'Busy [company.com]', status: 'confirmed',
    start: { dateTime: t1 }, end: { dateTime: t2 },
    created: '2026-09-01T00:00:00Z',
    extendedProperties: {
      private: { [EXT_SOURCE_ID]: 'b_real_1', [EXT_BY]: BY_VALUE },
      shared:  { [EXT_SYNC_GROUP]: SG_INST1 },
    },
  };

  // Installation-2 runs: a_real_1 on A → mirror placed on B
  const mirrorOfA_onB = {
    id: 'mir_a_on_b', summary: 'Busy [personal.com]', status: 'confirmed',
    start: { dateTime: t1 }, end: { dateTime: t2 },
    created: '2026-09-01T00:00:00Z',
    extendedProperties: {
      private: { [EXT_SOURCE_ID]: 'a_real_1', [EXT_BY]: BY_VALUE },
      shared:  { [EXT_SYNC_GROUP]: SG_INST2 },
    },
  };

  // ① Real events are NOT mirrors — sync should process them
  assertFalse('real event on A is not a mirror', isMirror_(realEvOnA));
  assertFalse('real event on B is not a mirror', isMirror_(realEvOnB));

  // ② Mirrors are detected — sync must skip them
  assertTrue ('mirror of B on A → isMirror_ by EXT_BY',          isMirror_(mirrorOfB_onA));
  assertTrue ('mirror of A on B → isMirror_ by EXT_BY',          isMirror_(mirrorOfA_onB));
  assertTrue ('mirror of B on A → isMirror_ by EXT_SYNC_GROUP',  isMirror_({ extendedProperties: { shared: { [EXT_SYNC_GROUP]: SG_INST1 } } }));
  assertTrue ('mirror of A on B → isMirror_ by EXT_SYNC_GROUP',  isMirror_({ extendedProperties: { shared: { [EXT_SYNC_GROUP]: SG_INST2 } } }));

  // ③ Title fallback: even without extended properties, mirror title stops re-mirroring
  assertTrue ('Busy [company.com] detected as mirror by title',  isMirror_({ summary: 'Busy [company.com]' }));
  assertTrue ('Busy [personal.com] detected as mirror by title', isMirror_({ summary: 'Busy [personal.com]' }));

  // ④ Installation-2 processes A's events. The mirror placed on A by installation-1
  //    (mirrorOfB_onA) must be skipped — it must NOT be re-mirrored onto B.
  //    describeActionFor_ would never be called for it because isMirror_ gates it.
  assertTrue ('installation-2 skips mirror-of-B on A (gate check)', isMirror_(mirrorOfB_onA));

  // ⑤ Installation-1 processes B's events. The mirror placed on B by installation-2
  //    (mirrorOfA_onB) must be skipped — it must NOT be re-mirrored onto A.
  assertTrue ('installation-1 skips mirror-of-A on B (gate check)', isMirror_(mirrorOfA_onB));

  // ⑥ Same event on both calendars: user adds "Meeting" to A AND to B independently.
  //    Installation-1: b_meeting → CREATE "Busy [company.com]" on A (source_id = b_meeting)
  //    Installation-2: a_meeting → CREATE "Busy [personal.com]" on B (source_id = a_meeting)
  //    The two mirrors have different source IDs — they are distinct, not duplicates.
  const bMeeting = srcEv('b_meeting', t1, t2);
  const aMeeting = srcEv('a_meeting', t1, t2);
  const mirBMeeting = buildMirror_(bMeeting, SG_INST1, LABEL_B2);
  const mirAMeeting = buildMirror_(aMeeting, SG_INST2, LABEL_A);

  assert('B meeting mirror source_id = b_meeting',
    mirBMeeting.extendedProperties.private[EXT_SOURCE_ID], 'b_meeting');
  assert('A meeting mirror source_id = a_meeting',
    mirAMeeting.extendedProperties.private[EXT_SOURCE_ID], 'a_meeting');
  assertFalse('two concurrent mirrors have different source IDs — not duplicates',
    mirBMeeting.extendedProperties.private[EXT_SOURCE_ID] ===
    mirAMeeting.extendedProperties.private[EXT_SOURCE_ID]);

  // ⑦ Cache isolation: source IDs from different calendars never collide in the cache
  const cacheABi = { 'b_meeting': [mirBMeeting] };
  const cacheBBi = { 'a_meeting': [mirAMeeting] };

  assert('A cache: b_meeting found',  findMirrors_({ id: 'b_meeting' }, CAL_A, cacheABi).length, 1);
  assert('A cache: a_meeting absent', findMirrors_({ id: 'a_meeting' }, CAL_A, cacheABi).length, 0);
  assert('B cache: a_meeting found',  findMirrors_({ id: 'a_meeting' }, CAL_B, cacheBBi).length, 1);
  assert('B cache: b_meeting absent', findMirrors_({ id: 'b_meeting' }, CAL_B, cacheBBi).length, 0);

  // ── Full mesh A↔B, B↔C, A↔C (3 installations, 6 directions) ─
  // Install_A: primary=A, sources=[B,C] → syncFrom_(B,[A]), syncFrom_(C,[A])
  // Install_B: primary=B, sources=[A,C] → syncFrom_(A,[B]), syncFrom_(C,[B])
  // Install_C: primary=C, sources=[A,B] → syncFrom_(A,[C]), syncFrom_(B,[C])
  startSection_('full mesh A↔B↔C: 3 installs, 6 sync directions');

  const SG_IA = 'sg-install-a';
  const SG_IB = 'sg-install-b';
  const SG_IC = 'sg-install-c';
  const LAB_A = 'personal.com';
  const LAB_B = 'company.com';
  const LAB_C = 'client.org';

  // One real event on each calendar (mesh_ prefix avoids redeclaration)
  const mesh_evA = srcEv('a_ev1', t1, t2);
  const mesh_evB = srcEv('b_ev1', t1, t2);
  const mesh_evC = srcEv('c_ev1', t1, t2);

  // Mirrors produced by each installation
  const mirB_onA = buildMirror_(mesh_evB, SG_IA, LAB_B);   // Install_A: B→A
  const mirC_onA = buildMirror_(mesh_evC, SG_IA, LAB_C);   // Install_A: C→A
  const mirA_onB = buildMirror_(mesh_evA, SG_IB, LAB_A);   // Install_B: A→B
  const mirC_onB = buildMirror_(mesh_evC, SG_IB, LAB_C);   // Install_B: C→B
  const mirA_onC = buildMirror_(mesh_evA, SG_IC, LAB_A);   // Install_C: A→C
  const mirB_onC = buildMirror_(mesh_evB, SG_IC, LAB_B);   // Install_C: B→C

  // 1. Mirror summaries are correct for all 6 directions
  assert('B→A mirror summary', mirB_onA.summary, 'Busy [company.com]');
  assert('C→A mirror summary', mirC_onA.summary, 'Busy [client.org]');
  assert('A→B mirror summary', mirA_onB.summary, 'Busy [personal.com]');
  assert('C→B mirror summary', mirC_onB.summary, 'Busy [client.org]');
  assert('A→C mirror summary', mirA_onC.summary, 'Busy [personal.com]');
  assert('B→C mirror summary', mirB_onC.summary, 'Busy [company.com]');

  // 2. All 6 mirrors detected by isMirror_ — direct loop guard
  assertTrue('isMirror_: mirB_onA', isMirror_(mirB_onA));
  assertTrue('isMirror_: mirC_onA', isMirror_(mirC_onA));
  assertTrue('isMirror_: mirA_onB', isMirror_(mirA_onB));
  assertTrue('isMirror_: mirC_onB', isMirror_(mirC_onB));
  assertTrue('isMirror_: mirA_onC', isMirror_(mirA_onC));
  assertTrue('isMirror_: mirB_onC', isMirror_(mirB_onC));

  // 3. Chain loop prevention: mirror placed on A by Install_A (mirB_onA, mirC_onA)
  //    must be skipped by Install_C when it reads A as a source (A→C run).
  //    Likewise mirrors on B must be skipped by Install_A (B→A run), etc.
  assertTrue('Install_C skips mirB_onA reading A→C', isMirror_(mirB_onA));
  assertTrue('Install_C skips mirC_onA reading A→C', isMirror_(mirC_onA));
  assertTrue('Install_B skips mirA_onC reading C→B', isMirror_(mirA_onC));
  assertTrue('Install_B skips mirB_onC reading C→B', isMirror_(mirB_onC));
  assertTrue('Install_A skips mirA_onB reading B→A', isMirror_(mirA_onB));
  assertTrue('Install_A skips mirA_onC reading C→A', isMirror_(mirA_onC));

  // 3b. isMirror_ fires on ANY non-empty EXT_SYNC_GROUP value, not just a known UUID.
  //     This is the key cross-installation guard: installation B does not need to know
  //     installation A's UUID — presence of the shared property is enough.
  assertTrue('isMirror_: unknown foreign UUID in EXT_SYNC_GROUP still detected',
    isMirror_({ extendedProperties: { shared: { [EXT_SYNC_GROUP]: 'some-other-install-uuid' } } }));
  assertFalse('isMirror_: empty EXT_SYNC_GROUP does NOT trigger',
    isMirror_({ extendedProperties: { shared: { [EXT_SYNC_GROUP]: '' } } }));

  // 4. Real events are never mistaken for mirrors
  assertFalse('real event on A: not a mirror', isMirror_(mesh_evA));
  assertFalse('real event on B: not a mirror', isMirror_(mesh_evB));
  assertFalse('real event on C: not a mirror', isMirror_(mesh_evC));

  // 5. Build mock caches as they would exist after the first full sync
  function stored_(id, mirObj) {
    return Object.assign({}, mirObj, { id: id, created: '2026-09-01T00:00:00Z' });
  }
  const cacheA_m = { 'b_ev1': [stored_('mBA', mirB_onA)], 'c_ev1': [stored_('mCA', mirC_onA)] };
  const cacheB_m = { 'a_ev1': [stored_('mAB', mirA_onB)], 'c_ev1': [stored_('mCB', mirC_onB)] };
  const cacheC_m = { 'a_ev1': [stored_('mAC', mirA_onC)], 'b_ev1': [stored_('mBC', mirB_onC)] };

  // Each cache finds its own mirrors and not the other calendar's
  assert('A cache: b_ev1 found',   findMirrors_({id:'b_ev1'}, CAL_A, cacheA_m).length, 1);
  assert('A cache: c_ev1 found',   findMirrors_({id:'c_ev1'}, CAL_A, cacheA_m).length, 1);
  assert('A cache: a_ev1 absent',  findMirrors_({id:'a_ev1'}, CAL_A, cacheA_m).length, 0);
  assert('B cache: a_ev1 found',   findMirrors_({id:'a_ev1'}, CAL_B, cacheB_m).length, 1);
  assert('B cache: c_ev1 found',   findMirrors_({id:'c_ev1'}, CAL_B, cacheB_m).length, 1);
  assert('B cache: b_ev1 absent',  findMirrors_({id:'b_ev1'}, CAL_B, cacheB_m).length, 0);
  assert('C cache: a_ev1 found',   findMirrors_({id:'a_ev1'}, CAL_C, cacheC_m).length, 1);
  assert('C cache: b_ev1 found',   findMirrors_({id:'b_ev1'}, CAL_C, cacheC_m).length, 1);
  assert('C cache: c_ev1 absent',  findMirrors_({id:'c_ev1'}, CAL_C, cacheC_m).length, 0);

  // 6. Cancellation isolation: cancel A's event
  //    Install_B → DELETE mirA_onB from B
  //    Install_C → DELETE mirA_onC from C
  //    B and C's own mirrors from the other sources are unaffected
  const cancelEvA = { id: 'a_ev1', status: 'cancelled' };
  assert('A cancelled: Install_B deletes mirA_onB',     describeActionFor_(cancelEvA, cacheB_m, LAB_A), 'DELETE');
  assert('A cancelled: Install_C deletes mirA_onC',     describeActionFor_(cancelEvA, cacheC_m, LAB_A), 'DELETE');
  assert('A cancelled: C→B mirror on B unaffected',     describeActionFor_(mesh_evC, cacheB_m, LAB_C), 'NOOP');
  assert('A cancelled: B→A mirror on A unaffected',     describeActionFor_(mesh_evB, cacheA_m, LAB_B), 'NOOP');
  assert('A cancelled: C→A mirror on A unaffected',     describeActionFor_(mesh_evC, cacheA_m, LAB_C), 'NOOP');

  // Cancel B's event
  const cancelEvB = { id: 'b_ev1', status: 'cancelled' };
  assert('B cancelled: Install_A deletes mirB_onA',     describeActionFor_(cancelEvB, cacheA_m, LAB_B), 'DELETE');
  assert('B cancelled: Install_C deletes mirB_onC',     describeActionFor_(cancelEvB, cacheC_m, LAB_B), 'DELETE');
  assert('B cancelled: A→B mirror on B unaffected',     describeActionFor_(mesh_evA, cacheB_m, LAB_A), 'NOOP');
  assert('B cancelled: C→B mirror on B unaffected',     describeActionFor_(mesh_evC, cacheB_m, LAB_C), 'NOOP');
  assert('B cancelled: C→A mirror on A unaffected',     describeActionFor_(mesh_evC, cacheA_m, LAB_C), 'NOOP');

  // Cancel C's event
  const cancelEvC = { id: 'c_ev1', status: 'cancelled' };
  assert('C cancelled: Install_A deletes mirC_onA',     describeActionFor_(cancelEvC, cacheA_m, LAB_C), 'DELETE');
  assert('C cancelled: Install_B deletes mirC_onB',     describeActionFor_(cancelEvC, cacheB_m, LAB_C), 'DELETE');
  assert('C cancelled: A→B mirror on B unaffected',     describeActionFor_(mesh_evA, cacheB_m, LAB_A), 'NOOP');
  assert('C cancelled: B→A mirror on A unaffected',     describeActionFor_(mesh_evB, cacheA_m, LAB_B), 'NOOP');
  assert('C cancelled: A→C mirror on C unaffected',     describeActionFor_(mesh_evA, cacheC_m, LAB_A), 'NOOP');

  // 7. Second sync pass: all events unchanged → all NOOP (no duplicate creates)
  assert('2nd pass: B event on A → NOOP', describeActionFor_(mesh_evB, cacheA_m, LAB_B), 'NOOP');
  assert('2nd pass: C event on A → NOOP', describeActionFor_(mesh_evC, cacheA_m, LAB_C), 'NOOP');
  assert('2nd pass: A event on B → NOOP', describeActionFor_(mesh_evA, cacheB_m, LAB_A), 'NOOP');
  assert('2nd pass: C event on B → NOOP', describeActionFor_(mesh_evC, cacheB_m, LAB_C), 'NOOP');
  assert('2nd pass: A event on C → NOOP', describeActionFor_(mesh_evA, cacheC_m, LAB_A), 'NOOP');
  assert('2nd pass: B event on C → NOOP', describeActionFor_(mesh_evB, cacheC_m, LAB_B), 'NOOP');

  // ── Trigger lifecycle: orphan / duplicate / silent-death guards ──
  // ScriptApp is not available in unit tests, so these tests verify the
  // PURE LOGIC CONDITIONS that govern trigger creation/deletion decisions.
  // Each test documents which code path it corresponds to.
  startSection_('trigger lifecycle: orphan / duplicate / death guards');

  // Helper: simulate the wasSyncRunning decision in scheduleBackground_.
  //   wasSyncRunning = !!(triggerId && isTriggerAlive_(triggerId))
  // isTriggerAlive_ is ScriptApp-bound; we test the boolean combinations instead.
  function wasSyncRunning_(triggerId, isAlive) {
    return !!(triggerId && isAlive);
  }

  // PROP_TRIGGER_ID absent → sync was not running
  assertFalse('wasSyncRunning: no triggerId → false',      wasSyncRunning_(null,       true));
  assertFalse('wasSyncRunning: empty triggerId → false',   wasSyncRunning_('',         true));
  // PROP_TRIGGER_ID present but trigger deleted (e.g. manual console deletion) → false
  assertFalse('wasSyncRunning: id present, trigger gone → false', wasSyncRunning_('abc123', false));
  // PROP_TRIGGER_ID present and trigger alive → sync was running
  assertTrue ('wasSyncRunning: id present, trigger alive → true', wasSyncRunning_('abc123', true));

  // ── Op routing: which ops recreate the runSync trigger? ──────
  // Mirrors the if/else chain in runBackground (Code.js:55-84).
  // createTrigger_ is called for: initialSync, startSync, fullResync.
  // For 'cleanup': only if wasSyncRunning.
  // For 'stopAndClear': never.
  function opRestoresTrigger_(op, wasSyncRunningFlag) {
    if (op === 'initialSync')  return true;
    if (op === 'startSync')    return true;
    if (op === 'fullResync')   return true;
    if (op === 'cleanup')      return !!wasSyncRunningFlag;
    if (op === 'stopAndClear') return false;
    return false;  // unknown op
  }

  assertTrue ('initialSync always creates trigger',            opRestoresTrigger_('initialSync',  false));
  assertTrue ('startSync always creates trigger',              opRestoresTrigger_('startSync',    false));
  assertTrue ('fullResync always creates trigger',             opRestoresTrigger_('fullResync',   false));
  assertTrue ('cleanup + was running → trigger restored',      opRestoresTrigger_('cleanup',      true));
  assertFalse('cleanup + was NOT running → no trigger',        opRestoresTrigger_('cleanup',      false));
  assertFalse('stopAndClear never creates trigger',            opRestoresTrigger_('stopAndClear', true));
  assertFalse('stopAndClear never creates trigger (not running)', opRestoresTrigger_('stopAndClear', false));
  assertFalse('unknown op never creates trigger',              opRestoresTrigger_('unknown',      true));

  // ── Silent trigger death: error before createTrigger_ ────────
  // If cleanupAllMirrors() or syncAll_() throws in runBackground, the catch
  // block stores PROP_LAST_OP_RESULT with ok=false but createTrigger_() is
  // never called — sync stops silently once the error banner ages out (2 min).
  // We verify the banner logic: result is shown only if ts < 2 minutes ago.
  function shouldShowBanner_(resultJson) {
    if (!resultJson) return false;
    const r = JSON.parse(resultJson);
    return (Date.now() - r.ts) < 2 * 60 * 1000;
  }

  const freshError  = JSON.stringify({ ok: false, op: 'initialSync', msg: 'quota exceeded', ts: Date.now() });
  const staleError  = JSON.stringify({ ok: false, op: 'initialSync', msg: 'quota exceeded', ts: Date.now() - 3 * 60 * 1000 });
  const freshOk     = JSON.stringify({ ok: true,  op: 'initialSync', ts: Date.now() });

  assertTrue ('fresh error result → banner shown',             shouldShowBanner_(freshError));
  assertFalse('stale error result (>2 min) → banner hidden',   shouldShowBanner_(staleError));
  assertTrue ('fresh success result → banner shown',           shouldShowBanner_(freshOk));
  assertFalse('no result → no banner',                         shouldShowBanner_(null));

  // ── Duplicate runSync deduplication ──────────────────────────
  // runSync() keeps the first trigger and deletes the rest.
  // We test the filter+slice logic using mock trigger-like objects.
  function dedupeRunSyncTriggers_(mockTriggers) {
    const matches = mockTriggers.filter(t => t.handler === 'runSync');
    const toDelete = matches.slice(1);          // keep index 0, delete the rest
    return { kept: matches.length - toDelete.length, deleted: toDelete.length };
  }

  const noTriggers   = [];
  const oneRunSync   = [{ handler: 'runSync', id: 't1' }];
  const twoRunSync   = [{ handler: 'runSync', id: 't1' }, { handler: 'runSync', id: 't2' }];
  const mixedTriggers = [{ handler: 'runSync', id: 't1' }, { handler: 'runBackground', id: 't2' }, { handler: 'runSync', id: 't3' }];

  assert('no triggers: nothing deleted',             dedupeRunSyncTriggers_(noTriggers),    { kept: 0, deleted: 0 });
  assert('one runSync: kept, none deleted',          dedupeRunSyncTriggers_(oneRunSync),    { kept: 1, deleted: 0 });
  assert('two runSync: one kept, one deleted',       dedupeRunSyncTriggers_(twoRunSync),    { kept: 1, deleted: 1 });
  assert('mixed: only runSync counted; 1 dup removed', dedupeRunSyncTriggers_(mixedTriggers), { kept: 1, deleted: 1 });

  // ── formatLastSync_ ──────────────────────────────────────────
  startSection_('formatLastSync_');
  const fls_now = Date.now();
  assert('30s ago → Just now',   formatLastSync_(new Date(fls_now - 30000).toISOString()),           'Just now');
  assert('59s ago → Just now',   formatLastSync_(new Date(fls_now - 59000).toISOString()),           'Just now');
  assert('5 min ago',            formatLastSync_(new Date(fls_now - 5 * 60000).toISOString()),       '5 min ago');
  assert('59 min ago',           formatLastSync_(new Date(fls_now - 59 * 60000).toISOString()),      '59 min ago');
  assert('1 hour ago (singular)', formatLastSync_(new Date(fls_now - 60 * 60000).toISOString()),     '1 hour ago');
  assert('2 hours ago (plural)',  formatLastSync_(new Date(fls_now - 2 * 3600000).toISOString()),    '2 hours ago');
  assert('5 hours ago',          formatLastSync_(new Date(fls_now - 5 * 3600000).toISOString()),     '5 hours ago');

  // ── readIntField_ ─────────────────────────────────────────────
  startSection_('readIntField_');
  function fi_(val) { return { pastDays: { stringInputs: { value: [val] } } }; }
  assert('valid integer',        readIntField_(fi_('7'),    'pastDays', 99), 7);
  assert('float truncated',      readIntField_(fi_('3.9'),  'pastDays', 99), 3);
  assert('0 → fallback',         readIntField_(fi_('0'),    'pastDays', 99), 99);
  assert('negative → fallback',  readIntField_(fi_('-5'),   'pastDays', 99), 99);
  assert('NaN string → fallback',readIntField_(fi_('abc'),  'pastDays', 99), 99);
  assert('empty string → fallback', readIntField_(fi_(''), 'pastDays', 99), 99);
  assert('missing key → fallback',  readIntField_({},       'pastDays', 99), 99);

  // ── privateProps_ / sharedProps_ ─────────────────────────────
  startSection_('privateProps_ / sharedProps_');
  assert('privateProps_: has private',  privateProps_({ extendedProperties: { private: { a: '1' } } }), { a: '1' });
  assert('privateProps_: no private',   privateProps_({ extendedProperties: {} }), {});
  assert('privateProps_: no extProps',  privateProps_({}), {});
  assert('sharedProps_: has shared',    sharedProps_({ extendedProperties: { shared: { b: '2' } } }), { b: '2' });
  assert('sharedProps_: no shared',     sharedProps_({ extendedProperties: {} }), {});
  assert('sharedProps_: no extProps',   sharedProps_({}), {});

  // ── fb_ synthetic ID generation ───────────────────────────────
  // Mirrors the inline pattern in syncFrom_:
  //   'fb_' + calHash + 'x' + s + (e ? 'x' + e : '')
  // where s/e are ISO strings with non-digit/non-T chars stripped.
  startSection_('fb_ synthetic ID generation');
  function makeFbId_(hash, ev) {
    const s = ((ev.start && (ev.start.dateTime || ev.start.date)) || '').replace(/[^0-9T]/g, '');
    const e = ((ev.end   && (ev.end.dateTime   || ev.end.date))   || '').replace(/[^0-9T]/g, '');
    return 'fb_' + hash + 'x' + s + (e ? 'x' + e : '');
  }
  const fbHash = calHash_('b@company.com');
  // [^0-9T] strips ALL non-digit non-T chars — including Z, colons, dashes
  assert('timed event: strips colons/dashes/Z',
    makeFbId_(fbHash, { start: { dateTime: '2026-09-25T10:00:00Z' }, end: { dateTime: '2026-09-25T11:00:00Z' } }),
    'fb_' + fbHash + 'x20260925T100000x20260925T110000');
  const stripped = '2026-09-25T10:00:00Z'.replace(/[^0-9T]/g, '');
  assert('ISO strip: only digits and T survive (Z removed)', stripped, '20260925T100000');
  assert('all-day event: strips dashes',
    makeFbId_(fbHash, { start: { date: '2026-09-25' }, end: { date: '2026-09-26' } }),
    'fb_' + fbHash + 'x20260925x20260926');
  assert('missing end: no second segment',
    makeFbId_(fbHash, { start: { dateTime: '2026-09-25T10:00:00Z' } }),
    'fb_' + fbHash + 'x20260925T100000');
  // Confirm fb_ IDs are never detected as recurring instances (no _YYYYMMDDTHHMMSS pattern)
  assertFalse('fb_ ID not detected as instance',
    /_\d{8}T/.test('fb_' + fbHash + 'x20260925T100000x20260925T110000'));

  // ── Error classification (syncAll_ per-calendar errors) ───────
  // Mirrors the inline logic in syncAll_ (Sync.js):
  //   isNotFound:  'Not Found' or '404'
  //   isForbidden: '403', 'forbidden', or 'insufficientPermissions'
  //   else: raw message
  startSection_('error classification');
  function classifyCalError_(srcId, errStr) {
    const isNotFound  = errStr.includes('Not Found') || errStr.includes('404');
    const isForbidden = errStr.includes('403') || errStr.includes('forbidden') || errStr.includes('insufficientPermissions');
    return isNotFound  ? srcId + ': calendar not found. Check the email address.'
         : isForbidden ? srcId + ': access denied'
         : srcId + ': ' + errStr;
  }
  const SRC = 'b@company.com';
  assert('404 string',              classifyCalError_(SRC, 'Error 404 Not Found'),   SRC + ': calendar not found. Check the email address.');
  assert('"Not Found" string',      classifyCalError_(SRC, 'Calendar Not Found'),    SRC + ': calendar not found. Check the email address.');
  assert('"404" alone',             classifyCalError_(SRC, '404'),                   SRC + ': calendar not found. Check the email address.');
  assert('"403" string',            classifyCalError_(SRC, 'Error 403'),             SRC + ': access denied');
  assert('"forbidden" lowercase',   classifyCalError_(SRC, 'Request forbidden'),     SRC + ': access denied');
  assert('insufficientPermissions', classifyCalError_(SRC, 'insufficientPermissions'), SRC + ': access denied');
  assert('unknown error → raw',     classifyCalError_(SRC, 'quota exceeded'),        SRC + ': quota exceeded');

  // ── hasCancelled / likelyFbCal ────────────────────────────────
  startSection_('hasCancelled / likelyFbCal');
  const hasCancelled_ = (instances) => instances.some(i => i.status === 'cancelled');
  const likelyFbCal_  = (instances) => instances.every(i => !i.summary);

  assertFalse('hasCancelled: empty array → false',    hasCancelled_([]));
  assertFalse('hasCancelled: all confirmed → false',  hasCancelled_([{ status: 'confirmed', summary: 'x' }]));
  assertTrue ('hasCancelled: one cancelled → true',   hasCancelled_([{ status: 'confirmed' }, { status: 'cancelled' }]));
  assertTrue ('hasCancelled: all cancelled → true',   hasCancelled_([{ status: 'cancelled' }]));

  // empty array → every() returns true → treated as free/busy (notable edge case)
  assertTrue ('likelyFbCal: empty array → true (every edge case)', likelyFbCal_([]));
  assertFalse('likelyFbCal: all have summary → false', likelyFbCal_([{ summary: 'Meeting' }]));
  assertTrue ('likelyFbCal: none have summary → true', likelyFbCal_([{ status: 'confirmed' }, { status: 'confirmed' }]));
  assertFalse('likelyFbCal: mixed → false',            likelyFbCal_([{ summary: 'x' }, {}]));

  // ── Recurring series routing ──────────────────────────────────
  // Mirrors the gate in syncFrom_:
  //   if (master && master.recurrence && master.recurrence.length && !hasCancelled)
  //     → one series mirror
  //   else → per-instance mirrors
  startSection_('recurring series routing');
  function seriesStrategy_(master, hasCancelledFlag) {
    return (master && master.recurrence && master.recurrence.length && !hasCancelledFlag)
      ? 'series' : 'per-instance';
  }
  const masterWithRR = { id: 'r1', recurrence: ['RRULE:FREQ=WEEKLY'] };
  assert('valid master, no cancelled → series',       seriesStrategy_(masterWithRR, false), 'series');
  assert('valid master, has cancelled → per-instance', seriesStrategy_(masterWithRR, true),  'per-instance');
  assert('master null → per-instance',                 seriesStrategy_(null,         false), 'per-instance');
  assert('master has no recurrence field → per-instance', seriesStrategy_({ id: 'r1' }, false), 'per-instance');
  assert('master has empty recurrence [] → per-instance', seriesStrategy_({ id: 'r1', recurrence: [] }, false), 'per-instance');

  // ── Stale fb_ cache cleanup conditions ───────────────────────
  startSection_('stale fb_ cleanup conditions');
  const fbPrefix2 = 'fb_' + fbHash + 'x';
  function shouldDeleteFbMirror_(cacheKey, processedIds, fbPfx) {
    const isCurrentFb = cacheKey.startsWith(fbPfx)     && !processedIds.has(cacheKey);
    const isLegacyFb  = /^fb_\d+x/.test(cacheKey)      && !processedIds.has(cacheKey);
    return isCurrentFb || isLegacyFb;
  }
  const processed = new Set(['fb_' + fbHash + 'x20260925T100000Z']);

  assertTrue ('current fb, unprocessed → delete',
    shouldDeleteFbMirror_('fb_' + fbHash + 'x20260925T090000Z', processed, fbPrefix2));
  assertFalse('current fb, already processed → keep',
    shouldDeleteFbMirror_('fb_' + fbHash + 'x20260925T100000Z', processed, fbPrefix2));
  assertTrue ('legacy fb (fb_0x...) → delete',
    shouldDeleteFbMirror_('fb_0x20260925T100000Z', processed, fbPrefix2));
  assertTrue ('legacy fb (fb_1x...) → delete',
    shouldDeleteFbMirror_('fb_1x20260925T090000Z', processed, fbPrefix2));
  assertFalse('non-fb key → keep',
    shouldDeleteFbMirror_('src_regularEvent', processed, fbPrefix2));
  assertFalse('non-fb processed key → keep',
    shouldDeleteFbMirror_('src_other', new Set(['src_other']), fbPrefix2));

  // ── onSaveSettings: calendar dedup logic ─────────────────────
  startSection_('settings: calendar dedup');
  // Mirrors the seen-Set logic in onSaveSettings (Handlers.js:30-38).
  function dedupeCalendars_(primary, sourceValues) {
    const seen = new Set([primary].filter(Boolean));
    const sources = [];
    for (const v of sourceValues) {
      const trimmed = (v || '').trim().toLowerCase();
      if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); sources.push(trimmed); }
    }
    return primary ? [primary, ...sources] : sources;
  }
  assert('unique primary + source → both kept',
    dedupeCalendars_('a@x.com', ['b@y.com']), ['a@x.com', 'b@y.com']);
  assert('source same as primary → deduped (only primary)',
    dedupeCalendars_('a@x.com', ['a@x.com']), ['a@x.com']);
  assert('duplicate sources → one kept',
    dedupeCalendars_('a@x.com', ['b@y.com', 'b@y.com']), ['a@x.com', 'b@y.com']);
  assert('case-insensitive dedup',
    dedupeCalendars_('a@x.com', ['B@Y.COM', 'b@y.com']), ['a@x.com', 'b@y.com']);
  assert('empty source string skipped',
    dedupeCalendars_('a@x.com', ['']), ['a@x.com']);
  assert('no primary',
    dedupeCalendars_('', ['b@y.com']), ['b@y.com']);

  // onSaveSettings range validation mirrors (pure conditions)
  function validDays_(n) { return !isNaN(n) && n >= 1 && n <= 365; }
  assertTrue ('1 day → valid',    validDays_(1));
  assertTrue ('7 days → valid',   validDays_(7));
  assertTrue ('365 days → valid', validDays_(365));
  assertFalse('0 → invalid',      validDays_(0));
  assertFalse('366 → invalid',    validDays_(366));
  assertFalse('NaN → invalid',    validDays_(NaN));
  assertFalse('-1 → invalid',     validDays_(-1));

  // Close last section then print feature summary
  if (_secLabel) {
    _sections.push({ name: _secLabel, passed: passed - _secBase.passed, failed: failed - _secBase.failed });
  }

  Logger.log('');
  Logger.log('=== Feature summary ===');
  _sections.forEach(function(r) {
    const total  = r.passed + r.failed;
    const status = r.failed === 0 ? '✓' : '✗ FAIL';
    Logger.log(status + '  ' + r.name + '  (' + r.passed + '/' + total + ')');
  });

  Logger.log('');
  Logger.log('Results: ' + passed + ' passed, ' + failed + ' failed' +
             (failed ? ' ← REVIEW FAILURES ABOVE' : ' — all green'));
}
