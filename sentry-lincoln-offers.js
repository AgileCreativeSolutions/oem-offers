/**
 * sentry-lincoln-specials.js
 * Sentry Lincoln — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Usage:
 *   <div id="sl-specials" data-csv="YOUR_GOOGLE_SHEETS_CSV_URL"></div>
 *   <script src="https://AgileCreativeSolutions.github.io/oem-offers/sentry-lincoln-specials.js"></script>
 *
 * Visibility: blank = show | "hide" = suppress card
 * Anchor nav links are built dynamically from the Anchor ID + Model fields in the sheet.
 */
(function () {
  'use strict';

  var ROOT_ID     = 'sl-specials';
  var NAV_ID      = 'sl-anchor-nav';
  var SKEL_COUNT  = 3;
  var SKEL_CSS_ID = 'acs-skel-styles';

  // ── Skeleton CSS (injected once, shared) ─────────────────────────────────
  function injectSkeletonStyles() {
    if (document.getElementById(SKEL_CSS_ID)) return;
    var s = document.createElement('style');
    s.id = SKEL_CSS_ID;
    s.textContent = [
      '@keyframes acs-shimmer {',
      '  0%   { background-position: -600px 0; }',
      '  100% { background-position:  600px 0; }',
      '}',
      '.acs-skel-block {',
      '  background: linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%);',
      '  background-size: 600px 100%;',
      '  animation: acs-shimmer 1.4s infinite linear;',
      '  border-radius: 4px;',
      '}'
    ].join('\n');
    (document.head || document.body).appendChild(s);
  }

  // ── Lincoln skeleton card ────────────────────────────────────────────────
  // Mirrors: tall full-bleed image → text header → divider → lease figures → button
  function skelCard() {
    return [
      '<div class="acs-six-md acs-four-xl acs-three-2xl acs-columns acs-my-3">',
      '  <div class="acs-offer-cell" style="overflow:hidden;">',
      // full-bleed image — taller to match object-fit cover height
      '    <div class="acs-skel-block" style="width:100%;height:21rem;border-radius:10px 10px 0 0;"></div>',
      // text content
      '    <div class="acs-py-5 acs-px-2">',
      '      <div style="text-align:center;">',
      '        <div class="acs-skel-block" style="height:11px;width:45%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:22px;width:55%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:65%;margin:0 auto 14px;"></div>',
      '        <div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 12px;"></div>',
      '        <div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto 6px;"></div>',
      '        <div class="acs-skel-block" style="height:34px;width:50%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:55%;margin:0 auto 10px;"></div>',
      '      </div>',
      '    </div>',
      // button
      '    <div class="acs-row acs-bg-white" style="padding:0 16px 16px;">',
      '      <div class="acs-skel-block" style="height:52px;width:100%;border-radius:4px;"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function showSkeletons(root) {
    injectSkeletonStyles();
    var wrapper = document.createElement('div');
    wrapper.className = 'acs-skel-wrapper acs-row acs-text-center acs-justify-content-center';
    for (var i = 0; i < SKEL_COUNT; i++) wrapper.innerHTML += skelCard();
    root.appendChild(wrapper);
    return wrapper;
  }

  function hideSkeletons(root) {
    var skel = root.querySelector('.acs-skel-wrapper');
    if (skel) skel.parentNode.removeChild(skel);
  }

  // ── CSV fetcher ──────────────────────────────────────────────────────────
  function fetchCSV(url) {
    return fetch(url + '&t=' + Date.now(), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('CSV fetch failed: ' + r.status);
        return r.text();
      });
  }

  function splitLine(line) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function csvToOffers(text) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 3) return [];
    // Scan all rows for the widest one — Google Sheets CSV can truncate
    // individual rows to their last non-empty cell, so row 2 alone may
    // undercount if most content lives in only a few columns.
    var numOffers = 0;
    for (var _s = 0; _s < lines.length; _s++) {
      if (!lines[_s].trim()) continue;
      var _w = splitLine(lines[_s]).length - 1;
      if (_w > numOffers) numOffers = _w;
    }
    var offers    = [];
    for (var v = 0; v < numOffers; v++) offers.push({});
    for (var r = 2; r < lines.length; r++) {
      var raw = lines[r];
      if (!raw.trim()) continue;
      var cols      = splitLine(raw);
      var fieldName = (cols[0] || '').trim().replace(/\s*\[.*?\]\s*$/, '').trim();
      if (!fieldName) continue;
      // Skip section header rows (merged cells that start with — )
      if (fieldName.charAt(0) === '—') continue;
      for (var v = 0; v < numOffers; v++) {
        offers[v][fieldName] = (cols[v + 1] || '').trim();
      }
    }
    return offers;
  }

  function isHidden(val) { return (val || '').trim().toLowerCase() === 'hide'; }

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Build one Lincoln card ───────────────────────────────────────────────
  function buildCard(o) {
    var anchorId   =     o['Anchor ID']            || '';
    var year       = esc(o['Year']                 || '');
    var model      = esc(o['Model']                || '');
    var trim       = esc(o['Trim / Package']       || '');
    var imgSrc     =     o['Image URL']            || '';
    var stock      = esc(o['Stock #']              || '');
    var vin        = esc(o['VIN']                 || '');
    var leasePay   = esc(o['Lease Payment']        || '');
    var leaseTerm  = esc(o['Lease Term']           || '');
    var leaseMiles = esc(o['Lease Miles']          || '');
    var leaseDue   = esc(o['Lease Due at Signing'] || '');
    var ctaLabel   = esc(o['CTA Label']            || 'Shop Now');
    var ctaURL     =     o['CTA URL']              || '#';
    var disclaimer = esc(o['Disclaimer']           || '');

    var idAttr  = anchorId ? ' id="' + anchorId.toLowerCase().replace(/\s+/g, '-') + '"' : '';
    var trimLine = trim ? '<p class="acs-text-5">' + trim + '</p>' : '';

    var stockParts = [];
    if (stock) stockParts.push('Stock #' + stock);
    if (vin)   stockParts.push('VIN: ' + vin);
    var stockLine = stockParts.length
      ? '<p class="acs-text-5">' + stockParts.join(' | ') + '</p><hr>'
      : '';

    var disclaimerHTML = disclaimer ? [
      '<div class="acs-row acs-pb-4 acs-bg-white acs-disclaimer-box">',
      '  <div class="acs-twelve">',
      '    <button class="acs-accordion acs-opacity-40"></button>',
      '    <div class="acs-disclaimer acs-text-3 acs-lh-8 acs-px-5"><p>' + disclaimer + '</p></div>',
      '  </div>',
      '</div>'
    ].join('') : '';

    return [
      '<div' + idAttr + ' class="acs-six-md acs-four-xl acs-three-2xl acs-columns acs-my-3">',
      '  <div class="acs-offer-cell">',
      '    <img alt="' + year + ' Lincoln ' + model + '" src="' + imgSrc + '" class="acs-img-full-width acs-offer-img">',
      '    <div class="acs-py-5 acs-px-2"><div class="acs-text-center">',
      '      <p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' LINCOLN</p>',
      '      <h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>',
      trimLine,
      stockLine,
      '      <div class="acs-row acs-justify-content-center">',
      '        <div class="acs-ten-lg acs-columns">',
      '          <p class="acs-bold">Lease for:</p>',
      '          <h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + leasePay + '</span>/mo*</h3>',
      (leaseTerm || leaseMiles) ? '          <p class="acs-text-5 acs-lh-4 acs-mb-2">' + leaseTerm + ' Months | ' + leaseMiles + ' miles/year</p>' : '',
      leaseDue ? '          <p class="acs-text-5 acs-lh-4 acs-mb-2">' + leaseDue + ' due at signing</p>' : '',
      '        </div>',
      '      </div>',
      '    </div></div>',
      '    <div class="acs-row acs-bg-white"><div class="acs-twelve acs-px-4">',
      '      <a href="' + ctaURL + '" class="acs-button3 acs-button-fw acs-button-margin">' + ctaLabel + '</a>',
      '    </div></div>',
      disclaimerHTML,
      '  </div>',
      '</div>'
    ].filter(Boolean).join('\n');
  }

  // ── Build anchor nav from visible offers ────────────────────────────────
  function buildNav(offers) {
    var nav = document.getElementById(NAV_ID);
    if (!nav) return;

    var visible = offers.filter(function (o) {
      return !isHidden(o['Visibility']) && o['Anchor ID'] && o['Model'];
    });

    nav.innerHTML = visible.map(function (o, i) {
      var id    = o['Anchor ID'].toLowerCase().replace(/\s+/g, '-');
      var label = esc(o['Model']);
      var sep   = i < visible.length - 1 ? ' | ' : '';
      return '<a href="#' + id + '" class="acs-link-accent">' + label + '</a>' + sep;
    }).join('');
  }

  function initAccordions(container) {
    var btns = container.querySelectorAll('.acs-accordion');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        this.classList.toggle('active');
        var panel = this.nextElementSibling;
        if (panel) panel.style.maxHeight = panel.style.maxHeight ? null : panel.scrollHeight + 'px';
      };
    }
  }

  // ── Main ────────────────────────────────────────────────────────────────
  function init() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var csvURL = root.getAttribute('data-csv');
    if (!csvURL) { console.error('[sentry-lincoln-specials] Missing data-csv on #' + ROOT_ID); return; }

    showSkeletons(root);

    fetchCSV(csvURL)
      .then(function (text) {
        var offers = csvToOffers(text);
        var cards  = offers
          .filter(function (o) { return !isHidden(o['Visibility']); })
          .map(buildCard)
          .join('\n');

        hideSkeletons(root);
        buildNav(offers);

        var wrapper = document.createElement('div');
        wrapper.className = 'acs-row acs-text-center acs-justify-content-center';
        wrapper.innerHTML = cards;
        root.appendChild(wrapper);
        initAccordions(root);
      })
      .catch(function (err) {
        console.error('[sentry-lincoln-specials]', err);
        hideSkeletons(root);
        root.innerHTML = '<p style="padding:20px;color:#888;font-size:12px;">Specials are currently being updated. Please check back shortly.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
