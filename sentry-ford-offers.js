/**
 * sentry-ford-specials.js
 * Sentry Ford — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Each card supports up to 4 generic offer blocks stacked vertically.
 *
 * Offer block fields (N = 1–4):
 *   Hide Offer N   — blank = show | "hide" = suppress block
 *   Offer N Label  — e.g. "Lease for:"
 *   Offer N Value  — e.g. "$348/mo*"
 *   Offer N Detail 1 / Detail 2 — supporting lines
 *
 * Card visibility:
 *   Visibility — blank = show | "hide" = suppress card entirely
 */
(function () {
  'use strict';

  var ROOT_ID     = 'sf-specials';
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
    return '<div class="acs-twelve acs-three-2xl acs-four-xl acs-six-lg acs-columns acs-my-3">'
      + '<div class="acs-card" style="overflow:hidden;">'
      + '<div style="background:linear-gradient(0deg,#f0f0f0 40%,#e6e6e6 0%);padding:16px;text-align:center;">'
      + '<div class="acs-skel-block" style="height:160px;width:80%;margin:0 auto;border-radius:6px;"></div>'
      + '</div>'
      + '<div class="acs-p-5"><div style="text-align:center;">'
      + '<div class="acs-skel-block" style="height:11px;width:45%;margin:0 auto 8px;"></div>'
      + '<div class="acs-skel-block" style="height:20px;width:55%;margin:0 auto 12px;"></div>'
      + '<div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 12px;"></div>'
      + '<div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:28px;width:50%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 16px;"></div>'
      + '</div>'
      + '<div class="acs-skel-block" style="height:44px;width:100%;border-radius:4px;margin-bottom:12px;"></div>'
      + '</div></div></div>';
  }

  function showSkeletons(root) {
    injectSkeletonStyles();
    var w = document.createElement('div');
    w.className = 'acs-skel-wrapper acs-row acs-justify-content-center';
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

  // ── Build one offer block (vertical) ─────────────────────────────────
  function buildOfferBlock(o, n) {
    if (isHidden(o['Hide Offer ' + n])) return '';
    var label = esc(o['Offer ' + n + ' Label']    || '');
    var value = esc(o['Offer ' + n + ' Value']    || '');
    var d1    = esc(o['Offer ' + n + ' Detail 1'] || '');
    var d2    = esc(o['Offer ' + n + ' Detail 2'] || '');
    if (!label && !value) return '';
    return '<div style="margin-bottom:14px;">'
      + (label ? '<p class="acs-bold">' + label + '</p>' : '')
      + (value ? '<h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent acs-bold">' + value + '</span></h3>' : '')
      + (d1    ? '<p class="acs-text-5 acs-lh-4">' + d1 + '</p>' : '')
      + (d2    ? '<p class="acs-text-4 acs-lh-4 acs-mb-2">' + d2 + '</p>' : '')
      + '</div>';
  }

  function buildCard(o) {
    var year       = esc(o['Year']           || '');
    var model      = esc(o['Model']          || '');
    var trim       = esc(o['Trim / Package'] || '');
    var imgSrc     =     o['Image URL']      || '';
    var stock      = esc(o['Stock #']        || '');
    var vin        = esc(o['VIN']            || '');
    var ctaLabel   = esc(o['CTA Label']      || 'Shop Now');
    var ctaURL     =     o['CTA URL']        || '#';
    var disclaimer = esc(o['Disclaimer']     || '');

    var stockParts = [];
    if (stock) stockParts.push('Stock #' + stock);
    if (vin)   stockParts.push('VIN: ' + vin);
    var stockLine = stockParts.length
      ? '<p class="acs-text-4">' + stockParts.join(' | ') + '</p><hr>'
      : '';

    var modelLine = trim
      ? '<h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2><p class="acs-text-5">' + trim + '</p>'
      : '<h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>';

    var blocks = [1, 2, 3, 4].map(function (n) { return buildOfferBlock(o, n); }).join('');

    var disclaimerHTML = disclaimer
      ? '<hr><div class="acs-row"><div class="acs-twelve acs-text-center acs-lh-5">'
        + '<button class="acs-accordion"></button>'
        + '<div class="acs-panel"><p class="acs-text-3 acs-lh-5 acs-opacity-50">' + disclaimer + '</p></div>'
        + '</div></div>'
      : '';

    return '<div class="acs-twelve acs-three-2xl acs-four-xl acs-six-lg acs-columns acs-my-3">'
      + '<div class="acs-card">'
      + '<div class="acs-gradient acs-text-center acs-pt-3">'
      + '<img src="' + imgSrc + '" class="acs-img-full-width acs-ma acs-car-cut" alt="' + year + ' Ford ' + model + '">'
      + '</div>'
      + '<div class="acs-p-5"><div class="acs-text-center">'
      + '<p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' FORD</p>'
      + modelLine + stockLine
      + '</div>'
      + '<div style="margin-top:12px;">' + blocks + '</div>'
      + '<div class="acs-row acs-mt-3"><div class="acs-twelve acs-columns">'
      + '<a href="' + ctaURL + '" class="acs-button acs-button-margin acs-button-fw">' + ctaLabel + '</a>'
      + '</div></div>'
      + disclaimerHTML
      + '</div></div></div>';
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
    if (!csvURL) { console.error('[sentry-ford-specials] Missing data-csv'); return; }

    showSkeletons(root);

    fetchCSV(csvURL)
      .then(function (text) {
        var offers = csvToOffers(text);
        var cards  = offers
          .filter(function (o) { return !isHidden(o['Visibility']); })
          .map(buildCard).join('');

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
  } else { init(); }

})();
