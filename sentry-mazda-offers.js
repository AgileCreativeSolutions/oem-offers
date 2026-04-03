/**
 * sentry-mazda-specials.js
 * Sentry Mazda — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Spreadsheet: fields as rows, offers as columns (GMCD-style).
 * Each card supports up to 4 generic offer blocks in a 2×2 grid.
 *
 * Offer block fields (N = 1–4):
 *   Hide Offer N   — blank = show | "hide" = suppress block
 *   Offer N Label  — e.g. "Lease for:"
 *   Offer N Value  — e.g. "$255/mo*"
 *   Offer N Detail 1 / Detail 2 — supporting lines
 *
 * Card visibility:
 *   Visibility — blank = show | "hide" = suppress card entirely
 */
(function () {
  'use strict';

  var ROOT_ID     = 'sm-specials';
  var SKEL_COUNT  = 3;
  var SKEL_CSS_ID = 'acs-skel-styles';

  function injectSkeletonStyles() {
    if (document.getElementById(SKEL_CSS_ID)) return;
    var s = document.createElement('style');
    s.id = SKEL_CSS_ID;
    s.textContent = [
      '@keyframes acs-shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}',
      '.acs-skel-block{background:linear-gradient(90deg,#ececec 25%,#f5f5f5 50%,#ececec 75%);',
      'background-size:600px 100%;animation:acs-shimmer 1.4s infinite linear;border-radius:4px;}'
    ].join('');
    (document.head || document.body).appendChild(s);
  }

  function skelCard() {
    return '<div class="acs-six-md acs-four-xl acs-four-3xl acs-columns acs-my-3">'
      + '<div class="acs-offer-cell" style="overflow:hidden;">'
      + '<div class="acs-p-5 acs-text-center">'
      + '<div class="acs-skel-block" style="height:12px;width:60%;margin:0 auto 8px;"></div>'
      + '<div class="acs-skel-block" style="height:20px;width:50%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto;"></div>'
      + '</div>'
      + '<div class="acs-skel-block" style="width:100%;height:200px;border-radius:0;"></div>'
      + '<div class="acs-p-5">'
      + '<div class="acs-skel-block" style="height:10px;width:85%;margin:0 auto 8px;"></div>'
      + '<div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 14px;"></div>'
      + '<div style="display:flex;gap:12px;">'
      + '<div style="flex:1;"><div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:28px;width:70%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:9px;width:80%;margin:0 auto;"></div></div>'
      + '<div style="flex:1;"><div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:28px;width:70%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:9px;width:80%;margin:0 auto;"></div></div>'
      + '</div></div>'
      + '<div class="acs-row acs-bg-white" style="padding:0 16px 16px;">'
      + '<div class="acs-skel-block" style="height:44px;width:100%;border-radius:4px;"></div>'
      + '</div></div></div>';
  }

  function showSkeletons(root) {
    injectSkeletonStyles();
    var w = document.createElement('div');
    w.className = 'acs-skel-wrapper acs-row acs-text-center';
    for (var i = 0; i < SKEL_COUNT; i++) w.innerHTML += skelCard();
    root.appendChild(w);
  }

  function hideSkeletons(root) {
    var s = root.querySelector('.acs-skel-wrapper');
    if (s) s.parentNode.removeChild(s);
  }

  function fetchCSV(url) {
    return fetch(url + '&t=' + Date.now(), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
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
    var numOffers = 0;
    for (var s = 0; s < lines.length; s++) {
      if (!lines[s].trim()) continue;
      var w = splitLine(lines[s]).length - 1;
      if (w > numOffers) numOffers = w;
    }
    var offers = [];
    for (var v = 0; v < numOffers; v++) offers.push({});
    for (var r = 2; r < lines.length; r++) {
      if (!lines[r].trim()) continue;
      var cols = splitLine(lines[r]);
      var field = (cols[0] || '').trim().replace(/\s*\[.*?\]\s*$/, '').trim();
      if (!field || field.charAt(0) === '\u2014') continue;
      for (var v = 0; v < numOffers; v++) {
        offers[v][field] = (cols[v + 1] || '').trim();
      }
    }
    return offers;
  }

  function isHidden(val) { return (val || '').trim().toLowerCase() === 'hide'; }

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Build one offer block ─────────────────────────────────────────────
  function buildOfferBlock(o, n) {
    if (isHidden(o['Hide Offer ' + n])) return '';
    var label = esc(o['Offer ' + n + ' Label']    || '');
    var value = esc(o['Offer ' + n + ' Value']    || '');
    var d1    = esc(o['Offer ' + n + ' Detail 1'] || '');
    var d2    = esc(o['Offer ' + n + ' Detail 2'] || '');
    if (!label && !value) return '';
    return '<div class="acs-offer-block acs-six-lg acs-columns" style="padding:8px 4px;">'
      + (label ? '<p class="acs-bold acs-text-6">' + label + '</p>' : '')
      + (value ? '<p class="acs-h5 acs-accent2 acs-bold" style="margin:2px 0 4px;">' + value + '</p>' : '')
      + (d1    ? '<p class="acs-text-5 acs-lh-4">' + d1 + '</p>' : '')
      + (d2    ? '<p class="acs-text-4 acs-lh-4 acs-opacity-80">' + d2 + '</p>' : '')
      + '</div>';
  }

  function buildCard(o) {
    var year       = esc(o['Year']            || '');
    var model      = esc(o['Model']           || '');
    var trim       = esc(o['Trim / Package']  || '');
    var imgSrc     =     o['Image URL']       || '';
    var stock      = esc(o['Stock #']         || '');
    var vin        = esc(o['VIN']             || '');
    var msrp       = esc(o['MSRP']            || '');
    var salePrice  = esc(o['Sale Price']      || '');
    var saleNote   = esc(o['Sale Price Note'] || '');
    var ctaURL     =     o['Shop Now URL']    || '#';
    var disclaimer = esc(o['Disclaimer']      || '');

    var stockLine = '';
    if (stock || vin || msrp) {
      var parts = [];
      if (stock) parts.push('Stock #' + stock);
      if (vin)   parts.push('VIN: ' + vin);
      if (msrp)  parts.push('MSRP: ' + msrp);
      stockLine = '<p class="acs-lh-4 acs-text-4 acs-opacity-80">' + parts.join(' | ') + '</p><hr>';
    }

    var salePriceHTML = '';
    if (salePrice) {
      salePriceHTML = '<p class="acs-text-5 acs-lh-4 acs-mb-2 acs-bold">Sale Price</p>'
        + '<p class="acs-h5 acs-accent2 acs-bold" style="margin-bottom:4px;">' + salePrice + '</p>'
        + (saleNote ? '<p class="acs-lh-4 acs-mb-4 acs-opacity-60 acs-italic acs-text-4">' + saleNote + '</p>' : '');
    }

    // 2×2 grid of offer blocks
    var blocks = [1, 2, 3, 4].map(function (n) { return buildOfferBlock(o, n); });
    var hasOffers = blocks.some(function (b) { return b !== ''; });
    var offersHTML = hasOffers
      ? '<div class="acs-row acs-justify-content-center" style="margin-top:8px;">' + blocks.join('') + '</div>'
      : '';

    var disclaimerHTML = disclaimer
      ? '<div class="acs-row acs-pb-4 acs-px-4 acs-bg-white">'
        + '<p style="font-size:12px;line-height:15px;color:#444;margin:0;">' + disclaimer + '</p>'
        + '</div>'
      : '';

    return '<div class="acs-six-md acs-four-xl acs-four-3xl acs-columns acs-my-3">'
      + '<div class="acs-offer-cell">'
      + '<div class="acs-p-5 acs-text-center">'
      + '<p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' MAZDA</p>'
      + '<h2 class="acs-h5 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>'
      + (trim ? '<p>' + trim + '</p>' : '')
      + '</div>'
      + '<img alt="' + year + ' MAZDA ' + model + '" src="' + imgSrc + '" class="acs-img-full-width acs-offer-img">'
      + '<div class="acs-p-5"><div class="acs-text-center">'
      + stockLine + salePriceHTML + offersHTML
      + '</div></div>'
      + '<div class="acs-row acs-bg-white"><div class="acs-twelve acs-px-4">'
      + '<a href="' + ctaURL + '" class="acs-button acs-button-fw acs-button-margin">Shop Now</a>'
      + '</div></div>'
      + disclaimerHTML
      + '</div></div>';
  }

  function initAccordions(container) {
    var btns = container.querySelectorAll('.acs-accordion');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        this.classList.toggle('active');
        var p = this.nextElementSibling;
        if (p) p.style.maxHeight = p.style.maxHeight ? null : p.scrollHeight + 'px';
      };
    }
  }

  function init() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var csvURL = root.getAttribute('data-csv');
    if (!csvURL) { console.error('[sentry-mazda-specials] Missing data-csv'); return; }

    showSkeletons(root);

    fetchCSV(csvURL)
      .then(function (text) {
        var offers = csvToOffers(text);
        var cards  = offers
          .filter(function (o) { return !isHidden(o['Visibility']); })
          .map(buildCard).join('');

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
  } else { init(); }

})();
