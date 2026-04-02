/**
 * sentry-lincoln-specials.js
 * Sentry Lincoln — Dynamic Specials Insertion
 * AgileCreativeSolutions / oem-offers
 *
 * Each card supports up to 4 generic offer blocks stacked vertically.
 * Anchor nav built dynamically from Anchor ID + Model fields in the sheet.
 *
 * Offer block fields (N = 1–4):
 *   Hide Offer N   — blank = show | "hide" = suppress block
 *   Offer N Label  — e.g. "Lease for:"
 *   Offer N Value  — e.g. "$616/mo*"
 *   Offer N Detail 1 / Detail 2 — supporting lines
 *
 * Card visibility:
 *   Visibility — blank = show | "hide" = suppress card entirely
 */
(function () {
  'use strict';

  var ROOT_ID     = 'sl-specials';
  var NAV_ID      = 'sl-anchor-nav';
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
    return '<div class="acs-six-md acs-four-xl acs-three-2xl acs-columns acs-my-3">'
      + '<div class="acs-offer-cell" style="overflow:hidden;">'
      + '<div class="acs-skel-block" style="width:100%;height:21rem;border-radius:10px 10px 0 0;"></div>'
      + '<div class="acs-py-5 acs-px-2"><div style="text-align:center;">'
      + '<div class="acs-skel-block" style="height:11px;width:45%;margin:0 auto 8px;"></div>'
      + '<div class="acs-skel-block" style="height:22px;width:55%;margin:0 auto 12px;"></div>'
      + '<div class="acs-skel-block" style="height:1px;width:100%;margin:0 auto 12px;"></div>'
      + '<div class="acs-skel-block" style="height:11px;width:40%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:30px;width:50%;margin:0 auto 6px;"></div>'
      + '<div class="acs-skel-block" style="height:10px;width:60%;margin:0 auto 14px;"></div>'
      + '</div></div>'
      + '<div class="acs-row acs-bg-white" style="padding:0 16px 16px;">'
      + '<div class="acs-skel-block" style="height:52px;width:100%;border-radius:4px;"></div>'
      + '</div></div></div>';
  }

  function showSkeletons(root) {
    injectSkeletonStyles();
    var w = document.createElement('div');
    w.className = 'acs-skel-wrapper acs-row acs-text-center acs-justify-content-center';
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

  // ── Build anchor nav ──────────────────────────────────────────────────
  function buildNav(offers) {
    var nav = document.getElementById(NAV_ID);
    if (!nav) return;
    var visible = offers.filter(function (o) {
      return !isHidden(o['Visibility']) && o['Anchor ID'] && o['Model'];
    });
    nav.innerHTML = visible.map(function (o, i) {
      var id  = o['Anchor ID'].toLowerCase().replace(/\s+/g, '-');
      var sep = i < visible.length - 1 ? ' | ' : '';
      return '<a href="#' + id + '" class="acs-link-accent">' + esc(o['Model']) + '</a>' + sep;
    }).join('');
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
      + (value ? '<h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + value + '</span></h3>' : '')
      + (d1    ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + d1 + '</p>' : '')
      + (d2    ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + d2 + '</p>' : '')
      + '</div>';
  }

  function buildCard(o) {
    var anchorId   =     o['Anchor ID']           || '';
    var year       = esc(o['Year']                || '');
    var model      = esc(o['Model']               || '');
    var trim       = esc(o['Trim / Package']      || '');
    var imgSrc     =     o['Image URL']           || '';
    var stock      = esc(o['Stock #']             || '');
    var vin        = esc(o['VIN']                 || '');
    var ctaLabel   = esc(o['CTA Label']           || 'Shop Now');
    var ctaURL     =     o['CTA URL']             || '#';
    var disclaimer = esc(o['Disclaimer']          || '');

    var idAttr = anchorId ? ' id="' + anchorId.toLowerCase().replace(/\s+/g, '-') + '"' : '';

    var stockParts = [];
    if (stock) stockParts.push('Stock #' + stock);
    if (vin)   stockParts.push('VIN: ' + vin);
    var stockLine = stockParts.length
      ? '<p class="acs-text-5">' + stockParts.join(' | ') + '</p><hr>'
      : '';

    var blocks = [1, 2, 3, 4].map(function (n) { return buildOfferBlock(o, n); }).join('');

    var disclaimerHTML = disclaimer
      ? '<div class="acs-row acs-pb-4 acs-bg-white acs-disclaimer-box"><div class="acs-twelve">'
        + '<button class="acs-accordion acs-opacity-40"></button>'
        + '<div class="acs-disclaimer acs-text-3 acs-lh-8 acs-px-5"><p>' + disclaimer + '</p></div>'
        + '</div></div>'
      : '';

    return '<div' + idAttr + ' class="acs-six-md acs-four-xl acs-three-2xl acs-columns acs-my-3">'
      + '<div class="acs-offer-cell">'
      + '<img alt="' + year + ' Lincoln ' + model + '" src="' + imgSrc + '" class="acs-img-full-width acs-offer-img">'
      + '<div class="acs-py-5 acs-px-3"><div class="acs-text-center">'
      + '<p class="acs-text-9 acs-lh-5 acs-uppercase">' + year + ' LINCOLN</p>'
      + '<h2 class="acs-h5 acs-mb-1 acs-accent2 acs-uppercase acs-bold">' + model + '</h2>'
      + (trim ? '<p class="acs-text-5">' + trim + '</p>' : '')
      + stockLine
      + '</div>'
      + '<div style="margin-top:12px;">' + blocks + '</div>'
      + '</div>'
      + '<div class="acs-row acs-bg-white"><div class="acs-twelve acs-px-4">'
      + '<a href="' + ctaURL + '" class="acs-button3 acs-button-fw acs-button-margin">' + ctaLabel + '</a>'
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
    if (!csvURL) { console.error('[sentry-lincoln-specials] Missing data-csv'); return; }

    showSkeletons(root);

    fetchCSV(csvURL)
      .then(function (text) {
        var offers = csvToOffers(text);
        var cards  = offers
          .filter(function (o) { return !isHidden(o['Visibility']); })
          .map(buildCard).join('');

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
  } else { init(); }

})();
