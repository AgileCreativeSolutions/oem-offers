/**
 * sentry-ford-specials.js
 * Sentry Ford — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Usage:
 *   <div id="sf-specials" data-csv="YOUR_GOOGLE_SHEETS_CSV_URL"></div>
 *   <script src="https://AgileCreativeSolutions.github.io/oem-offers/sentry-ford-specials.js"></script>
 *
 * Visibility: blank = show | "hide" = suppress card
 */
(function () {
  'use strict';

  var ROOT_ID     = 'sf-specials';
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

  // ── Ford skeleton card ───────────────────────────────────────────────────
  // Mirrors: gradient image area → text header → divider → lease figures → button
  function skelCard() {
    return [
      '<div class="acs-twelve acs-three-2xl acs-four-xl acs-six-lg acs-columns acs-my-3">',
      '  <div class="acs-card" style="overflow:hidden;">',
      // gradient image area
      '    <div style="background:linear-gradient(0deg,#f0f0f0 40%,#e6e6e6 0%);padding:16px;text-align:center;">',
      '      <div class="acs-skel-block" style="height:160px;width:80%;margin:0 auto;border-radius:6px;"></div>',
      '    </div>',
      // content
      '    <div class="acs-p-5">',
      '      <div style="text-align:center;">',
      '        <div class="acs-skel-block" style="height:11px;width:45%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:20px;width:55%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:65%;margin:0 auto 14px;"></div>',
      '        <div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 12px;"></div>',
      '        <div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto 6px;"></div>',
      '        <div class="acs-skel-block" style="height:32px;width:50%;margin:0 auto 8px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>',
      '        <div class="acs-skel-block" style="height:10px;width:55%;margin:0 auto 16px;"></div>',
      '      </div>',
      // button
      '      <div class="acs-skel-block" style="height:44px;width:100%;border-radius:4px;margin-bottom:12px;"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function showSkeletons(root) {
    injectSkeletonStyles();
    var wrapper = document.createElement('div');
    wrapper.className = 'acs-skel-wrapper acs-row acs-justify-content-center';
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

  // ── Build one Ford card ──────────────────────────────────────────────────
  function buildCard(o) {
    var year       = esc(o['Year']               || '');
    var model      = esc(o['Model']              || '');
    var trim       = esc(o['Trim / Package']     || '');
    var imgSrc     =     o['Image URL']          || '';
    var stock      = esc(o['Stock #']            || '');
    var vin        = esc(o['VIN']               || '');
    var leasePay   = esc(o['Lease Payment']      || '');
    var leaseTerm  = esc(o['Lease Term']         || '');
    var leaseMiles = esc(o['Lease Miles']        || '');
    var leaseDue   = esc(o['Lease Due at Signing'] || '');
    var ctaLabel   = esc(o['CTA Label']          || 'Shop Now');
    var ctaURL     =     o['CTA URL']            || '#';
    var disclaimer = esc(o['Disclaimer']         || '');

    var stockParts = [];
    if (stock) stockParts.push('Stock #' + stock);
    if (vin)   stockParts.push('VIN: ' + vin);
    var stockLine = stockParts.length
      ? '<p class="acs-text-4">' + stockParts.join(' | ') + '</p><hr>'
      : '';

    var modelLine = trim
      ? '<h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>'
        + '<p class="acs-text-5">' + trim + '</p>'
      : '<h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>';

    var disclaimerHTML = disclaimer ? [
      '<hr>',
      '<div class="acs-row">',
      '  <div class="acs-twelve acs-text-center acs-lh-5">',
      '    <button class="acs-accordion"></button>',
      '    <div class="acs-panel"><p class="acs-text-3 acs-lh-5 acs-opacity-50">' + disclaimer + '</p></div>',
      '  </div>',
      '</div>'
    ].join('') : '';

    return [
      '<div class="acs-twelve acs-three-2xl acs-four-xl acs-six-lg acs-columns acs-my-3">',
      '  <div class="acs-card">',
      '    <div class="acs-gradient acs-text-center acs-pt-3">',
      '      <img src="' + imgSrc + '" class="acs-img-full-width acs-ma acs-car-cut" alt="' + year + ' Ford ' + model + '">',
      '    </div>',
      '    <div class="acs-p-5">',
      '      <div class="acs-text-center">',
      '        <p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' FORD</p>',
      modelLine,
      stockLine,
      '        <div class="acs-row acs-justify-content-center">',
      '          <div class="acs-ten-lg acs-columns">',
      '            <p class="acs-bold">Lease for:</p>',
      '            <h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent acs-bold">' + leasePay + '</span>/mo*</h3>',
      (leaseTerm || leaseMiles) ? '            <p class="acs-text-5 acs-lh-4">' + leaseTerm + ' Months | ' + leaseMiles + ' miles/year</p>' : '',
      leaseDue ? '            <p class="acs-text-4 acs-lh-4 acs-mb-2">' + leaseDue + ' Due at Signing + Taxes &amp; fees</p>' : '',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div class="acs-row acs-mt-5">',
      '        <div class="acs-twelve acs-columns">',
      '          <a href="' + ctaURL + '" class="acs-button acs-button-margin acs-button-fw">' + ctaLabel + '</a>',
      '        </div>',
      '      </div>',
      disclaimerHTML,
      '    </div>',
      '  </div>',
      '</div>'
    ].filter(Boolean).join('\n');
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
    if (!csvURL) { console.error('[sentry-ford-specials] Missing data-csv on #' + ROOT_ID); return; }

    showSkeletons(root);

    fetchCSV(csvURL)
      .then(function (text) {
        var offers = csvToOffers(text);
        var cards  = offers
          .filter(function (o) { return !isHidden(o['Visibility']); })
          .map(buildCard)
          .join('\n');

        hideSkeletons(root);

        var wrapper = document.createElement('div');
        wrapper.className = 'acs-row acs-justify-content-center';
        wrapper.innerHTML = cards;
        root.appendChild(wrapper);
        initAccordions(root);
      })
      .catch(function (err) {
        console.error('[sentry-ford-specials]', err);
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
