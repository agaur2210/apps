function buildInfoCard_() {
  const section = CardService.newCardSection();

  [
    'One-way free/busy sync',
    'Your events appear as "Busy" blocks on the other calendar',
    'Only the time slot is copied — never titles, descriptions, or attendees',
    'Only read access to other calendars is needed',
  ].forEach(line => {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.MEMBERSHIP))
        .setText(line)
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
    .setHeader(CardService.newCardHeader().setTitle('About Calendar Sync'))
    .addSection(section)
    .build();
}

function buildMainCard_() {
  const s = getSettings_();
  return s.calendars.length >= 2 ? buildStatusCard_(s) : buildSetupCard_();
}

function errorCard_(e) {
  return CardService.newCardBuilder()
    .setName('error')
    .setHeader(CardService.newCardHeader().setTitle('Calendar Bridge — Error'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(String(e)))
    )
    .build();
}

function buildSetupCard_(prefill) {
  let userEmail = '';
  try { userEmail = Session.getActiveUser().getEmail(); } catch (_) {}

  const calendars  = prefill ? [...prefill.calendars] : ['', ''];
  const pastDays   = prefill ? prefill.pastDays   : DEFAULT_PAST_DAYS;
  const futureDays = prefill ? prefill.futureDays : DEFAULT_FUTURE_DAYS;
  if (userEmail) calendars[0] = calendars[0] || userEmail;

  const calSection = CardService.newCardSection()
    .setHeader('Your calendars')

  calendars.forEach((val, i) => {
    calSection.addWidget(
      CardService.newTextInput()
        .setFieldName('cal' + i)
        .setTitle('Calendar ' + (i + 1) + (i < 2 ? ' (required)' : ''))
        .setValue(val)
        .setHint('email@domain.com')
    );
    const rowButtons = CardService.newButtonSet();

    if (i === 0) {
      calSection.addWidget(
        CardService.newDecoratedText()
          .setStartIcon(
            CardService.newIconImage()
              .setIconUrl('https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/info/default/24px.svg')
          )
          .setText('About sync')
          .setBottomLabel('Tap for details')
          .setOnClickAction(CardService.newAction().setFunctionName('onShowCalendarInfo'))
      );
    }

    if (i > 0) {
      rowButtons.addButton(
        CardService.newTextButton()
          .setText('Remove')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('onRemoveCalendar')
              .setParameters({ index: String(i) })
          )
      );
    }

    calSection.addWidget(rowButtons);
  });

  calSection.addWidget(
    CardService.newTextButton()
      .setText('+ Add another calendar')
      .setOnClickAction(CardService.newAction().setFunctionName('onAddCalendar'))
  );

  const windowSection = CardService.newCardSection()
    .setHeader('Sync window')
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

  const actionsSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText('Save & Start Sync')
        .setOnClickAction(CardService.newAction().setFunctionName('onSaveSettings'))
    );

  if (prefill) {
    actionsSection
      .addWidget(
        CardService.newTextButton()
          .setText('Stop Sync & Remove All Calendars')
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
        .setTitle('Calendar Bridge')
        .setSubtitle('Multi-calendar sync')
    )
    .addSection(calSection)
    .addSection(windowSection)
    .addSection(actionsSection)
    .build();
}

function buildStatusCard_(s) {
  const running = !!(s.triggerId && isTriggerAlive_(s.triggerId));

  const calSection = CardService.newCardSection().setHeader('Calendars');
  s.calendars.forEach((cal, i) => {
    calSection.addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Calendar ' + (i + 1))
        .setText(cal)
    );
  });
  calSection.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Status')
      .setText(running ? '🟢 Syncing every hour' : '⏸ Stopped')
  );
  calSection.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Last synced')
      .setText(s.lastSync ? formatLastSync_(s.lastSync) : 'Never')
  );
  calSection.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Sync window')
      .setText('−' + s.pastDays + ' days  /  +' + s.futureDays + ' days')
  );

  const actions = CardService.newCardSection().setHeader('Actions');

  if (!running) {
    actions.addWidget(
      CardService.newTextButton()
        .setText('Start Sync')
        .setOnClickAction(CardService.newAction().setFunctionName('onStartSync'))
    );
  } else {
    actions.addWidget(
      CardService.newTextButton()
        .setText('Pause Sync')
        .setOnClickAction(CardService.newAction().setFunctionName('onStopSync'))
    );
  }

  actions
    .addWidget(
      CardService.newTextButton()
        .setText('↻  Refresh Status')
        .setOnClickAction(CardService.newAction().setFunctionName('onRefreshStatus'))
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Full Resync Now')
        .setOnClickAction(CardService.newAction().setFunctionName('onFullResync'))
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Delete all sync blocks')
        .setOnClickAction(CardService.newAction().setFunctionName('onCleanupMirrors'))
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Reconfigure')
        .setOnClickAction(CardService.newAction().setFunctionName('onReconfigure'))
    );

  return CardService.newCardBuilder()
    .setName('status')
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Calendar Bridge')
        .setSubtitle(running ? 'Active' : 'Paused')
    )
    .addSection(calSection)
    .addSection(actions)
    .build();
}
