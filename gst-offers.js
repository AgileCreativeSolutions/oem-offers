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
   *   leases399(gid 1066747404)— "$399 Leases": vehicle cards, same schema
   *   tz_banner(gid 34597066) — Triple Zero Banner: 4 stat items + CTA
   *   promo    (gid 1474562913)— Promo Blocks: 1 full width, 2 side by side
   *   event    (gid 484127685) — Event Banner: logo, tagline, car cuts
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
      leases399: '1066747404', // "$399 Leases" — vehicle cards
      tz_banner: '34597066',   // "Triple Zero Banner" — stat items + CTA
      promo:    '1474562913', // "Promo Blocks" — replaces Gettel's Got It
      event:    '484127685',  // "Event Banner" — top-of-page banner
      programs: '2028269504',
      used:     '437612271',   // Used / Pre-Owned Specials
    };

    // Page detection: pages mount <div data-page="..."> to select a mode.
    //   used -> Used / Pre-Owned Specials
    //   399  -> $399 Leases (vehicle cards only, off the leases399 tab)
    // No attribute = the standard specials page (lease + tz + gg + programs).
    const PAGE = (function () {
      const el = document.querySelector('[data-page]');
      return el ? (el.getAttribute('data-page') || '').trim().toLowerCase() : '';
    })();
    const IS_USED = PAGE === 'used';
    const IS_399  = PAGE === '399';

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

    // Google's free endpoint is a GET, so everything rides in the URL. The
    // vehicle cards used to send ~19 strings per vehicle (disclaimers included)
    // in one request, which blew past the URL limit, errored, and silently fell
    // back to English. Requests are now deduped, stripped of empty strings, and
    // chunked under a URL budget. A chunk whose delimiter count comes back wrong
    // is split in half and retried so strings never land in the wrong slot.
    const XLAT_DELIM  = ' ||| ';
    const XLAT_BUDGET = 1800; // max encoded chars of q= per request

    async function translateChunk(chunk) {
      const cacheKey = 'gst_xlat_' + hashStr(chunk.join('|||'));
      const cached   = cacheGet(cacheKey);
      if (cached && cached.length === chunk.length) return cached;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(chunk.join(XLAT_DELIM))}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data   = await res.json();
        const joined = (data[0] || []).map(c => c[0] || '').join('');
        if (chunk.length === 1) {
          const one = [joined.trim() || chunk[0]];
          cacheSet(cacheKey, one);
          return one;
        }
        const result = joined.split(/\s*\|\s*\|\s*\|\s*/).map(s => s.trim());
        if (result.length !== chunk.length) {
          const mid = Math.ceil(chunk.length / 2);
          const [a, b] = await Promise.all([translateChunk(chunk.slice(0, mid)), translateChunk(chunk.slice(mid))]);
          return a.concat(b);
        }
        cacheSet(cacheKey, result);
        return result;
      } catch {
        return chunk;
      }
    }

    async function translateBatch(strings) {
      if (!strings.length) return strings;
      const keys = strings.map(s => (s || '').trim());
      const uniq = [...new Set(keys.filter(Boolean))];
      if (!uniq.length) return strings.map(s => s || '');

      const chunks = [];
      let cur = [], len = 0;
      uniq.forEach(s => {
        const cost = encodeURIComponent(s + XLAT_DELIM).length;
        if (cur.length && len + cost > XLAT_BUDGET) { chunks.push(cur); cur = []; len = 0; }
        cur.push(s); len += cost;
      });
      if (cur.length) chunks.push(cur);

      const results = await Promise.all(chunks.map(translateChunk));
      const map = new Map();
      chunks.forEach((c, ci) => c.forEach((s, si) => map.set(s, results[ci][si] || s)));
      return keys.map((k, i) => (k ? map.get(k) : (strings[i] || '')));
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

    // ── Skeleton loaders ───────────────────────────────────────────────
    // Card templates don't exist as real content until a fetch resolves and
    // the builder clones them, so there's nothing to attach a "loading" state
    // to. Instead we inject a fixed number of shimmer placeholder cards into
    // each section up front (before any fetch), then tear them down the moment
    // that section's real cards are about to be inserted. Skeletons copy the
    // template's grid width classes so they occupy the same column layout.
    const SKELETON_COUNTS = { car: 6, sp: 3 };

    function skeletonCard(widthClasses) {
      const col = document.createElement('div');
      col.className = widthClasses + ' acs-my-2 acs-flex gst-skel';
      col.setAttribute('data-skel', '1');
      col.innerHTML =
        '<div class="acs-offer-cell acs-bg-white acs-br-2 acs-border acs-flex acs-flex-column" style="width:100%;overflow:hidden;">' +
          '<div class="gst-skel-box" style="height:12em;"></div>' +
          '<div class="acs-p-5 acs-flex acs-flex-column acs-flex-grow">' +
            '<div class="gst-skel-line" style="width:70%;height:1.4em;"></div>' +
            '<div class="gst-skel-line" style="width:100%;"></div>' +
            '<div class="gst-skel-line" style="width:92%;"></div>' +
            '<div class="gst-skel-line" style="width:60%;"></div>' +
            '<div class="gst-skel-line gst-skel-btn" style="width:100%;height:2.4em;margin-top:auto;"></div>' +
          '</div>' +
        '</div>';
      return col;
    }

    function renderSkeletons() {
      const map = [
        { tpl: '.car-offer[data-model]', n: SKELETON_COUNTS.car },
        { tpl: '.sp-offer[data-sp]',     n: SKELETON_COUNTS.sp },
      ];
      map.forEach(({ tpl, n }) => {
        const t = document.querySelector(tpl);
        if (!t) return;
        // Reuse the template's column width classes; drop the offer/state hooks.
        const widths = t.className
          .replace(/\b(car-offer|gg-offer|sp-offer|acs-flex|acs-my-2)\b/g, '')
          .trim().replace(/\s+/g, ' ');
        const parent = t.parentNode;
        for (let i = 0; i < n; i++) parent.insertBefore(skeletonCard(widths), t);
      });
    }

    function clearSkeletonsIn(container) {
      if (!container) return;
      container.querySelectorAll(':scope > .gst-skel[data-skel="1"]').forEach(el => el.remove());
    }

    // ── Section: New Toyota Specials (vehicle cards, 4 offers each) ─────
    async function buildVehicleCards(offers) {
      const tpl = document.querySelector('.car-offer[data-model]');
      if (!tpl) return;
      const parent = tpl.parentNode;
      clearSkeletonsIn(parent);
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
          flat.push(o['Vehicle Call Out'] || '', o['Trim'] || '', o['MSRP'] || '', o['Maintenance'] || '');
          for (let n = 1; n <= 4; n++) {
            flat.push(o[`Offer ${n} Type`] || '', o[`Offer ${n} Headline`] || '',
                      o[`Offer ${n} Terms`] || '', o[`Offer ${n} Disclaimer`] || '');
          }
        };
        active.forEach(push);
        const out = await translateBatch(flat);
        let k = 0;
        xl = active.map(() => {
          const rec = { Callout: out[k++], Trim: out[k++], MSRP: out[k++], Maintenance: out[k++], offers: [] };
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

        // Vehicle Call Out bar (above the photo). Blank cell = no bar, and
        // when the bar shows it takes over the card's rounded top corners.
        const callout    = tr ? tr.Callout : (v['Vehicle Call Out'] || '');
        const calloutBar = card.querySelector('.vehicle-callout');
        if (calloutBar) {
          if (callout) {
            setText(card, 'vehicle-callout-text', callout);
            calloutBar.style.display = '';
            const imgEl   = card.querySelector('.offer-image');
            const imgWell = imgEl ? imgEl.closest('.acs-bg-gray') : null;
            if (imgWell) imgWell.classList.remove('acs-br-tl-2', 'acs-br-tr-2');
          } else {
            calloutBar.style.display = 'none';
          }
        }

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
        const shownSlots = [];
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
            shownSlots.push({ el: cardEl, n });
            setText(card, 'offer-' + n + '-type', type);
            setText(card, 'offer-' + n + '-headline', headline);
            setText(card, 'offer-' + n + '-terms', terms);
          }
          // Disclaimer paragraph (inside the rolled-up details)
          setText(card, 'offer-' + n + '-disclaimer', disc ? (type ? type + ': ' + disc : disc) : '');
        }

        // A lone offer takes the full card width instead of sitting in a half
        // column, so long headlines stop wrapping a word per line. Two or more
        // keep the template's 50/50 columns.
        if (shownSlots.length === 1 && shownSlots[0].el) {
          const only = shownSlots[0];
          only.el.className = 'acs-twelve acs-columns acs-px-4 acs-pt-4 offer-' + only.n + '-card';
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

    // ── Spanish: static UI labels (buttons + "Disclaimer" toggles) ─────
    // Runs once after every section has rendered, so it catches labels that
    // are hardcoded in the page ("Get This Special", "Disclaimer") and the
    // vehicle Shop button label from the sheet (or its "Shop Inventory"
    // default). The disclaimer text itself is already translated per section.
    async function translateUiLabels() {
      if (!IS_ES) return;
      const nodes = [
        ...document.querySelectorAll('details > summary'),
        ...document.querySelectorAll('.car-offer a.acs-button, .car-offer .shopping-link-text'),
      ].filter(n => !n.closest('.gst-skel') && n.textContent.trim());
      if (!nodes.length) return;
      const strings = nodes.map(n => n.textContent.trim());
      const out = await translateBatch(strings);
      nodes.forEach((n, i) => { if (out[i]) n.textContent = out[i]; });
    }

    // ── Section: "Every Lease Includes" bar (static HTML, ES-translate) ─
    // The bar's copy is hardcoded in the page. On the English page there's
    // nothing to do; on the Spanish page we translate each string in place,
    // preserving the leading "✓ " checkmark on the tags (the mark shouldn't
    // round-trip through the translator).
    async function buildIncludesBar() {
      if (!IS_ES) return;

      // Translate the static "New Toyota Specials" headline (hardcoded in the
      // template, not sheet-driven, so it never enters the card/section path).
      const ntHeadline = document.querySelector('.acs-wrapper.acs-dark .acs-h1.acs-bold');
      if (ntHeadline) {
        const src = ntHeadline.textContent.replace(/\u00a0/g, ' ').trim();
        if (src) { const [t] = await translateBatch([src]); if (t) ntHeadline.textContent = t; }
      }

      // Translate the static "Interested in a specific model?" subhead. It's a
      // bare .acs-h6 with no hook, so match by its non-empty text within the
      // dark wrapper (the sibling template .acs-h6 nodes are empty until filled).
      const ntSub = [...document.querySelectorAll('.acs-wrapper.acs-dark .acs-h6')]
        .find(el => el.textContent.trim() && !el.classList.contains('tagline'));
      if (ntSub) {
        const src = ntSub.textContent.trim();
        const [t] = await translateBatch([src]); if (t) ntSub.textContent = t;
      }

      const bar = document.getElementById('gst-includes-bar');
      if (!bar) return;

      const nodes = [
        bar.querySelector('.inc-label-main'),
        bar.querySelector('.inc-label-sub'),
        ...bar.querySelectorAll('.inc-tag'),
      ].filter(Boolean);
      if (!nodes.length) return;

      // Strip a leading check + whitespace so only real words are translated
      const marks   = nodes.map(n => (n.textContent.match(/^\s*✓\s*/) || [''])[0]);
      const strings = nodes.map((n, i) => n.textContent.slice(marks[i].length).trim());

      const out = await translateBatch(strings);
      nodes.forEach((n, i) => { n.textContent = marks[i] + (out[i] || strings[i]); });
    }

    // ── Section: Event Banner (top of page) ───────────────────────────
    // One column in the sheet, three fields: Event Logo, Event Tagline and
    // Car Cuts. Either image can be left blank and the row still balances.
    async function buildEventBanner(csvText) {
      const sec = document.getElementById('gst-event-banner');
      if (!sec) return;

      const items = csvToOffers(csvText || '');
      const data  = items.find(isVisible);
      if (!data) { sec.remove(); return; }

      const logoUrl = data['Event Logo'] || '';
      const cutsUrl = data['Car Cuts']   || '';
      let   tagline = data['Event Tagline'] || '';
      if (!logoUrl && !cutsUrl && !tagline) { sec.remove(); return; }

      if (IS_ES && tagline) {
        const [t] = await translateBatch([tagline]);
        if (t) tagline = t;
      }

      const tagEl = sec.querySelector('.eb-tagline');
      if (tagEl) {
        if (tagline) tagEl.textContent = tagline;
        else tagEl.style.display = 'none';
      }

      const logo = sec.querySelector('.eb-logo');
      if (logo && logoUrl) {
        logo.src = logoUrl;
        // Logo art carries the event name, so it gets descriptive alt text
        logo.alt = data['Event Logo Alt'] || tagline || '';
        logo.style.display = '';
      }

      const cuts = sec.querySelector('.eb-cuts');
      if (cuts && cutsUrl) {
        cuts.src = cutsUrl;
        cuts.alt = ''; // vehicle cut images stay decorative
        cuts.style.display = '';
      }

      sec.style.display = '';
    }

    // ── Section: Triple Zero Banner (dynamic, from the sheet) ─────────
    // Field rows x Item columns, same shape as the other tabs. The section
    // level fields (eyebrow, title, subtitle, CTA, disclaimer) live in the
    // Item 1 column; each item column supplies Separator Before, Big Value,
    // Label and Subtext. Section hides on Visibility "hide" in Item 1, and an
    // individual stat hides on "hide" in its own column.
    async function buildTripleZeroBanner(csvText) {
      const sec = document.getElementById('triple-zero-banner');
      if (!sec) return;
      const tpl = sec.querySelector('.tz-item[data-tz]');
      if (!tpl) return;

      const items = csvToOffers(csvText || '');
      const first = items[0] || {};
      if (!items.length || (first['Visibility'] || '').trim().toLowerCase() === 'hide') {
        sec.remove();
        return;
      }

      const active = items.filter(o => isVisible(o) && (o['Big Value'] || o['Label']));
      if (!active.length) { sec.remove(); return; }

      let eyebrow  = first['Section Eyebrow']  || '';
      let title    = first['Section Title']    || '';
      let sub      = first['Section Subtitle'] || '';
      let ctaText  = first['CTA Text']         || '';
      const ctaUrl = first['CTA URL']          || '';
      let disc     = first['Disclaimer']       || '';
      let labels   = active.map(o => o['Label']   || '');
      let subtexts = active.map(o => o['Subtext'] || '');

      // Spanish: translate the words only. Big Value and Separator Before are
      // figures and symbols, so they pass through untouched.
      if (IS_ES) {
        const [head, outLabels, outSubs] = await Promise.all([
          translateBatch([eyebrow, title, sub, ctaText, disc]),
          translateBatch(labels),
          translateBatch(subtexts),
        ]);
        [eyebrow, title, sub, ctaText, disc] = head;
        labels   = outLabels;
        subtexts = outSubs;
      }

      const setOrHide = (scope, cls, val) => {
        const el = scope.querySelector('.' + cls);
        if (!el) return;
        if (val) { el.textContent = val; el.style.display = ''; }
        else { el.textContent = ''; el.style.display = 'none'; }
      };

      setOrHide(sec, 'tz-eyebrow', eyebrow);
      setOrHide(sec, 'tz-title',   title);
      setOrHide(sec, 'tz-sub',     sub);

      const parent = tpl.parentNode;
      active.forEach((o, i) => {
        const item = tpl.cloneNode(true);
        item.setAttribute('data-tz', String(i + 1));
        // Separator only ever sits between items, never before the first one.
        setOrHide(item, 'tz-sep', i === 0 ? '' : (o['Separator Before'] || ''));
        setOrHide(item, 'tz-value',   o['Big Value'] || '');
        setOrHide(item, 'tz-label',   labels[i]);
        setOrHide(item, 'tz-subtext', subtexts[i]);
        markReady(item);
        parent.insertBefore(item, tpl);
      });
      tpl.remove();

      // CTA — needs both a label and a URL to be worth showing
      const ctaWrap = sec.querySelector('.tz-cta-wrap');
      const cta     = sec.querySelector('.tz-cta');
      if (cta && ctaWrap && ctaText && ctaUrl) {
        cta.textContent = ctaText;
        cta.href = ctaUrl;
        ctaWrap.style.display = '';
      }

      // Disclaimer — only reveal the roll-up if the sheet supplies text
      if (disc) {
        const discEl = sec.querySelector('.tz-disc');
        const wrap   = sec.querySelector('.tz-disc-wrap');
        if (discEl) discEl.textContent = disc;
        if (wrap)   wrap.style.display = '';
      }

      sec.style.display = '';
    }

    // ── Section: Promo Blocks (replaces Gettel's Got It) ───────────────
    // Field rows x Item columns. Every item column is one card, carrying its
    // own eyebrow, title, subtitle, CTA and disclaimer. One visible card runs
    // full width; two sit 50/50 from tablet up. Card 1 is the light panel,
    // card 2 the black one, by position rather than by any sheet value.
    async function buildPromoBlocks(offers) {
      const sec = document.getElementById('gst-promo-blocks');
      const tpl = document.querySelector('.promo-block[data-promo]');
      if (!sec || !tpl) return;
      const parent = tpl.parentNode;

      const active = offers.filter(o => isVisible(o) && (o['Section Title'] || o['Section Subtitle'] || o['Label']));
      if (!active.length) { tpl.remove(); sec.remove(); return; }

      let eyebrows = active.map(o => o['Section Eyebrow']  || '');
      let titles   = active.map(o => o['Section Title']    || '');
      let subs     = active.map(o => o['Section Subtitle'] || '');
      let labels   = active.map(o => o['Label']            || '');
      let ctas     = active.map(o => o['CTA Text']         || '');
      let discls   = active.map(o => o['Disclaimer']       || '');

      if (IS_ES) {
        [eyebrows, titles, subs, labels, ctas, discls] = await Promise.all([
          translateBatch(eyebrows), translateBatch(titles), translateBatch(subs),
          translateBatch(labels), translateBatch(ctas), translateBatch(discls),
        ]);
      }

      // One card fills the row; two split it.
      const widths = active.length > 1 ? 'acs-twelve acs-six-md acs-columns' : 'acs-twelve acs-columns';

      active.forEach((o, i) => {
        const card = tpl.cloneNode(true);
        card.setAttribute('data-promo', String(i + 1));
        card.className = widths + ' acs-my-2 acs-flex promo-block';

        const cell = card.querySelector('.promo-cell');
        const dark = i === 1;
        if (cell) cell.classList.add(dark ? 'promo-dark' : 'promo-light');

        setText(card, 'promo-eyebrow', eyebrows[i]);
        if (eyebrows[i]) {
          const eb = card.querySelector('.promo-eyebrow');
          if (eb) eb.style.display = '';
        }
        setText(card, 'promo-title', titles[i]);
        setText(card, 'promo-sub',   subs[i]);
        setText(card, 'promo-label', labels[i]);

        const cta     = card.querySelector('.promo-cta');
        const ctaWrap = card.querySelector('.promo-cta-wrap');
        if (cta && ctaWrap && ctas[i] && o['CTA URL']) {
          cta.textContent = ctas[i];
          cta.href = o['CTA URL'];
          // Red button on the light card, white button on the black one.
          // Strip whichever base class the template ships so the two can't
          // both apply to the dark card.
          if (dark) {
            cta.classList.remove('acs-button', 'acs-button5');
            cta.classList.add('acs-button3');
          }
          ctaWrap.style.display = '';
        }

        if (discls[i]) {
          setText(card, 'promo-disc', discls[i]);
          const wrap = card.querySelector('.promo-disc-wrap');
          if (wrap) wrap.style.display = '';
        }

        markReady(card);
        parent.insertBefore(card, tpl);
      });

      tpl.remove();
      sec.style.display = '';
    }

    // ── Section: Special Programs (full 3-col width) ───────────────────
    async function buildSpecialPrograms(offers) {
      const tpl = document.querySelector('.sp-offer[data-sp]');
      if (!tpl) return;
      const parent = tpl.parentNode;
      clearSkeletonsIn(parent);
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

    // ── Section: Used / Pre-Owned Specials (framework rebuild) ─────────
    // Reads the Used tab and splits offers by "Card Type": hero | apr-card |
    // program-card. Each type clones its own template card (selector-based,
    // VV-style population). Sections with no matching offers are hidden.
    async function buildUsedSpecials(offers) {
      const active = offers.filter(o => isVisible(o) && o['Card Type']);

      const heroOffers    = active.filter(o => o['Card Type'] === 'hero');
      const aprOffers     = active.filter(o => o['Card Type'] === 'apr-card');
      const programOffers = active.filter(o => o['Card Type'] === 'program-card');

      // Helper: build a <li> list from List Item 1..3, escaped
      function listHtml(o) {
        const items = [o['List Item 1'], o['List Item 2'], o['List Item 3']].filter(Boolean);
        return items.map(li =>
          '<li>' + li.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</li>'
        ).join('');
      }

      // ── Hero cards ──
      const heroTpl = document.querySelector('.used-hero[data-hero]');
      if (heroTpl) {
        const heroParent = heroTpl.parentNode;
        if (!heroOffers.length) {
          const sec = document.getElementById('used-hero-section');
          if (sec) sec.style.display = 'none';
          heroTpl.remove();
        } else {
          heroOffers.forEach((o, i) => {
            const card = heroTpl.cloneNode(true);
            card.setAttribute('data-hero', String(i + 1));

            const link = card.querySelector('.used-hero-link');
            if (link) link.href = o['Image CTA URL'] || '/used-inventory/index.htm';
            const dSrc = card.querySelector('.used-hero-src-d');
            const mSrc = card.querySelector('.used-hero-src-m');
            const img  = card.querySelector('.used-hero-img');
            const dUrl = o['Image URL (desktop)'] || '';
            const mUrl = o['Image URL (mobile)'] || dUrl;
            if (dSrc) dSrc.srcset = dUrl;
            if (mSrc) mSrc.srcset = mUrl;
            if (img) { if (dUrl) img.src = dUrl; img.alt = o['Image Alt'] || ''; }

            setText(card, 'used-hero-num',   o['Headline / Big Number']);
            setText(card, 'used-hero-label', o['Subheading']);
            setText(card, 'used-hero-desc',  o['Description']);

            const cta = card.querySelector('.used-hero-cta');
            if (cta) {
              if (o['CTA 1 Label']) { cta.textContent = o['CTA 1 Label']; cta.href = o['CTA 1 URL'] || '#'; }
              else cta.style.display = 'none';
            }

            if (o['Disclaimer']) {
              setText(card, 'used-hero-disc', o['Disclaimer']);
              const wrap = card.querySelector('.used-hero-disc-wrap');
              if (wrap) wrap.style.display = '';
            }

            markReady(card);
            heroParent.insertBefore(card, heroTpl);
          });
          heroTpl.remove();
        }
      }

      // Merged Pre-Owned Offers section hides only if BOTH APR and program empty
      const mergedSection = document.getElementById('used-apr-section');
      if (mergedSection && !aprOffers.length && !programOffers.length) {
        mergedSection.style.display = 'none';
      }

      // ── APR / finance cards ──
      const aprTpl = document.querySelector('.used-apr[data-apr]');
      if (aprTpl) {
        const aprParent = aprTpl.parentNode;
        if (!aprOffers.length) {
          aprTpl.remove();
        } else {
          aprOffers.forEach((o, i) => {
            const card = aprTpl.cloneNode(true);
            card.setAttribute('data-apr', String(i + 1));

            setText(card, 'used-apr-num',       o['Headline / Big Number']);
            setText(card, 'used-apr-num-label', o['Subheading']);
            setText(card, 'used-apr-cardtitle', o['Description']);

            const ul = card.querySelector('.used-apr-list');
            if (ul) { const h = listHtml(o); if (h) ul.innerHTML = h; else ul.style.display = 'none'; }

            const cta1 = card.querySelector('.used-apr-cta1');
            if (cta1) { if (o['CTA 1 Label']) { cta1.textContent = o['CTA 1 Label']; cta1.href = o['CTA 1 URL'] || '#'; } else cta1.style.display = 'none'; }
            const cta2 = card.querySelector('.used-apr-cta2');
            if (cta2) { if (o['CTA 2 Label']) { cta2.textContent = o['CTA 2 Label']; cta2.href = o['CTA 2 URL'] || '#'; } else cta2.style.display = 'none'; }

            if (o['Disclaimer']) {
              setText(card, 'used-apr-disc', o['Disclaimer']);
              const wrap = card.querySelector('.used-apr-disc-wrap');
              if (wrap) wrap.style.display = '';
            }

            markReady(card);
            aprParent.insertBefore(card, aprTpl);
          });
          aprTpl.remove();
        }
      }

      // ── Program cards ──
      const progTpl = document.querySelector('.used-program[data-program]');
      if (progTpl) {
        const progParent = progTpl.parentNode;
        if (!programOffers.length) {
          progTpl.remove();
        } else {
          programOffers.forEach((o, i) => {
            const card = progTpl.cloneNode(true);
            card.setAttribute('data-program', String(i + 1));

            const img = card.querySelector('.used-program-img');
            if (img) { if (o['Image URL (desktop)']) img.src = o['Image URL (desktop)']; else img.style.display = 'none'; img.alt = o['Image Alt'] || ''; }

            setText(card, 'used-program-eyebrow', o['Subheading']);
            setText(card, 'used-program-title',   o['Headline / Big Number']);

            const ul = card.querySelector('.used-program-list');
            if (ul) { const h = listHtml(o); if (h) ul.innerHTML = h; else ul.style.display = 'none'; }

            const cta = card.querySelector('.used-program-cta');
            if (cta) { if (o['CTA 1 Label']) { cta.textContent = o['CTA 1 Label']; cta.href = o['CTA 1 URL'] || '#'; } else cta.style.display = 'none'; }

            if (o['Disclaimer']) {
              setText(card, 'used-program-disc', o['Disclaimer']);
              const wrap = card.querySelector('.used-program-disc-wrap');
              if (wrap) wrap.style.display = '';
            }

            markReady(card);
            progParent.insertBefore(card, progTpl);
          });
          progTpl.remove();
        }
      }
    }

    // ── Main ───────────────────────────────────────────────────────────
    async function init() {
      try {
        // Paint shimmer skeletons before any network work so the page never
        // shows empty card wells while the sheet loads. Builders tear down
        // their own section's skeletons as real cards are inserted.
        if (!IS_USED) renderSkeletons();

        if (IS_USED) {
          const usedCsv = await fetchTab(TABS.used);
          await buildUsedSpecials(csvToOffers(usedCsv));
        } else if (IS_399) {
          // Vehicle cards only — the $399 page carries no tz/gg/programs
          // sections, so fetching those tabs would just block the render.
          const leaseCsv = await fetchTab(TABS.leases399);
          await buildVehicleCards(csvToOffers(leaseCsv));
        } else {
          const [leaseCsv, eventCsv, tzCsv, promoCsv, programsCsv] = await Promise.all([
            fetchTab(TABS.lease),
            fetchTab(TABS.event).catch(() => ''),
            fetchTab(TABS.tz_banner).catch(() => ''),
            fetchTab(TABS.promo).catch(() => ''),
            fetchTab(TABS.programs),
          ]);

          await Promise.all([
            buildVehicleCards(csvToOffers(leaseCsv)),
            buildEventBanner(eventCsv),
            buildIncludesBar(),
            buildTripleZeroBanner(tzCsv),
            buildPromoBlocks(csvToOffers(promoCsv)),
            buildSpecialPrograms(csvToOffers(programsCsv)),
          ]);
        }

        await translateUiLabels();

        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.dispatchEvent(new CustomEvent('gst:ready'));
          if (IS_ES) document.dispatchEvent(new CustomEvent('gst:translated'));
        }));

      } catch (err) {
        console.error('[gst-offers] Error:', err.message || err);
        // Don't leave the page shimmering if the fetch failed.
        document.querySelectorAll('.gst-skel[data-skel="1"]').forEach(el => el.remove());
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

  })();
