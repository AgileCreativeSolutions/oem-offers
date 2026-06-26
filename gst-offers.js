/**
 * gst-offers.js
 * Gettel Stadium Toyota — Dynamic Specials Insertion (Framework / VV-style build)
 * AgileCreativeSolutions / oem-offers
 *
 * This build populates STATIC framework card scaffolding (acs- classes) by
 * cloning a template card per offer and filling it via class selectors —
 * the Boston Volvo population pattern — rather than writing innerHTML.
 *
 * Data layer (fetch, parser, translation, cache) is preserved from the
 * prior custom build. Only the render/builder layer changed.
 *
 * Sheet structure (field rows × offer columns). Tabs:
 *   lease    (gid 479064372) — "Special Offers": vehicle cards, 4 offers each
 *   tz_slide (NEW tab)       — Triple Zero event slide image URLs
 *   gg       (gid 623929825) — Gettel's Got It
 *   programs (gid 2028269504)— Special Programs
 *
 * Visibility row: blank = show, type "hide" to suppress.
 *
 * Spanish page (/ofertas-especiales): auto-detects URL, auto-translates all
 * visible text via Google Translate, caches in localStorage for 24 hrs.
 */

(function () {
  'use strict';

  const PUBLISHED_ID = '2PACX-1vT_NkCgmMIPQofGnlqTNF__0OtnWwEj727RWUP2Up9L0bnQyz_TDiRoh3GDkitU-Lc-4j9md7-3OFeX';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const IS_ES = /ofertas-especiales|spanish-specials-test-page/i.test(window.location.pathname);

  const TABS = {
    lease:    '479064372',   // "Special Offers" — vehicle cards
    tz_slide: '1826732084', // NEW tab — Triple Zero slide image
    gg:       '623929825',
    programs: '2028269504',
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
   * Field rows × offer columns.
   * Row 0 = banner (skip), header row = first row whose col 0 is "Field",
   * Col 0 = field name. Returns one object per offer column.
   */
  function csvToOffers(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][0] || '').trim().toLowerCase() === 'field') {
        headerRowIdx = i;
        break;
      }
    }
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
    return offers.filter(o => Object.values(o).some(v => v));
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

  // ── Small DOM helpers ──────────────────────────────────────────────
  // Set text on a child by class. Hide the element if value is empty so
  // empty offer slots collapse cleanly (VV cards always ship all 4 slots).
  function setText(scope, cls, val) {
    const el = scope.querySelector('.' + cls);
    if (!el) return;
    if (val) { el.textContent = val; }
    else { el.textContent = ''; el.style.display = 'none'; }
  }

  function setAttr(scope, cls, attr, val) {
    const el = scope.querySelector('.' + cls);
    if (el && val) el.setAttribute(attr, val);
  }

  // Reveal a card inline (DDC platform CSS fights class-based hiding, so the
  // page hides via [data-ready="0"] and we flip the attribute + inline style)
  function markReady(card) {
    card.setAttribute('data-ready', '1');
    card.style.display = '';
  }

  // ── Section: New Toyota Specials (vehicle cards, 4 offers each) ─────
  async function buildVehicleCards(offers) {
    const tpl = document.querySelector('.car-offer[data-model]');
    if (!tpl) return;
    const parent = tpl.parentNode;
    const active = offers.filter(o => isVisible(o) && o['Year'] && o['Model']);

    if (!active.length) {
      // Nothing to show — remove the template card and bail
      tpl.remove();
      return;
    }

    // Spanish: translate all dynamic strings for all cards in one batch
    let xl = {};
    if (IS_ES) {
      const flat = [];
      const push = (o) => {
        flat.push(o['Trim'] || '', o['MSRP'] || '', o['Maintenance'] || '');
        for (let n = 1; n <= 4; n++) {
          flat.push(o[`Offer ${n} Type`] || '', o[`Offer ${n} Headline`] || '',
                    o[`Offer ${n} Terms`] || '', o[`Offer ${n} Disclaimer`] || '');
        }
      };
      active.forEach(push);
      const out = await translateBatch(flat);
      let k = 0;
      xl = active.map(() => {
        const rec = { Trim: out[k++], MSRP: out[k++], Maintenance: out[k++], offers: [] };
        for (let n = 1; n <= 4; n++) {
          rec.offers.push({ Type: out[k++], Headline: out[k++], Terms: out[k++], Disclaimer: out[k++] });
        }
        return rec;
      });
    }

    const anchorParts = [];

    active.forEach((v, vi) => {
      const card = tpl.cloneNode(true);
      const tr   = IS_ES ? xl[vi] : null;

      // ID / anchor (slugified model)
      const slug = (v['Anchor'] || v['Model'] || ('gst-offer-' + (vi + 1)))
        .toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      card.id = slug;
      card.setAttribute('data-model', 'GST-Offer' + (vi + 1));

      // Title block
      setText(card, 'model-title', v['Model']);
      setText(card, 'trim-level',  tr ? tr.Trim : v['Trim']);
      setText(card, 'msrp',        tr ? tr.MSRP : v['MSRP']);
      setText(card, 'maintenance', tr ? tr.Maintenance : v['Maintenance']);

      // If no maintenance value, hide the accent bar entirely
      const maintEl = card.querySelector('.maintenance');
      if (maintEl && !(tr ? tr.Maintenance : v['Maintenance'])) {
        const bar = maintEl.closest('.acs-bg-accent');
        if (bar) bar.style.display = 'none';
      }

      // Image
      const img = card.querySelector('.offer-image');
      if (img) {
        if (v['Image URL']) img.src = v['Image URL'];
        img.alt = (v['Year'] ? v['Year'] + ' ' : '') + (v['Model'] || '');
        if ((v['Flip Image'] || '').toLowerCase() === 'yes') img.style.transform = 'scaleX(-1)';
      }

      // Year prefix on model title (VV shows trim; GST shows Year as eyebrow-ish)
      // Keep Year inside trim-level if no Trim provided
      if (!v['Trim'] && v['Year']) setText(card, 'trim-level', v['Year']);

      // Four offer slots
      let anyOfferShown = false;
      for (let n = 1; n <= 4; n++) {
        const cardEl = card.querySelector('.offer-' + n + '-card');
        const type     = tr ? tr.offers[n - 1].Type     : (v[`Offer ${n} Type`]     || '');
        const headline = tr ? tr.offers[n - 1].Headline : (v[`Offer ${n} Headline`] || '');
        const terms    = tr ? tr.offers[n - 1].Terms    : (v[`Offer ${n} Terms`]    || '');
        const disc     = tr ? tr.offers[n - 1].Disclaimer : (v[`Offer ${n} Disclaimer`] || '');
        const hidden   = (v[`Offer ${n} Card`] || '').toLowerCase() === 'hide';

        if (hidden || (!type && !headline && !terms)) {
          if (cardEl) cardEl.style.display = 'none';
        } else {
          anyOfferShown = true;
          setText(card, 'offer-' + n + '-type', type);
          setText(card, 'offer-' + n + '-headline', headline);
          setText(card, 'offer-' + n + '-terms', terms);
        }
        // Disclaimer paragraph (inside the rolled-up details)
        setText(card, 'offer-' + n + '-disclaimer', disc ? (type ? type + ': ' + disc : disc) : '');
      }

      // Buttons
      setAttr(card, 'shopping-link', 'href', v['Shop URL'] || '#');
      const shopLink = card.querySelector('.shopping-link-text');
      if (shopLink) shopLink.textContent = v['Shop Button Label'] || 'Shop Inventory';
      const claimLink = card.querySelector('.acs-button:not(.acs-button2)');
      if (claimLink && v['Claim Offer URL']) claimLink.href = v['Claim Offer URL'];

      // Anchor nav entry
      anchorParts.push(`<a href="#${slug}" class="acs-accent"> ${v['Model']}</a>`);

      markReady(card);
      parent.insertBefore(card, tpl);
    });

    // Remove the original (still-empty) template card
    tpl.remove();

    // Populate anchor link strips (top + bottom)
    const navHtml = anchorParts.join(' | ');
    document.querySelectorAll('[data-nav="links"]').forEach(span => { span.innerHTML = navHtml; });
  }

  // ── Section: Triple Zero Event Slide (image from sheet) ────────────
  // Reads the slide tab as a simple key->value map straight down columns
  // A/B. This deliberately bypasses csvToOffers' header-row detection: a
  // single-column settings tab has no "Field" header, and the offer-column
  // logic would otherwise consume the first data row as a header and drop it.
  function buildTripleZeroSlide(csvText) {
    const pic = document.getElementById('tz-slide');
    if (!pic) return;

    const rows = parseCsv(csvText || '');
    const kv = {};
    rows.forEach(r => {
      const key = (r[0] || '').trim();
      const val = (r[1] || '').trim();
      if (key) kv[key] = val;
    });

    if ((kv['Visibility'] || '').trim().toLowerCase() === 'hide') {
      pic.parentNode.style.display = 'none';
      return;
    }

    const desktop = kv['Image URL (desktop)'] || kv['Desktop'] || kv['Image URL'] || '';
    const mobile  = kv['Image URL (mobile)']  || kv['Mobile']  || desktop;
    const alt     = kv['Image Alt'] || 'Gettel Stadium Toyota Triple Zero Event';
    const link    = kv['CTA URL'] || kv['Image CTA URL'] || '';

    if (!desktop) { pic.parentNode.style.display = 'none'; return; }

    const dSrc = pic.querySelector('.tz-slide-desktop');
    const mSrc = pic.querySelector('.tz-slide-mobile');
    const img  = pic.querySelector('.tz-slide-img');
    if (dSrc) dSrc.srcset = desktop;
    if (mSrc) mSrc.srcset = mobile;
    if (img) { img.src = desktop; img.alt = alt; }

    if (link && img) {
      const a = document.createElement('a');
      a.href = link;
      pic.parentNode.insertBefore(a, pic);
      a.appendChild(pic);
    }
  }

  // ── Section: Gettel's Got It! (full 3-col width) ───────────────────
  async function buildGettelsGotIt(offers) {
    const tpl = document.querySelector('.gg-offer[data-gg]');
    if (!tpl) return;
    const parent = tpl.parentNode;
    const active = offers.filter(o => isVisible(o) && o['Title']);

    // Section header (eyebrow/title/subtitle live in field rows)
    let secTitle = (offers.find(o => o['Section Title']) || {})['Section Title'] || '';
    let secSub   = (offers.find(o => o['Section Subtitle']) || {})['Section Subtitle'] || '';

    if (!active.length) { tpl.remove(); document.getElementById('gettels-got-it').style.display = 'none'; return; }

    let titles = active.map(v => v['Title']);
    let descs  = active.map(v => v['Description']);
    let ctas   = active.map(v => v['CTA Label']);
    let discls = active.map(v => v['Disclaimer']);
    if (IS_ES) {
      [titles, descs, ctas, discls, [secTitle, secSub]] = await Promise.all([
        translateBatch(titles), translateBatch(descs),
        translateBatch(ctas),   translateBatch(discls),
        translateBatch([secTitle, secSub]),
      ]);
    }

    if (secTitle) { const e = document.querySelector('.gg-section-title'); if (e) e.textContent = secTitle; }
    if (secSub)   { const e = document.querySelector('.gg-section-sub');   if (e) e.textContent = secSub; }
    else          { const e = document.querySelector('.gg-section-sub');   if (e) e.style.display = 'none'; }

    active.forEach((v, i) => {
      const card = tpl.cloneNode(true);
      card.setAttribute('data-gg', String(i + 1));

      const link = card.querySelector('.gg-link');
      if (link && v['CTA URL']) link.href = v['CTA URL'];
      const img = card.querySelector('.gg-image');
      if (img) { if (v['Image URL']) img.src = v['Image URL']; img.alt = v['Image Alt'] || titles[i] || ''; }

      setText(card, 'gg-title', titles[i]);
      setText(card, 'gg-desc',  descs[i]);

      const cta = card.querySelector('.gg-cta');
      if (cta) { cta.textContent = ctas[i] || 'Learn More'; if (v['CTA URL']) cta.href = v['CTA URL']; }

      if (discls[i]) {
        setText(card, 'gg-disc', discls[i]);
        const wrap = card.querySelector('.gg-disc-wrap');
        if (wrap) wrap.style.display = '';
      }

      markReady(card);
      parent.insertBefore(card, tpl);
    });

    tpl.remove();
  }

  // ── Section: Special Programs (full 3-col width) ───────────────────
  async function buildSpecialPrograms(offers) {
    const tpl = document.querySelector('.sp-offer[data-sp]');
    if (!tpl) return;
    const parent = tpl.parentNode;
    const active = offers.filter(o => isVisible(o) && o['Title']);

    let secTitle = (offers.find(o => o['Section Title']) || {})['Section Title'] || '';
    let secSub   = (offers.find(o => o['Section Subtitle']) || {})['Section Subtitle'] || '';

    if (!active.length) { tpl.remove(); document.getElementById('special-programs').style.display = 'none'; return; }

    let eyebrows = active.map(o => o['Eyebrow']);
    let titles   = active.map(o => o['Title']);
    let bodies   = active.map(o => o['Body']);
    let li1s     = active.map(o => o['List Item 1']);
    let li2s     = active.map(o => o['List Item 2']);
    let li3s     = active.map(o => o['List Item 3']);
    let ctas     = active.map(o => o['CTA Label']);
    let discls   = active.map(o => o['Disclaimer']);

    if (IS_ES) {
      [eyebrows, titles, bodies, li1s, li2s, li3s, ctas, discls, [secTitle, secSub]] = await Promise.all([
        translateBatch(eyebrows), translateBatch(titles), translateBatch(bodies),
        translateBatch(li1s), translateBatch(li2s), translateBatch(li3s),
        translateBatch(ctas), translateBatch(discls), translateBatch([secTitle, secSub]),
      ]);
    }

    if (secTitle) { const e = document.querySelector('.sp-section-title'); if (e) e.textContent = secTitle; }
    if (secSub)   { const e = document.querySelector('.sp-section-sub');   if (e) e.textContent = secSub; }
    else          { const e = document.querySelector('.sp-section-sub');   if (e) e.style.display = 'none'; }

    active.forEach((o, i) => {
      const card = tpl.cloneNode(true);
      card.setAttribute('data-sp', String(i + 1));

      const img = card.querySelector('.sp-image');
      if (img) {
        if (o['Image URL']) img.src = o['Image URL'];
        else img.style.display = 'none';
        img.alt = o['Image Alt'] || titles[i] || '';
      }

      setText(card, 'sp-eyebrow', eyebrows[i]);
      setText(card, 'sp-title',   titles[i]);
      setText(card, 'sp-body',    bodies[i]);

      const listItems = [li1s[i], li2s[i], li3s[i]].filter(Boolean);
      const ul = card.querySelector('.sp-list');
      if (ul) {
        if (listItems.length) {
          ul.innerHTML = listItems.map(li => `<li>${li.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</li>`).join('');
        } else {
          ul.style.display = 'none';
        }
      }

      const cta = card.querySelector('.sp-cta');
      if (cta) {
        cta.textContent = ctas[i] || 'Learn More';
        if (o['CTA URL']) cta.href = o['CTA URL'];
        if ((o['CTA Style'] || 'primary').toLowerCase() === 'outline') {
          cta.classList.remove('acs-button'); cta.classList.add('acs-button2');
        }
      }

      if (discls[i]) {
        setText(card, 'sp-disc', discls[i]);
        const wrap = card.querySelector('.sp-disc-wrap');
        if (wrap) wrap.style.display = '';
      }

      markReady(card);
      parent.insertBefore(card, tpl);
    });

    tpl.remove();
  }

  // ── Main ───────────────────────────────────────────────────────────
  async function init() {
    try {
      const [leaseCsv, slideCsv, ggCsv, programsCsv] = await Promise.all([
        fetchTab(TABS.lease),
        TABS.tz_slide && TABS.tz_slide !== 'REPLACE_ME'
          ? fetchTab(TABS.tz_slide).catch(() => '')
          : Promise.resolve(''),
        fetchTab(TABS.gg),
        fetchTab(TABS.programs),
      ]);

      await Promise.all([
        buildVehicleCards(csvToOffers(leaseCsv)),
        Promise.resolve(buildTripleZeroSlide(slideCsv)),
        buildGettelsGotIt(csvToOffers(ggCsv)),
        buildSpecialPrograms(csvToOffers(programsCsv)),
      ]);

      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.dispatchEvent(new CustomEvent('gst:ready'));
        if (IS_ES) document.dispatchEvent(new CustomEvent('gst:translated'));
      }));

    } catch (err) {
      console.error('[gst-offers] Error:', err.message || err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
