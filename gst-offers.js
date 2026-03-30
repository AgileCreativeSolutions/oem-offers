/**
 * gst-specials.js
 * Gettel Stadium Toyota — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Usage — same tag on both pages:
 *   <div id="gst-specials"></div>
 *   <script src="https://AgileCreativeSolutions.github.io/oem-offers/gst-specials.js"></script>
 *
 * Sheet structure (GMCD-style): fields = rows, offers = columns.
 * Four tabs: "Triple Zero" | "Gettel's Got It" | "Real $0 Down Leases" | "Used Specials"
 *
 * Visibility row: blank = show, type "hide" to suppress.
 * Card Type row (Used Specials): hero | apr-card | program-card
 *
 * Spanish page (/ofertas-especiales): auto-detects URL, auto-translates all
 * visible text via Google Translate, caches in localStorage for 24 hrs.
 * Used Specials section is skipped on the Spanish page.
 */

(function () {
  'use strict';

  const ROOT_ID   = 'gst-specials';
  const PUBLISHED_ID = '2PACX-1vRDlL88BHsoKBay_M_zNZgJDoMIiWAj5Fc_86ykbl6Q7xETAD2it2wgXkdJ2l4yfxtTihJFigdOPdkm';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const IS_ES = /ofertas-especiales|spanish-specials-test-page/i.test(window.location.pathname);

  const TABS = {
    tz_banner: '726598542',
    tz:        '1484245835',
    gg:        '469709076',
    lease:     '1929259886',
    programs:  '2013659529',
    used:      '1815578815',
  };

  // ── CSV fetch ──────────────────────────────────────────────────────
  async function fetchTab(gid) {
    const url = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv&gid=${gid}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot load tab gid: ${gid}`);
    return res.text();
  }

  // ── CSV parser ─────────────────────────────────────────────────────
  function parseCsv(text) {
    const rows = [];
    let field = '', row = [], inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], nx = text[i + 1];
      if (inQ) {
        if (ch === '"' && nx === '"') { field += '"'; i++; }
        else if (ch === '"') inQ = false;
        else field += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(field.trim()); field = ''; }
        else if (ch === '\n' || (ch === '\r' && nx === '\n')) {
          row.push(field.trim()); rows.push(row); row = []; field = '';
          if (ch === '\r') i++;
        } else field += ch;
      }
    }
    if (field || row.length) { row.push(field.trim()); rows.push(row); }
    return rows;
  }

  /**
   * GMCD-style: fields are rows, offers are columns.
   * Row 0 = banner (skip), Row 1 = column headers, Col 0 = field name.
   * Returns array of objects, one per offer column.
   */
  function csvToOffers(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return [];

    // Auto-detect header row — find the first row where col 0 is "Field"
    // This is robust against Google Sheets exporting the merged banner row
    // differently (or not at all)
    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][0] || '').trim().toLowerCase() === 'field') {
        headerRowIdx = i;
        break;
      }
    }
    // Fallback: if no "Field" row found, treat row 1 as header
    if (headerRowIdx === -1) headerRowIdx = 1;

    const numOffers = rows[headerRowIdx].length - 1;
    if (numOffers < 1) return [];

    const offers = Array.from({ length: numOffers }, () => ({}));
    for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
      const fieldName = (rows[ri][0] || '').trim();
      if (!fieldName) continue;
      for (let oi = 0; oi < numOffers; oi++) {
        offers[oi][fieldName] = (rows[ri][oi + 1] || '').trim();
      }
    }
    return offers;
  }

  function isVisible(o) {
    return (o['Visibility'] || '').trim().toLowerCase() !== 'hide';
  }

  // ── Translation ────────────────────────────────────────────────────
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h.toString(36);
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
      return data;
    } catch { return null; }
  }

  function cacheSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  async function translateBatch(strings) {
    if (!strings.length) return strings;
    const cacheKey = 'gst_xlat_' + hashStr(strings.join('|||'));
    const cached   = cacheGet(cacheKey);
    if (cached) return cached;
    const DELIM = ' ||| ';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(strings.join(DELIM))}`;
    try {
      const data   = await (await fetch(url)).json();
      const joined = (data[0] || []).map(c => c[0] || '').join('');
      let result   = joined.split(/\s*\|\|\|\s*/).map(s => s.trim());
      while (result.length < strings.length) result.push(strings[result.length]);
      result = result.slice(0, strings.length);
      cacheSet(cacheKey, result);
      return result;
    } catch {
      return strings;
    }
  }

  // ── UI strings ─────────────────────────────────────────────────────
  const UI_EN = {
    shopNow:             'Shop Now',
    claimOffer:          'Claim Offer',
    or:                  'or',
    aprLabel:            'APR / 60 mo.',
    downPmts:            'Down + 0 Pmts',
    leaseLabel:          'Lease',
    leaseZeroLabel:      '$0 Down Lease',
    zeroDown:            'Zero down payment',
    dueAtSigning:        'due at signing',
    maintBadge:          '✓ Includes Complimentary Maintenance',
    disclaimerToggle:    'Disclaimer',
    offerBarAPRLbl:      'APR Financing',
    offerBarAPRSub:      'for 60 months',
    offerBarDownLbl:     'Down Payment',
    offerBarDownSub:     'well-qualified buyers',
    offerBarPmtsLbl:     'Payments',
    offerBarPmtsSub:     'first 3 months',
    offerBarHelpLbl:     'We Can Help',
    offerBarHelpSub:     'Bad or no credit',
    tzSectionEyebrow:    'Gettel Stadium Toyota',
    tzSectionTitle:      'The Real Triple Zero Sale',
    tzSectionSub:        'Your choice of three ways to save on select in-stock new 2025 & 2026 Toyotas. Only one offer per purchase — pick what works for you.',
    ggSectionEyebrow:    'Gettel Stadium Toyota',
    ggSectionTitle:      "Gettel's Got It!",
    ggSectionSub:        "Skip the search and start saving with exclusive deals you won't find anywhere else — only at Gettel Stadium Toyota.",
    leaseSectionEyebrow: 'Gettel Stadium Toyota',
    leaseSectionTitle:   'Real $0 Down Leases',
    leaseSectionSub:     'No money down. No hidden fees. No kidding.',
    incBarTitle:         'Every Lease Includes:',
    incBarSub:           'All items at no added cost.',
    navLabel:               'Specials',
    navTripleZero:          'Triple Zero Sale',
    navGettelsGotIt:        "Gettel's Got It!",
    navZeroDownLeases:      '$0 Down Leases',
    navSpecialPrograms:     'Special Programs',
    programsSectionEyebrow: 'Additional Benefits',
    programsSectionTitle:   'Special Programs',
    programsSectionSub:     'Even more ways to save with great benefits at Gettel Stadium Toyota.',
  };

  // incTags translated separately to avoid delimiter mangling in the main UI batch
  const INC_TAGS_EN = [
    '✓ Complimentary Maintenance — Full Lease',
    '✓ 12,000 Miles / Year',
    '✓ $0 Security Deposit',
    '✓ Dealer Documentation Fee',
    '✓ Filing Fee',
    '✓ Lease Acquisition Fee',
    '✓ Full Tank of Gas',
  ];
  let incTagsTranslated = INC_TAGS_EN;

  let UI = { ...UI_EN };

  function translateSidebar() {
    if (!IS_ES) return;
    const label = document.querySelector('.sidebar-nav-label');
    if (label) label.textContent = t('navLabel');
    const map = {
      'triple-zero':      'navTripleZero',
      'gettels-got-it':   'navGettelsGotIt',
      'zero-down-leases': 'navZeroDownLeases',
      'programs':         'navSpecialPrograms',
    };
    document.querySelectorAll('.sidebar-nav a').forEach(l => {
      const id  = l.getAttribute('href').replace('#', '');
      const key = map[id];
      if (!key) return;
      // Preserve the .nav-num span, only replace the trailing text node
      const num  = l.querySelector('.nav-num');
      const text = l.querySelector('.nav-text');
      if (text) {
        text.textContent = t(key);
      } else {
        // Find and replace just the trailing text node
        l.childNodes.forEach(n => {
          if (n.nodeType === 3 && n.textContent.trim()) n.textContent = t(key);
        });
      }
    });
  }

  async function translateUI() {
    if (!IS_ES) return;
    // Translate incTags as a clean separate batch
    incTagsTranslated = await translateBatch([...INC_TAGS_EN]);
    const keys   = Object.keys(UI_EN);
    const flat   = keys.map(k => Array.isArray(UI_EN[k]) ? UI_EN[k].join(' ||| ') : UI_EN[k]);
    const xlated = await translateBatch(flat);
    const result = {};
    keys.forEach((k, i) => {
      result[k] = Array.isArray(UI_EN[k])
        ? xlated[i].split(/\s*\|\|\|\s*/).map(s => s.trim())
        : xlated[i];
    });
    UI = result;
  }

  function t(key) { return UI[key] !== undefined ? UI[key] : UI_EN[key]; }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Section builders ───────────────────────────────────────────────

  async function buildTripleZero(offers, bannerOffers, el) {
    let sectionDisclaimer = (offers.find(o => o['Section Disclaimer']) || {})['Section Disclaimer'] || '';
    const active = offers.filter(isVisible);
    if (!active.length) { el.style.display = 'none'; return; }
    if (IS_ES && sectionDisclaimer) [sectionDisclaimer] = await translateBatch([sectionDisclaimer]);
    let models = active.map(v => v['Model']);

    // ── Offer bar (banner tab) ────────────────────────────────────────
    let barItems = bannerOffers.filter(isVisible);
    if (IS_ES && barItems.length) {
      const labels = barItems.map(o => o['Label']);
      const subs   = barItems.map(o => o['Subtext']);
      const [xlLabels, xlSubs] = await Promise.all([translateBatch(labels), translateBatch(subs)]);
      barItems = barItems.map((o, i) => ({ ...o, Label: xlLabels[i], Subtext: xlSubs[i] }));
    }
    const offerBarHtml = barItems.length
      ? barItems.map(item => {
          const sep = (item['Separator Before'] || '').trim();
          return `${sep ? `<div class="offer-or">${esc(sep)}</div>` : ''}
            <div class="offer-pill">
              <div class="big-num">${esc(item['Big Value'])}</div>
              <div class="pill-label">${esc(item['Label'])}</div>
              <div class="pill-sub">${esc(item['Subtext'])}</div>
            </div>`;
        }).join('')
      : `<div class="offer-pill">
           <div class="big-num">0%</div>
           <div class="pill-label">${esc(t('offerBarAPRLbl'))}</div>
           <div class="pill-sub">${esc(t('offerBarAPRSub'))}</div>
         </div>
         <div class="offer-or">${esc(t('or'))}</div>
         <div class="offer-pill">
           <div class="big-num">$0</div>
           <div class="pill-label">${esc(t('offerBarDownLbl'))}</div>
           <div class="pill-sub">${esc(t('offerBarDownSub'))}</div>
         </div>
         <div class="offer-or">+</div>
         <div class="offer-pill">
           <div class="big-num">0</div>
           <div class="pill-label">${esc(t('offerBarPmtsLbl'))}</div>
           <div class="pill-sub">${esc(t('offerBarPmtsSub'))}</div>
         </div>
         <div class="offer-or">+</div>
         <div class="offer-pill">
           <div class="big-num">✓</div>
           <div class="pill-label">${esc(t('offerBarHelpLbl'))}</div>
           <div class="pill-sub">${esc(t('offerBarHelpSub'))}</div>
         </div>`;

    let aprTerms   = active.map(v => v['APR Term']      || 'APR / 60 mo.');
    let badge2Lbls = active.map(v => v['Badge 2 Label'] || '$0 DOWN');
    let badge2Subs = active.map(v => v['Badge 2 Sub']   || 'Payment');
    let pmtsBars   = active.map(v => v['Payments Bar']  || '+0 PAYMENTS FOR 3 MOS');
    if (IS_ES) {
      [aprTerms, badge2Lbls, badge2Subs, pmtsBars] = await Promise.all([
        translateBatch(aprTerms),
        translateBatch(badge2Lbls),
        translateBatch(badge2Subs),
        translateBatch(pmtsBars),
      ]);
    }

    const cards = active.map((v, i) => {
      const flip     = (v['Flip Image'] || '').toLowerCase() === 'yes';
      const aprRate  = v['APR Rate']        || '0%';
      const aprTerm  = aprTerms[i];
      const badge2Lbl = badge2Lbls[i];
      const badge2Sub = badge2Subs[i];
      const pmtsBar   = pmtsBars[i];
      const claimUrl  = v['Claim Offer URL'] || '/new-car-specials-lead-form.htm';
      return `
        <div class="v-card">
          <div class="v-card-img">
            <img src="${esc(v['Image URL'])}" alt=""${flip ? ' style="transform:scaleX(-1)"' : ''}>
          </div>
          <div class="v-card-body">
            <div class="v-card-year">${esc(v['Year'])}</div>
            <div class="v-card-model">${esc(models[i])}</div>
            <div class="tz-offer-group">
              <div class="tz-badges">
                <div class="tz-badge"><div class="tz-val">${esc(aprRate)}</div><div class="tz-term">${esc(aprTerm)}</div></div>
                <div class="tz-or">${esc(t('or'))}</div>
                <div class="tz-badge"><div class="tz-val">${esc(badge2Lbl)}</div><div class="tz-term">${esc(badge2Sub)}</div></div>
              </div>
              <div class="tz-pmts-bar">${esc(pmtsBar)}</div>
            </div>
            <div class="v-card-cta">
              <a href="${esc(v['Shop URL'])}" class="btn btn-primary">${esc(t('shopNow'))}</a>
              <a href="${esc(claimUrl)}" class="btn btn-outline">${esc(t('claimOffer'))}</a>
            </div>
          </div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div id="triple-zero" class="section section-alt acs-oem-brand">
        <span class="scroll-target"></span>
        <div class="section-inner">
        <div class="section-header">
          <p class="section-eyebrow">${esc(t('tzSectionEyebrow'))}</p>
          <h2 class="section-title acs-bold">${esc(t('tzSectionTitle'))}</h2>
          <p class="section-sub">${esc(t('tzSectionSub'))}</p>
        </div>
        <div class="offer-bar">
          ${offerBarHtml}
        </div>
        <div class="card-grid">${cards}</div>
        ${sectionDisclaimer ? `
        <details class="disclaimer" style="margin-top:16px;">
          <summary>Triple Zero Sale — Disclaimer</summary>
          <p>${esc(sectionDisclaimer)}</p>
        </details>` : ''}
      </div>`;
  }

  async function buildGettelsGotIt(offers, el) {
    const active = offers.filter(isVisible);
    if (!active.length) { el.style.display = 'none'; return; }
    let titles = active.map(v => v['Title']);
    let descs  = active.map(v => v['Description']);
    let ctas   = active.map(v => v['CTA Label']);
    let discls = active.map(v => v['Disclaimer']);
    if (IS_ES) {
      [titles, descs, ctas, discls] = await Promise.all([
        translateBatch(titles), translateBatch(descs),
        translateBatch(ctas),   translateBatch(discls),
      ]);
    }
    const cards = active.map((v, i) => `
      <div class="promo-card">
        <a href="${esc(v['CTA URL'])}">
          <img src="${esc(v['Image URL'])}" alt="${esc(v['Image Alt'])}">
        </a>
        <div class="promo-card-body">
          <div class="promo-title">${esc(titles[i])}</div>
          <p class="promo-desc">${esc(descs[i])}</p>
          <a href="${esc(v['CTA URL'])}" class="btn btn-primary">${esc(ctas[i])}</a>
          ${discls[i] ? `<details class="disclaimer" style="margin-top:10px;">
            <summary>${esc(t('disclaimerToggle'))}</summary>
            <p>${esc(discls[i])}</p>
          </details>` : ''}
        </div>
      </div>`).join('');
    el.innerHTML = `
      <div id="gettels-got-it" class="section section-gray acs-oem-brand">
        <span class="scroll-target"></span>
        <div class="section-inner">
        <div class="section-header">
          <p class="section-eyebrow">${esc(t('ggSectionEyebrow'))}</p>
          <h2 class="section-title acs-bold">${esc(t('ggSectionTitle'))}</h2>
          <p class="section-sub">${esc(t('ggSectionSub'))}</p>
        </div>
        <div class="promo-grid">${cards}</div>
        </div>
      </div>`;
  }

  async function buildLeases(offers, el) {
    const active = offers.filter(isVisible);
    if (!active.length) { el.style.display = 'none'; return; }

    let discls = active.map(o => o['Section Disclaimer'] || '');
    if (IS_ES) discls = await translateBatch(discls);

    // Section-level disclaimer block — *Year Model: as bold header per vehicle
    const disclaimerEntries = active
      .map((v, i) => discls[i] ? `<p><strong>*${esc(v['Year'])} ${esc(v['Model'])}:</strong><br>${esc(discls[i])}</p>` : '')
      .filter(Boolean);
    const leaseSectionDisclHtml = disclaimerEntries.length
      ? `<details class="disclaimer" style="margin-top:16px;"><summary>$0 Down Lease Offers \u2014 Disclaimer</summary>${disclaimerEntries.join('')}</details>`
      : '';

    let models = active.map(v => v['Model']);

    const incTags = incTagsTranslated.map(tag => '<span class="inc-tag">' + esc(tag) + '</span>').join('');
    const cards = active.map((v, i) => {
      const maint = (v['Maint. Badge'] || '').toLowerCase() === 'yes';
      const flip  = (v['Flip Image'] || '').toLowerCase() === 'yes';
      return `
        <div class="v-card">
          <div class="v-card-img"><img src="${esc(v['Image URL'])}" alt=""${flip ? ' style="transform:scaleX(-1)"' : ''}></div>
          <div class="v-card-body">
            <div class="v-card-year">${esc(v['Year'])}</div>
            <div class="v-card-model">${esc(models[i])}</div>
            ${maint ? `<div class="maint-badge">${esc(t('maintBadge'))}</div>` : ''}
            <div class="lease-offer">
              <div class="lease-label">${esc(t('leaseLabel'))}</div>
              <div class="lease-price">${esc(v['Lease Price'])}<span class="lease-unit">/mo*</span></div>
              <div class="lease-due">${esc(v['Due at Signing'])} ${esc(t('dueAtSigning'))} · ${esc(v['Lease Term'])}</div>
              <div class="lease-divider">${esc(t('or'))}</div>
              <div class="lease-label">${esc(t('leaseZeroLabel'))}</div>
              <div class="lease-price">${esc(v['$0 Down Price'])}<span class="lease-unit">/mo*</span></div>
              <div class="lease-due">${esc(t('zeroDown'))}</div>
            </div>
            <div class="v-card-cta">
              <a href="${esc(v['Shop URL'])}" class="btn btn-primary">${esc(t('shopNow'))}</a>
              <a href="/new-car-specials-lead-form.htm" class="btn btn-outline">${esc(t('claimOffer'))}</a>
            </div>
          </div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div id="zero-down-leases" class="section section-gray acs-oem-brand">
        <span class="scroll-target"></span>
        <div class="section-inner">
        <div class="section-header">
          <p class="section-eyebrow">${esc(t('leaseSectionEyebrow'))}</p>
          <h2 class="section-title acs-bold">${esc(t('leaseSectionTitle'))}</h2>
          <p class="section-sub">${esc(t('leaseSectionSub'))}</p>
        </div>
        <div class="includes-bar">
          <div class="includes-bar-label">
            <p>${esc(t('incBarTitle'))}</p>
            <p>${esc(t('incBarSub'))}</p>
          </div>
          <div class="includes-tags">${incTags}</div>
        </div>
        <div class="card-grid">${cards}</div>
        ${leaseSectionDisclHtml}
        </div>
      </div>`;
  }

  // Used Specials — renders each visible offer by Card Type
  function buildUsedSpecials(offers, el) {
    const active = offers.filter(isVisible);
    if (!active.length) { el.style.display = 'none'; return; }

    // Separate by card type, preserving order
    const heroOffers    = active.filter(o => o['Card Type'] === 'hero');
    const aprOffers     = active.filter(o => o['Card Type'] === 'apr-card');
    const programOffers = active.filter(o => o['Card Type'] === 'program-card');

    const heroHtml = heroOffers.map(o => `
      <div class="section section-alt acs-oem-brand">
        <div class="hero-split">
          <div class="hero-split-img">
            <a href="${esc(o['Image CTA URL'] || '/used-inventory/index.htm')}">
              <picture>
                <source media="(min-width:768px)" srcset="${esc(o['Image URL (desktop)'])}">
                <source media="(min-width:0px)"   srcset="${esc(o['Image URL (mobile)'] || o['Image URL (desktop)'])}">
                <img src="${esc(o['Image URL (desktop)'])}" alt="${esc(o['Image Alt'])}">
              </picture>
            </a>
          </div>
          <div class="hero-split-body">
            <p class="section-eyebrow">Gettel Exclusive Offer</p>
            <div class="match-num">${esc(o['Headline / Big Number'])}</div>
            <div class="match-label">${esc(o['Subheading'])}</div>
            <p class="match-desc">${esc(o['Description'])}</p>
            <a href="${esc(o['CTA 1 URL'])}" class="btn btn-primary">${esc(o['CTA 1 Label'])}</a>
          </div>
        </div>
        ${o['Disclaimer'] ? `<details class="disclaimer">
          <summary>${esc(o['Subheading'])} — Disclaimer</summary>
          <p>${esc(o['Disclaimer'])}</p>
        </details>` : ''}
      </div>
      <hr class="section-divider">`).join('');

    const aprHtml = aprOffers.length ? `
      <div class="section section-gray acs-oem-brand">
        <div class="section-header centered">
          <p class="section-eyebrow">Everything You Need</p>
          <h2 class="section-title acs-bold">Finance, Certify &amp; Drive</h2>
          <p class="section-sub">Low rates, flexible programs, and every vehicle backed by our peace-of-mind guarantee.</p>
        </div>
        <div class="card-grid-2">
          ${aprOffers.map(o => `
          <div class="offer-card offer-card-horiz">
            <div class="offer-card-accent"></div>
            <div class="offer-card-badge" style="background:#fafafa;">
              <div style="text-align:center;">
                <div class="apr-badge">${esc(o['Headline / Big Number'])}</div>
                <div class="apr-badge-label">${esc(o['Subheading'])}</div>
              </div>
            </div>
            <div class="offer-card-body">
              <div class="offer-card-title">${esc(o['Description'])}</div>
              <div class="offer-card-body-text">
                ${[o['List Item 1'], o['List Item 2'], o['List Item 3']].filter(Boolean).length
                  ? `<ul>${[o['List Item 1'], o['List Item 2'], o['List Item 3']].filter(Boolean).map(li => `<li>${esc(li)}</li>`).join('')}</ul>`
                  : ''}
              </div>
              ${o['CTA 1 Label'] ? `<a href="${esc(o['CTA 1 URL'])}" class="btn btn-primary">${esc(o['CTA 1 Label'])}</a>` : ''}
              ${o['CTA 2 Label'] ? `<a href="${esc(o['CTA 2 URL'])}" class="btn btn-outline">${esc(o['CTA 2 Label'])}</a>` : ''}
              ${o['Disclaimer'] ? `<details class="disclaimer"><summary>${esc(t('disclaimerToggle'))}</summary><p>${esc(o['Disclaimer'])}</p></details>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>` : '';

    const programHtml = programOffers.length ? `
      <div class="section section-gray acs-oem-brand" style="padding-top:0;">
        <div class="card-grid-2">
          ${programOffers.map(o => `
          <div class="offer-card">
            <div class="offer-card-accent green"></div>
            <div class="offer-card-badge">
              <img src="${esc(o['Image URL (desktop)'])}" alt="${esc(o['Image Alt'])}">
            </div>
            <div class="offer-card-body">
              <div class="offer-card-eyebrow green">${esc(o['Subheading'])}</div>
              <div class="offer-card-title">${esc(o['Headline / Big Number'])}</div>
              ${[o['List Item 1'], o['List Item 2'], o['List Item 3']].filter(Boolean).length
                ? `<div class="offer-card-body-text"><ul>${[o['List Item 1'], o['List Item 2'], o['List Item 3']].filter(Boolean).map(li => `<li>${esc(li)}</li>`).join('')}</ul></div>`
                : ''}
              ${o['CTA 1 Label'] ? `<a href="${esc(o['CTA 1 URL'])}" class="btn btn-primary">${esc(o['CTA 1 Label'])}</a>` : ''}
              ${o['Disclaimer'] ? `<details class="disclaimer"><summary>${esc(t('disclaimerToggle'))}</summary><p>${esc(o['Disclaimer'])}</p></details>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>` : '';

    el.innerHTML = heroHtml + aprHtml + programHtml;
  }


  async function buildSpecialPrograms(offers, el) {
    const active = offers.filter(isVisible);
    if (!active.length) { el.style.display = 'none'; return; }

    let eyebrows = active.map(o => o['Eyebrow']);
    let titles   = active.map(o => o['Title']);
    let bodies   = active.map(o => o['Body']);
    let li1s     = active.map(o => o['List Item 1']);
    let li2s     = active.map(o => o['List Item 2']);
    let li3s     = active.map(o => o['List Item 3']);
    let ctas     = active.map(o => o['CTA Label']);
    let discls   = active.map(o => o['Disclaimer']);

    if (IS_ES) {
      [eyebrows, titles, bodies, li1s, li2s, li3s, ctas, discls] = await Promise.all([
        translateBatch(eyebrows),
        translateBatch(titles),
        translateBatch(bodies),
        translateBatch(li1s),
        translateBatch(li2s),
        translateBatch(li3s),
        translateBatch(ctas),
        translateBatch(discls),
      ]);
    }

    const cards = active.map((o, i) => {
      const listItems = [li1s[i], li2s[i], li3s[i]].filter(Boolean);
      const isPrimary = (o['CTA Style'] || 'primary').toLowerCase() !== 'outline';
      return `
        <div class="promo-card">
          ${o['Image URL'] ? `<img src="${esc(o['Image URL'])}" alt="${esc(o['Image Alt'])}">` : ''}
          <div class="promo-card-body">
            <div class="section-eyebrow">${esc(eyebrows[i])}</div>
            <div class="promo-title">${esc(titles[i])}</div>
            <div class="promo-desc">
              ${bodies[i] ? esc(bodies[i]) : ''}
              ${listItems.length ? `<ul style="margin-top:6px;">${listItems.map(li => `<li>${esc(li)}</li>`).join('')}</ul>` : ''}
            </div>
            <a href="${esc(o['CTA URL'])}" class="btn ${isPrimary ? 'btn-primary' : 'btn-outline'}">${esc(ctas[i])}</a>
            ${discls[i] ? `<details class="disclaimer" style="margin-top:10px;">
              <summary>${esc(t('disclaimerToggle'))}</summary>
              <p>${esc(discls[i])}</p>
            </details>` : ''}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div id="programs" class="section section-alt acs-oem-brand">
        <span class="scroll-target"></span>
        <div class="section-inner">
        <div class="section-header">
          <p class="section-eyebrow">${esc(t('programsSectionEyebrow'))}</p>
          <h2 class="section-title acs-bold">${esc(t('programsSectionTitle'))}</h2>
          <p class="section-sub">${esc(t('programsSectionSub'))}</p>
        </div>
        <div class="promo-grid">${cards}</div>
        </div>
      </div>`;
  }

  // ── Main ───────────────────────────────────────────────────────────
  async function init() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const IS_USED = (root.getAttribute('data-page') || 'new') === 'used';
    const tzEl       = document.createElement('div');
    const ggEl       = document.createElement('div');
    const leaseEl    = document.createElement('div');
    const programsEl = document.createElement('div');
    const usedEl     = document.createElement('div');

    if (IS_USED) {
      root.appendChild(usedEl);
      // Skeleton for used specials while data loads
      usedEl.innerHTML = `
      <div class="skeleton-section">
        <div class="section-inner">
          <div class="skel" style="width:100%;height:240px;border-radius:6px;margin-bottom:16px;"></div>
        </div>
      </div>
      <div class="skeleton-section skeleton-alt">
        <div class="section-inner">
          <div class="skel-header">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title" style="margin-top:8px;"></div>
          </div>
          <div class="skel-promo-grid">
            ${Array(2).fill(`
            <div class="skel-promo-card">
              <div class="skel-promo-img"><div class="skel"></div></div>
              <div class="skel-promo-body">
                <div class="skel" style="height:18px;width:80%;"></div>
                <div class="skel" style="height:12px;"></div>
                <div class="skel" style="height:12px;width:90%;"></div>
                <div class="skel" style="height:34px;margin-top:12px;"></div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="skeleton-section skeleton-alt" style="padding-top:0;">
        <div class="section-inner">
          <div class="skel-promo-grid">
            ${Array(2).fill(`
            <div class="skel-promo-card">
              <div class="skel-promo-img"><div class="skel"></div></div>
              <div class="skel-promo-body">
                <div class="skel" style="height:10px;width:40%;"></div>
                <div class="skel" style="height:18px;width:70%;"></div>
                <div class="skel" style="height:12px;"></div>
                <div class="skel" style="height:12px;width:90%;"></div>
                <div class="skel" style="height:34px;margin-top:12px;"></div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>`;
    } else {
      root.append(tzEl, ggEl, leaseEl, programsEl);
      // Show skeleton placeholders while data loads
      tzEl.innerHTML = `
      <div class="skeleton-section">
        <div class="section-inner">
          <div class="skel-header">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title" style="margin-top:8px;"></div>
            <div class="skel skel-sub" style="margin-top:8px;"></div>
          </div>
          <div class="skel skel-bar"></div>
          <div class="skel-grid">
            ${Array(7).fill('<div class="skel-card"><div class="skel-card-img"><div class="skel"></div></div><div class="skel-card-body"><div class="skel" style="height:12px;width:40%;"></div><div class="skel" style="height:18px;width:70%;"></div><div class="skel" style="height:48px;"></div><div class="skel" style="height:32px;margin-top:10px;"></div><div class="skel" style="height:32px;"></div></div></div>').join('')}
          </div>
        </div>
      </div>`;
      ggEl.innerHTML = `
      <div class="skeleton-section skeleton-alt">
        <div class="section-inner">
          <div class="skel-header">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title" style="margin-top:8px;"></div>
            <div class="skel skel-sub" style="margin-top:8px;"></div>
          </div>
          <div class="skel-promo-grid">
            ${Array(3).fill('<div class="skel-promo-card"><div class="skel-promo-img"><div class="skel"></div></div><div class="skel-promo-body"><div class="skel" style="height:18px;width:80%;"></div><div class="skel" style="height:12px;"></div><div class="skel" style="height:12px;width:90%;"></div><div class="skel" style="height:34px;margin-top:12px;"></div></div></div>').join('')}
          </div>
        </div>
      </div>`;
      leaseEl.innerHTML = `
      <div class="skeleton-section skeleton-alt">
        <div class="section-inner">
          <div class="skel-header">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title" style="margin-top:8px;"></div>
            <div class="skel skel-sub" style="margin-top:8px;"></div>
          </div>
          <div class="skel skel-bar"></div>
          <div class="skel-grid">
            ${Array(7).fill('<div class="skel-card"><div class="skel-card-img"><div class="skel"></div></div><div class="skel-card-body"><div class="skel" style="height:12px;width:40%;"></div><div class="skel" style="height:18px;width:70%;"></div><div class="skel" style="height:20px;width:90%;margin-bottom:4px;"></div><div class="skel" style="height:60px;"></div><div class="skel" style="height:32px;margin-top:10px;"></div><div class="skel" style="height:32px;"></div></div></div>').join('')}
          </div>
        </div>
      </div>`;
      programsEl.innerHTML = `
      <div class="skeleton-section">
        <div class="section-inner">
          <div class="skel-header">
            <div class="skel skel-eyebrow"></div>
            <div class="skel skel-title" style="margin-top:8px;"></div>
            <div class="skel skel-sub" style="margin-top:8px;"></div>
          </div>
          <div class="skel-promo-grid">
            ${Array(2).fill('<div class="skel-promo-card"><div class="skel-promo-img"><div class="skel"></div></div><div class="skel-promo-body"><div class="skel" style="height:18px;width:80%;"></div><div class="skel" style="height:12px;"></div><div class="skel" style="height:12px;width:90%;"></div><div class="skel" style="height:34px;margin-top:12px;"></div></div></div>').join('')}
          </div>
        </div>
      </div>`;
    }

    try {
      const [tzCsv, tzBannerCsv, ggCsv, leaseCsv, usedCsv, programsCsv] = await Promise.all([
        IS_USED ? Promise.resolve('') : fetchTab(TABS.tz),
        IS_USED ? Promise.resolve('') : fetchTab(TABS.tz_banner),
        IS_USED ? Promise.resolve('') : fetchTab(TABS.gg),
        IS_USED ? Promise.resolve('') : fetchTab(TABS.lease),
        IS_USED ? fetchTab(TABS.used) : Promise.resolve(''),
        IS_USED ? Promise.resolve('') : fetchTab(TABS.programs),
      ]);

      await translateUI();
      translateSidebar();

      await Promise.all([
        IS_USED ? Promise.resolve() : buildTripleZero(csvToOffers(tzCsv), csvToOffers(tzBannerCsv), tzEl),
        IS_USED ? Promise.resolve() : buildGettelsGotIt(csvToOffers(ggCsv),       ggEl),
        IS_USED ? Promise.resolve() : buildLeases(csvToOffers(leaseCsv),          leaseEl),
        IS_USED ? Promise.resolve() : buildSpecialPrograms(csvToOffers(programsCsv), programsEl),
        IS_USED ? Promise.resolve(buildUsedSpecials(csvToOffers(usedCsv), usedEl)) : Promise.resolve(),
      ]);

      // All sections rendered — signal scroll spy to recalculate
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent('gst:ready'));
        if (IS_ES) document.dispatchEvent(new CustomEvent('gst:translated'));
      }));

    } catch (err) {
      console.error('[gst-specials] Error:', err.message || err);
      root.innerHTML = `<p style="padding:20px;color:#888;font-size:12px;">Specials are currently being updated. Please check back shortly.<br><small>${err.message || err}</small></p>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
