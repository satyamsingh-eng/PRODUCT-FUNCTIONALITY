/* SARVAX roadmap card detail layer. Tracker refresh path is click-time, with file:// fallback. */
(function () {
  'use strict';
  var FALLBACK_DATA = window.SARVAX_ROADMAP_FEATURES || [];
  var ALIASES = {
    'Automatic Model Selection':'Task-Aware Model Router',
    'Platform Health Dashboard':'Agent / Workflow / Onechat / Aura observability dashboard',
    'Autonomous Self-Improving Agents':'Self-Learning Agents',
    'Meeting Intelligence Bot (Lightweight SARVAX)':'Toned Down version of SarvaX (Meeting intelligence bot with Gemini)',
    'Continuous Learning Loop':'Observer & Reflector Learning Loop',
    'Bring Your Own AI Keys (BYOK)':'Bring Your Own Keys (BYOK)',
    'Bring Your Own AI Models (BYOM)':'Bring Your Own Models (BYOM)'
  };
  var fallbackByName = {};
  FALLBACK_DATA.forEach(function (item) { fallbackByName[item.name] = item; });
  var active = null;
  var previousFocus = null;
  var modalSequence = 0;

  function normalize(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; });
  }
  function clean(value) { return String(value || '').trim(); }
  function hasContent(value) {
    return Array.isArray(value) ? value.some(function (entry) { return String(entry || '').trim(); }) : Boolean(String(value || '').trim());
  }
  function statusLabel(status) {
    return ({Live:'LIVE IN PROD','In Progress':'IN PROGRESS',Planned:'PLANNED',Research:'RESEARCH','Future Scope':'FUTURE SCOPE','Under Discussion':'UNDER DISCUSSION'})[status] || (status ? String(status).toUpperCase() : 'STATUS NOT MAPPED');
  }
  function statusClass(status) { return status === 'Live' ? 'live' : status === 'In Progress' ? 'dev' : 'planned'; }
  function list(items, fallback) {
    var values = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
    if (!values.length && fallback) values = [fallback];
    return values.map(function (text) { return '<div class="card-bullet-row"><span class="bullet-dot"></span><div class="bullet-text">' + escapeHtml(text) + '</div></div>'; }).join('');
  }
  function normalizeStatus(value) {
    var status = normalize(value);
    if (status === 'delivered' || status === 'live' || status === 'live in prod' || status === 'production') return 'Live';
    if (status === 'in progress' || status === 'shipping' || status === 'shipping now') return 'In Progress';
    if (status === 'under discussion' || status === 'in discussion') return 'Under Discussion';
    if (status === 'committed' || status === 'planned') return 'Planned';
    if (status === 'in research' || status === 'research') return 'Research';
    if (status === 'future' || status === 'future scope') return 'Future Scope';
    return clean(value);
  }
  function conflictState(item) {
    var t = item.truth || {};
    var type = clean(t.feature_type);
    var eta = normalize(t.eta);
    if (t.status === 'Live' && type && type !== 'Existing Feature') return 'Tracker fields conflict — status is Live, feature type is ' + type + '.';
    if (t.status === 'Planned' && (type === 'Existing Feature' || eta === 'delivered')) return 'Tracker fields conflict — status is Planned while the record also says ' + (type === 'Existing Feature' ? 'Existing Feature' : 'Delivered') + '.';
    return '';
  }
  function evidenceState(item) {
    var t = item.truth || {};
    var conflict = conflictState(item);
    if (conflict) return conflict;
    if (t.match === 'unmatched') return 'Roadmap-only record — no matching tracker row was found.';
    if (t.status === 'Live') return 'Tracker records this capability as Live; the feature detail below stays bounded to the supplied description.';
    if (t.status === 'In Progress') return 'Tracker records this capability as In Progress; the delivery description is an implementation direction, not a completed deployment claim.';
    if (t.status === 'Under Discussion') return 'Tracker records this capability as Under Discussion; use it as a design direction, not a committed delivery.';
    if (t.status === 'Planned') return 'Tracker records this capability as Planned; the mechanism describes the intended delivery path.';
    if (t.status === 'Research') return 'Tracker records this capability as Research; the mechanism describes what SARVAX is evaluating.';
    if (t.status === 'Future Scope') return 'Tracker records this capability as Future Scope; the mechanism describes the intended product direction.';
    return 'Roadmap record available; current delivery state is not mapped.';
  }
  function buildTrackerMap(payload) {
    var rows = (payload && Array.isArray(payload.records)) ? payload.records : [];
    var map = {};
    rows.forEach(function (row) {
      var name = clean(row['Feature Name'] || row['feature_name']);
      if (!name) return;
      map[normalize(name)] = {
        tracker_name: name,
        status: clean(row.Status || row.status),
        feature_type: clean(row['Feature Type'] || row.feature_type),
        version: clean(row.Version || row.version),
        developer: clean(row.Developer || row.developer),
        eta: clean(row.ETA || row.eta),
        notes: clean(row.Notes || row.notes),
        match: 'exact'
      };
    });
    return map;
  }
  function fallbackTrackerMap() {
    var map = {};
    FALLBACK_DATA.forEach(function (item) {
      if (item.truth && item.truth.tracker_name) map[normalize(item.name)] = item.truth;
    });
    return map;
  }
  async function refreshTracker() {
    // Public Pages has no private tracker snapshot. Use the validated embedded
    // record set there; local file previews may still read the live bridge.
    if (window.location.protocol !== 'file:') {
      return {map: fallbackTrackerMap(), syncedAt: 'Embedded report snapshot', source: 'Validated report data'};
    }
    var trackerUrl = 'http://127.0.0.1:8765/tracker-live.json?ts=' + Date.now();
    try {
      var response = await fetch(trackerUrl, {cache:'no-store'});
      if (!response.ok) throw new Error('tracker snapshot returned ' + response.status);
      var payload = await response.json();
      return {map: buildTrackerMap(payload), syncedAt: payload.synced_at || 'Tracker snapshot', source: 'Live Siddhi tracker bridge'};
    } catch (e) {
      return {map: fallbackTrackerMap(), syncedAt: 'Last verified local snapshot', source: 'Validated embedded report data'};
    }
  }
  function getItem(card, sync) {
    var name = (card.querySelector('.rc-name') || {}).textContent || '';
    name = name.trim();
    var fallback = fallbackByName[name] || {
      id:'roadmap-pending', name:name, track:card.getAttribute('data-track') || '', page_status:card.getAttribute('data-status') || '', page_note:(card.querySelector('.rc-note') || {}).textContent || '', page_owner:'', page_eta:'', page_version:'', summary:(card.querySelector('.rc-note') || {}).textContent || 'The roadmap lists this capability without a verified summary yet.', copy:null, truth:{match:'unmatched',status:'Not matched'}
    };
    var trackerName = ALIASES[name] || name;
    var truth = sync.map[normalize(trackerName)];
    if (!truth && sync.map[normalize(name)]) truth = sync.map[normalize(name)];
    if (!truth) truth = {match:'unmatched',status:'Not matched',tracker_name:''};
    if (ALIASES[name] && truth.tracker_name) truth.match = 'alias';
    return Object.assign({}, fallback, {truth:truth, sync:sync});
  }
  function sourceLine(item) {
    if (item.sync && item.sync.source) return item.sync.source + ' · ' + item.sync.syncedAt;
    return 'Siddhi tracker snapshot';
  }
  function drift(item) {
    var truth = item.truth && item.truth.status;
    if (!truth || truth === 'Not matched') return '';
    var notices = [];
    var page = item.page_status;
    var mapped = normalizeStatus(page);
    if (mapped && mapped !== truth) notices.push('<strong>Roadmap page drift.</strong> Page: ' + escapeHtml(page) + ' · Siddhi tracker: ' + escapeHtml(truth) + '. The tracker is shown as the current status.');
    var briefStatus = item.brief && item.brief.status || '';
    var briefMapped = normalizeStatus(briefStatus);
    if (briefMapped && briefMapped !== truth) notices.push('<strong>Capabilities brief drift.</strong> Brief: ' + escapeHtml(briefStatus) + ' · Siddhi tracker: ' + escapeHtml(truth) + '. Tracker status remains authoritative.');
    return notices.map(function (notice) { return '<div class="rm-drift">' + notice + '</div>'; }).join('');
  }
  function evidence(item) {
    var t = item.truth || {};
    var rows = [];
    rows.push(t.match === 'unmatched' ? 'No tracker row matched this card name; the roadmap summary is the available product description.' : (t.match === 'alias' ? 'Tracker alias match: ' + (t.tracker_name || '') : 'Tracker match: ' + (t.tracker_name || item.name)));
    if (t.status) rows.push('Status: ' + t.status + (t.feature_type ? ' · ' + t.feature_type : ''));
    if (t.version) rows.push('Version: ' + t.version);
    if (t.developer) rows.push('Owner: ' + t.developer);
    if (t.eta) rows.push('ETA: ' + t.eta);
    if (item.copy && item.copy.source) rows.push('Business detail source: ' + item.copy.source);
    rows.push(sourceLine(item));
    return rows.map(function (text) { return '<div class="card-bullet-row"><span class="bullet-dot"></span><div class="bullet-text">' + escapeHtml(text) + '</div></div>'; }).join('');
  }
  function detailCard(label, title, body, dark) {
    return '<div class="stacked-container' + (dark ? ' dark-evidence' : '') + '"><div class="container-badge-row"><span class="container-badge">' + label + '</span></div><h4 class="container-title">' + title + '</h4><div class="container-body">' + body + '</div></div>';
  }
  function render(dialog, item) {
    var copy = item.copy || {};
    var displayTitle = item.brief && item.brief.title ? item.brief.title : item.name;
    var displayCategory = item.brief && item.brief.category ? item.brief.category : (item.track || 'SARVAX');
    var summary = item.brief && item.brief.summary ? item.brief.summary : (item.summary || 'The roadmap lists this capability without a verified summary yet.');
    var what = hasContent(copy.what) ? list([copy.what]) : list([summary]);
    var why = hasContent(copy.why) ? list(copy.why) : list(['Documented intent: ' + summary]);
    var how = hasContent(copy.how) ? list([copy.how]) : list(['Planned use: apply this capability to the workflow described in the roadmap summary.']);
    var statusBody = list([evidenceState(item)]) + (copy.status ? '<div class="rm-source-note"><strong>Capabilities brief record</strong>' + list(copy.status) + '</div>' : '') + evidence(item) + drift(item);
    var index = item.brief && item.brief.number ? item.brief.number : String(item.id || 'roadmap-00').replace('roadmap-','').padStart(2,'0');
    var status = item.truth.status && item.truth.status !== 'Not matched' ? item.truth.status : item.page_status;
    var panel = dialog.querySelector('.rm-modal-panel');
    var titleId = dialog.getAttribute('aria-labelledby') || 'rm-feature-title';
    panel.innerHTML = '<article class="slide-deck-card rm-detail-card">' +
      '<div class="slide-top"><div class="slide-pill-badge"><span>' + escapeHtml(displayCategory) + '</span><span class="pill-dot">·</span><span class="pill-status ' + statusClass(status) + '">' + escapeHtml(statusLabel(status)) + '</span></div><button class="slide-circle-btn rm-close" type="button" aria-label="Close feature detail">×</button></div>' +
      '<div class="slide-hero"><div class="slide-index-display">' + escapeHtml(index) + '</div><h2 id="' + titleId + '" class="slide-heading">' + escapeHtml(displayTitle) + '</h2><p id="' + titleId + '-summary" class="slide-subheading">' + escapeHtml(summary) + '</p></div>' +
      '<div class="slide-tabs-bar" role="tablist" aria-label="Feature detail sections"><button id="' + titleId + '-tab-all" class="slide-tab active" role="tab" aria-selected="true" aria-controls="' + titleId + '-pane-all" type="button" data-pane="all">Full Picture</button><button id="' + titleId + '-tab-wii" class="slide-tab" role="tab" aria-selected="false" aria-controls="' + titleId + '-pane-wii" type="button" data-pane="wii">What It Does</button><button id="' + titleId + '-tab-hiw" class="slide-tab" role="tab" aria-selected="false" aria-controls="' + titleId + '-pane-hiw" type="button" data-pane="hiw">How It Delivers</button><button id="' + titleId + '-tab-wim" class="slide-tab" role="tab" aria-selected="false" aria-controls="' + titleId + '-pane-wim" type="button" data-pane="wim">Business Value</button><button id="' + titleId + '-tab-se" class="slide-tab" role="tab" aria-selected="false" aria-controls="' + titleId + '-pane-se" type="button" data-pane="se">Status &amp; Evidence</button></div>' +
      '<div id="' + titleId + '-pane-all" class="rm-pane active" role="tabpanel" aria-labelledby="' + titleId + '-tab-all" data-pane-content="all"><div class="stacked-containers-grid">' + detailCard('01 · IN PLAIN TERMS','What It Is',what,false) + detailCard('02 · BUSINESS OUTCOME','Why It Matters',why,false) + detailCard('03 · HOW IT DELIVERS','How It Works',how,false) + detailCard('04 · CURRENT STATUS','Where This Lives in the Platform',statusBody,true) + '</div></div>' +
      '<div id="' + titleId + '-pane-wii" class="rm-pane" role="tabpanel" aria-labelledby="' + titleId + '-tab-wii" data-pane-content="wii">' + detailCard('IN PLAIN TERMS','What It Is',what,false) + '</div>' +
      '<div id="' + titleId + '-pane-hiw" class="rm-pane" role="tabpanel" aria-labelledby="' + titleId + '-tab-hiw" data-pane-content="hiw">' + detailCard('HOW IT DELIVERS','How It Works',how,false) + '</div>' +
      '<div id="' + titleId + '-pane-wim" class="rm-pane" role="tabpanel" aria-labelledby="' + titleId + '-tab-wim" data-pane-content="wim">' + detailCard('BUSINESS OUTCOME','What This Means For Your Firm',why,false) + '</div>' +
      '<div id="' + titleId + '-pane-se" class="rm-pane" role="tabpanel" aria-labelledby="' + titleId + '-tab-se" data-pane-content="se">' + detailCard('STATUS &amp; EVIDENCE','What the source supports',statusBody,true) + '</div>' +
      '<div class="slide-footer"><div class="slide-footer-left"><span class="asterisk-mark">✱</span><span>SARVAX CAPABILITY BRIEF</span></div><div class="slide-footer-nav"><span class="sync-label">' + escapeHtml(sourceLine(item)) + '</span><button class="deck-nav-btn rm-close" type="button">Close detail</button></div></div>' +
      '</article>';
    dialog.querySelectorAll('.rm-close').forEach(function (button) { button.addEventListener('click', close); });
    dialog.querySelectorAll('.slide-tab').forEach(function (button) {
      button.addEventListener('click', function () {
        var pane = button.getAttribute('data-pane');
        dialog.querySelectorAll('.slide-tab').forEach(function (b) { b.classList.toggle('active', b === button); b.setAttribute('aria-selected', b === button ? 'true' : 'false'); });
        dialog.querySelectorAll('.rm-pane').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-pane-content') === pane); });
      });
    });
    dialog.querySelector('.rm-close').focus();
  }
  function showLoading(dialog) {
    var titleId = dialog.getAttribute('aria-labelledby');
    dialog.querySelector('.rm-modal-panel').innerHTML = '<article class="slide-deck-card rm-detail-card rm-loading"><div class="slide-top"><div class="slide-pill-badge"><span>SARVAX</span><span class="pill-dot">·</span><span>SYNCING TRACKER</span></div><button class="slide-circle-btn rm-close" type="button" aria-label="Close feature detail">×</button></div><div class="slide-index-display">…</div><h2 id="' + titleId + '" class="slide-heading">Loading verified feature detail</h2><p id="' + titleId + '-summary" class="slide-subheading">Reading Siddhi\'s Platform RoadMap before opening the card.</p></article>';
    dialog.querySelector('.rm-close').addEventListener('click', close);
    dialog.querySelector('.rm-close').focus();
  }
  function open(card) {
    close();
    previousFocus = document.activeElement;
    var dialog = document.createElement('div');
    var modalId = 'rm-dialog-' + (++modalSequence);
    dialog.id = modalId;
    dialog.className = 'rm-modal'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-labelledby', modalId + '-title'); dialog.setAttribute('aria-describedby', modalId + '-title-summary');
    dialog.innerHTML = '<div class="rm-modal-backdrop"></div><div class="rm-modal-panel" role="document"></div>';
    document.body.appendChild(dialog); document.body.classList.add('rm-modal-open'); active = {dialog:dialog, card:card}; card.setAttribute('aria-expanded','true'); card.setAttribute('aria-controls', modalId); showLoading(dialog);
    dialog.querySelector('.rm-modal-backdrop').addEventListener('click', close);
    dialog.addEventListener('keydown', trap);
    refreshTracker().then(function (sync) { if (active && active.dialog === dialog) render(dialog, getItem(card, sync)); });
  }
  function trap(event) {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    var focusables = active.dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first=focusables[0], last=focusables[focusables.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function close() {
    if (!active) return;
    active.card.setAttribute('aria-expanded','false'); active.card.removeAttribute('aria-controls'); active.dialog.remove(); active=null; document.body.classList.remove('rm-modal-open');
    if (previousFocus && previousFocus.focus) previousFocus.focus(); previousFocus=null;
  }
  function enhance() {
    document.querySelectorAll('.rc').forEach(function (card) {
      var name=(card.querySelector('.rc-name') || {}).textContent || '';
      card.classList.add('rm-clickable'); card.setAttribute('role','button'); card.setAttribute('tabindex','0'); card.setAttribute('aria-haspopup','dialog'); card.setAttribute('aria-label','Open details for ' + name.trim()); card.setAttribute('aria-expanded','false');
    });
    document.addEventListener('click', function (event) {
      var card = event.target.closest && event.target.closest('.rc');
      if (!card || event.target.closest('a,button,input,select,textarea')) return;
      card.focus();
      open(card);
    });
    document.addEventListener('keydown', function (event) {
      if (active || !event.target.closest) return;
      var card = event.target.closest('.rc');
      if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      open(card);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance); else enhance();
})();
