/**
 * sentry-mazda-specials.js
 * Sentry Mazda — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Usage:
 *   <div id="sm-specials" data-csv="YOUR_GOOGLE_SHEETS_CSV_URL"></div>
 *   <script src="https://AgileCreativeSolutions.github.io/oem-offers/sentry-mazda-specials.js"></script>
 *
 * Visibility controls:
 *   Visibility   — blank = show | "hide" = suppress card entirely
 *   Hide Finance — blank = show | "hide" = suppress Finance block
 *   Hide Lease   — blank = show | "hide" = suppress Lease block
 *   Sale Price   — blank = hide Sale Price block automatically
 */
(function () {
  'use strict';

  var ROOT_ID      = 'sm-specials';
  var SKEL_COUNT   = 3;   // skeleton cards shown while loading
  var SKEL_CSS_ID  = 'acs-skel-styles';

  // ── Skeleton CSS (injected once, shared across all three dealer scripts) ──
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

  // ── Mazda skeleton card ──────────────────────────────────────────────────
  // Mirrors: header text → full-width image → divider → price blocks → button
  function skelCard() {
    return [
      '<div class="acs-six-md acs-four-xl acs-four-3xl acs-columns acs-my-3">',
      '  <div class="acs-offer-cell" style="overflow:hidden;">',
      // header area
      '    <div class="acs-p-5 acs-text-center">',
      '      <div class="acs-skel-block" style="height:12px;width:60%;margin:0 auto 8px;"></div>',
      '      <div class="acs-skel-block" style="height:20px;width:50%;margin:0 auto 6px;"></div>',
      '      <div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto;"></div>',
      '    </div>',
      // image
      '    <div class="acs-skel-block" style="width:100%;height:200px;border-radius:0;"></div>',
      // content
      '    <div class="acs-p-5">',
      '      <div class="acs-skel-block" style="height:10px;width:85%;margin:0 auto 8px;"></div>',
      '      <div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 14px;"></div>',
      '      <div class="acs-skel-block" style="height:12px;width:40%;margin:0 auto 6px;"></div>',
      '      <div class="acs-skel-block" style="height:30px;width:55%;margin:0 auto 10px;"></div>',
      '      <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;">',
      '        <div style="flex:1;">',
      '          <div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>',
      '          <div class="acs-skel-block" style="height:28px;width:70%;margin:0 auto 6px;"></div>',
      '          <div class="acs-skel-block" style="height:9px;width:80%;margin:0 auto;"></div>',
      '        </div>',
      '        <div style="flex:1;">',
      '          <div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>',
      '          <div class="acs-skel-block" style="height:28px;width:70%;margin:0 auto 6px;"></div>',
      '          <div class="acs-skel-block" style="height:9px;width:80%;margin:0 auto;"></div>',
      '        </div>',
      '      </div>',
      '    </div>',
      // button
      '    <div class="acs-row acs-bg-white" style="padding:0 16px 16px;">',
      '      <div class="acs-skel-block" style="height:44px;width:100%;border-radius:4px;"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  // ── Show skeletons immediately ───────────────────────────────────────────
  function showSkeletons(root) {
    injectSkeletonStyles();
    var wrapper = document.createElement('div');
    wrapper.className = 'acs-skel-wrapper acs-row acs-text-center';
    for (var i = 0; i < SKEL_COUNT; i++) wrapper.innerHTML += skelCard();
    root.appendChild(wrapper);
    return wrapper;
  }

  // ── Remove skeletons ─────────────────────────────────────────────────────
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

  // ── CSV line splitter ────────────────────────────────────────────────────
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

  // ── GMCD-style CSV → offers array ───────────────────────────────────────
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

  // ── Build one specials card ──────────────────────────────────────────────
  function buildCard(o) {
    var year        = esc(o['Year']            || '');
    var model       = esc(o['Model']           || '');
    var trim        = esc(o['Trim / Package']  || '');
    var imgSrc      =     o['Image URL']       || '';
    var stock       = esc(o['Stock #']         || '');
    var vin         = esc(o['VIN']             || '');
    var msrp        = esc(o['MSRP']            || '');
    var salePrice   = esc(o['Sale Price']      || '');
    var saleNote    = esc(o['Sale Price Note'] || '');
    var finAPR      = esc(o['Finance APR']     || '');
    var finTerm     = esc(o['Finance Term']    || '');
    var finAlt      = esc(o['Finance Alt APR'] || '');
    var finNote     = esc(o['Finance Note']    || '');
    var leasePay    = esc(o['Lease Payment']   || '');
    var leaseTerm   = esc(o['Lease Term']      || '');
    var leaseMiles  = esc(o['Lease Miles']     || '');
    var leaseDown   = esc(o['Lease Down']      || '');
    var ctaURL      =     o['Shop Now URL']    || '#';
    var disclaimer  = esc(o['Disclaimer']      || '');

    var showFinance  = !isHidden(o['Hide Finance']);
    var showLease    = !isHidden(o['Hide Lease']);
    var hasSalePrice = salePrice !== '';

    var stockLine = '';
    if (stock || vin || msrp) {
      var parts = [];
      if (stock) parts.push('Stock #' + stock);
      if (vin)   parts.push('VIN: ' + vin);
      if (msrp)  parts.push('MSRP: ' + msrp);
      stockLine = '<p class="acs-lh-4 acs-text-4 acs-opacity-80">' + parts.join(' | ') + '</p><hr>';
    }

    var salePriceHTML = '';
    if (hasSalePrice) {
      salePriceHTML = [
        '<p class="acs-text-5 acs-lh-4 acs-mb-2 acs-bold">Sale Price</p>',
        '<h3 class="acs-h6 acs-mb-2 acs-bold">',
        '  <span class="acs-h3 acs-accent2 acs-bold"><sup>$</sup>' + salePrice.replace(/^\$/, '') + '</span>',
        '</h3>',
        saleNote ? '<p class="acs-lh-4 acs-mb-5 acs-opacity-60 acs-italic acs-text-4">' + saleNote + '</p>' : ''
      ].join('');
    }

    var financeHTML = '';
    if (showFinance && finAPR) {
      financeHTML = [
        '<div class="acs-six-xl acs-columns">',
        '  <p class="acs-bold">Finance:</p>',
        '  <h3 class="acs-h6 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + finAPR + '</span> APR*</h3>',
        finTerm ? '  <p class="acs-text-7 acs-lh-4 acs-mb-1">for ' + finTerm + ' months</p>' : '',
        finAlt  ? '  <p class="acs-lh-4 acs-mb-0 acs-opacity-90 acs-italic acs-text-4">' + finAlt + '</p>' : '',
        finNote ? '  <p class="acs-lh-4 acs-mb-5 acs-opacity-80 acs-italic acs-text-4">' + finNote + '</p>' : '',
        '</div>'
      ].join('');
    }

    var leaseHTML = '';
    if (showLease && leasePay) {
      leaseHTML = [
        '<div class="acs-six-lg acs-columns">',
        '  <p class="acs-bold">Lease:</p>',
        '  <h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + leasePay + '</span>/mo*</h3>',
        (leaseTerm || leaseMiles) ? '  <p class="acs-text-5 acs-lh-4 acs-mb-1">' + leaseTerm + ' months | ' + leaseMiles + ' mi/yr</p>' : '',
        leaseDown ? '  <p class="acs-text-3 acs-lh-4 acs-mb-1">' + leaseDown + ' Down</p>' : '',
        '</div>'
      ].join('');
    }

    var offersRowHTML = (financeHTML || leaseHTML)
      ? '<div class="acs-row acs-justify-content-center">' + financeHTML + leaseHTML + '</div>'
      : '';

    var disclaimerHTML = '';
    if (disclaimer) {
      disclaimerHTML = [
        '<div class="acs-row acs-pb-4 acs-bg-white acs-disclaimer-box">',
        '  <div class="acs-twelve">',
        '    <button class="acs-accordion acs-opacity-40"></button>',
        '    <div class="acs-disclaimer acs-text-3 acs-lh-8 acs-px-5"><p>' + disclaimer + '</p></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="acs-six-md acs-four-xl acs-four-3xl acs-columns acs-my-3">',
      '  <div class="acs-offer-cell">',
      '    <div class="acs-p-5 acs-text-center">',
      '      <p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' MAZDA</p>',
      '      <h2 class="acs-h5 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>',
      trim ? '      <p>' + trim + '</p>' : '',
      '    </div>',
      '    <img alt="' + year + ' MAZDA ' + model + '" src="' + imgSrc + '" class="acs-img-full-width acs-offer-img">',
      '    <div class="acs-p-5"><div class="acs-text-center">',
      stockLine, salePriceHTML, offersRowHTML,
      '    </div></div>',
      '    <div class="acs-row acs-bg-white"><div class="acs-twelve acs-px-4">',
      '      <a href="' + ctaURL + '" class="acs-button acs-button-fw acs-button-margin">Shop Now</a>',
      '    </div></div>',
      disclaimerHTML,
      '  </div>',
      '</div>'
    ].filter(Boolean).join('\n');
  }

  // ── Wire accordion ───────────────────────────────────────────────────────
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
    if (!csvURL) { console.error('[sentry-mazda-specials] Missing data-csv on #' + ROOT_ID); return; }

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
        wrapper.className = 'acs-row acs-text-center';
        wrapper.innerHTML = cards;
        root.appendChild(wrapper);
        initAccordions(root);
      })
      .catch(function (err) {
        console.error('[sentry-mazda-specials]', err);
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
