// ── Icon helper ───────────────────────────────────────────────────────────────
// Returns a Material Symbols Outlined icon URL (24 px).
function icon_(name) {
  return 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/'
       + name + '/default/24px.svg';
}

function iconImg_(name, alt) {
  return CardService.newIconImage().setIconUrl(icon_(name)).setAltText(alt || '');
}

const APP_LOGO_ = 'https://apps.agaur.dev/apps/calendar-sync/images/calendar_sync_icon_128x128.png';

// ── Info card ─────────────────────────────────────────────────────────────────
function buildInfoCard_() {
  const rows = [
    { icon: 'sync',          text: 'One-way free/busy sync. Events appear as "Busy" blocks.' },
    { icon: 'lock',          text: 'Only the time slot is shared. No titles, descriptions, or attendees.' },
    { icon: 'calendar_today',text: 'Up to ' + (MAX_CALENDARS - 1) + ' source calendars' },
    { icon: 'schedule',      text: 'Hourly automatic sync via a time-based trigger' },
  ];

  const section = CardService.newCardSection();
  rows.forEach(r => {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(iconImg_(r.icon))
        .setText(r.text)
        .setWrapText(true)
    );
  });

  section.addWidget(
    CardService.newTextButton()
      .setText('← Back')
      .setOnClickAction(CardService.newAction().setFunctionName('onBackFromInfo'))
  );

  return CardService.newCardBuilder()
    .setName('info')
    .setHeader(
      CardService.newCardHeader()
        .setTitle('About Calendar Sync')
        .setImageUrl(APP_LOGO_)
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    )
    .addSection(section)
    .build();
}

// ── Main / error helpers ──────────────────────────────────────────────────────
function buildMainCard_() {
  const s = getSettings_();
  return s.calendars.length >= 2 ? buildStatusCard_(s) : buildSetupCard_();
}

function errorCard_(e) {
  return CardService.newCardBuilder()
    .setName('error')
    .setHeader(CardService.newCardHeader().setTitle('Calendar Sync: Error'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(String(e)))
    )
    .build();
}

// ── Setup card ────────────────────────────────────────────────────────────────
function buildSetupCard_(prefill) {
  let userEmail = '';
  try { userEmail = Session.getActiveUser().getEmail(); } catch (_) {}

  const calendars  = prefill ? [...prefill.calendars] : ['', ''];
  const pastDays   = prefill ? prefill.pastDays   : DEFAULT_PAST_DAYS;
  const futureDays = prefill ? prefill.futureDays : DEFAULT_FUTURE_DAYS;
  if (userEmail) calendars[0] = calendars[0] || userEmail;

  // ── Calendar inputs ──────────────────────────────────────────────────────
  const calSection = CardService.newCardSection().setHeader('Calendars');

  calSection.addWidget(
    CardService.newDecoratedText()
      .setText('Busy blocks from each source calendar will appear on Calendar 1.')
      .setWrapText(true)
      .setButton(
        CardService.newImageButton()
          .setIconUrl(icon_('chevron_right'))
          .setAltText('Learn more')
          .setOnClickAction(CardService.newAction().setFunctionName('onShowCalendarInfo'))
      )
      .setOnClickAction(CardService.newAction().setFunctionName('onShowCalendarInfo'))
  );

  calendars.forEach((val, i) => {
    if (i > 0) {
      calSection.addWidget(
        CardService.newDecoratedText()
          .setStartIcon(iconImg_('calendar_today'))
          .setText('Calendar ' + (i + 1))
          .setButton(
            CardService.newImageButton()
              .setIconUrl(icon_('close'))
              .setAltText('Remove calendar ' + (i + 1))
              .setOnClickAction(
                CardService.newAction()
                  .setFunctionName('onRemoveCalendar')
                  .setParameters({ index: String(i) })
              )
          )
      );
      calSection.addWidget(
        CardService.newTextInput()
          .setFieldName('cal' + i)
          .setTitle('Email')
          .setValue(val)
          .setHint('')
      );
    } else {
      calSection.addWidget(
        CardService.newDecoratedText()
          .setTopLabel('Calendar 1 — primary')
          .setText(val || userEmail)
          .setStartIcon(iconImg_('account_circle'))
      );
    }
  });

  if (calendars.length < MAX_CALENDARS) {
    calSection.addWidget(
      CardService.newTextButton()
        .setText('+ Add another calendar')
        .setOnClickAction(CardService.newAction().setFunctionName('onAddCalendar'))
    );
  }

  // ── Sync window ──────────────────────────────────────────────────────────
  const windowSection = CardService.newCardSection().setHeader('Sync window');

  windowSection
    .addWidget(
      CardService.newTextInput()
        .setFieldName('pastDays')
        .setTitle('Days in the past')
        .setValue(String(pastDays))
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName('futureDays')
        .setTitle('Days in the future')
        .setValue(String(futureDays))
    );

  // ── Actions ──────────────────────────────────────────────────────────────
  const actionsSection = CardService.newCardSection();

  actionsSection.addWidget(
    CardService.newTextButton()
      .setText('Save & Start Sync')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(CardService.newAction().setFunctionName('onSaveSettings'))
  );

  if (prefill) {
    actionsSection
      .addWidget(
        CardService.newTextButton()
          .setText('Stop Sync & Remove All')
          .setOnClickAction(CardService.newAction().setFunctionName('onStopAndClear'))
      )
      .addWidget(
        CardService.newTextButton()
          .setText('Cancel')
          .setOnClickAction(CardService.newAction().setFunctionName('onCancelReconfigure'))
      );
  }

  return CardService.newCardBuilder()
    .setName('setup')
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Calendar Sync')
        .setSubtitle('Configure your calendars')
        .setImageUrl(APP_LOGO_)
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    )
    .addSection(calSection)
    .addSection(windowSection)
    .addSection(actionsSection)
    .build();
}

function formatNextRun_(ts) {
  return new Date(parseInt(ts, 10)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Status card ───────────────────────────────────────────────────────────────
function buildStatusCard_(s) {
  const pending  = !!userProps_().getProperty(PROP_PENDING_OP);
  const running  = !!(s.triggerId && isTriggerAlive_(s.triggerId));
  const allPaused = !running;

  // ── Last background job result banner ────────────────────────────────────
  let lastResult = null;
  try { lastResult = JSON.parse(userProps_().getProperty(PROP_LAST_OP_RESULT) || 'null'); } catch (_) {}
  // Always clear the stored result; only show it if it's fresh (< 2 min old).
  if (lastResult) userProps_().deleteProperty(PROP_LAST_OP_RESULT);
  const showBanner = lastResult && (Date.now() - lastResult.ts) < 2 * 60 * 1000;
  let bannerSection = null;
  if (showBanner) {
    const opLabel = { initialSync: 'Initial sync', startSync: 'Sync', fullResync: 'Full resync',
                      cleanup: 'Cleanup', stopAndClear: 'Stop & clear' }[lastResult.op] || lastResult.op;
    bannerSection = CardService.newCardSection();
    bannerSection.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(iconImg_(lastResult.ok ? 'check_circle' : 'error'))
        .setText(lastResult.ok
          ? opLabel + ' completed successfully.'
          : opLabel + ' failed: ' + (lastResult.msg || 'unknown error'))
        .setWrapText(true)
    );
  }

  // ── Calendars section ────────────────────────────────────────────────────
  const calSection = CardService.newCardSection().setHeader('Calendars');

  s.calendars.forEach((cal, i) => {
    const isPrimary = i === 0;
    const paused    = !isPrimary && isPausedCal_(cal);

    const dt = CardService.newDecoratedText()
      .setTopLabel('Calendar ' + (i + 1) + (isPrimary ? ' (primary)' : ''))
      .setText(cal)
      .setStartIcon(iconImg_('calendar_today'));

    if (!isPrimary) {
      dt.setButton(
        CardService.newImageButton()
          .setIconUrl(paused ? icon_('play_arrow') : icon_('pause'))
          .setAltText(paused ? 'Resume' : 'Pause')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('onPauseCalendar')
              .setParameters({ calId: cal, paused: String(!paused) })
          )
      );
    }
    calSection.addWidget(dt);
  });


  // ── Sync status section ──────────────────────────────────────────────────
  const statusSection = CardService.newCardSection().setHeader('Sync status');

  let statusText, statusIconName;
  if (running) {
    statusText     = 'Running  ·  Next at ' + (s.nextRun ? formatNextRun_(s.nextRun) : '—');
    statusIconName = 'sync';
  } else if (pending) {
    statusText     = 'Syncing now…';
    statusIconName = 'hourglass_top';
  } else {
    statusText     = 'Paused';
    statusIconName = 'pause_circle';
  }

  // Status row — Run Now icon button sits in the same row for a compact layout
  statusSection.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Status')
      .setText(statusText)
      .setStartIcon(iconImg_(statusIconName))
      .setButton(
        CardService.newImageButton()
          .setIconUrl(icon_('sync'))
          .setAltText('Run Now')
          .setOnClickAction(CardService.newAction().setFunctionName('onRunNow'))
      )
  );

  statusSection
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Last synced')
        .setText(s.lastSync ? formatLastSync_(s.lastSync) : 'Never')
        .setStartIcon(iconImg_('history'))
    )
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Sync window')
        .setText('−' + s.pastDays + ' days  /  +' + s.futureDays + ' days')
        .setStartIcon(iconImg_('date_range'))
    );

  // ── Settings (collapsible) ───────────────────────────────────────────────
  const settingsSection = CardService.newCardSection()
    .setHeader('Settings')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  settingsSection
    .addWidget(
      CardService.newDecoratedText()
        .setText('Reconfigure calendars')
        .setStartIcon(iconImg_('settings'))
        .setOnClickAction(CardService.newAction().setFunctionName('onReconfigure'))
    )
    .addWidget(
      CardService.newDecoratedText()
        .setText('Delete all mirrored blocks')
        .setStartIcon(iconImg_('delete_sweep'))
        .setOnClickAction(CardService.newAction().setFunctionName('onCleanupMirrors'))
    );

  const builder = CardService.newCardBuilder()
    .setName('status')
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Calendar Sync')
        .setSubtitle(s.calendars.length + ' calendar' + (s.calendars.length !== 1 ? 's' : '') + ' configured')
        .setImageUrl(APP_LOGO_)
        .setImageStyle(CardService.ImageStyle.CIRCLE)
    );
  if (bannerSection) builder.addSection(bannerSection);
  return builder
    .addSection(calSection)
    .addSection(statusSection)
    .addSection(settingsSection)
    .build();
}
