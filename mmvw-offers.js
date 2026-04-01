/**
 * mmvw-offers.js
 * Minuteman Volkswagen — Dynamic Specials Insertion
 * Hosted at: AgileCreativeSolutions.github.io/oem-offers/mmvw-offers.js
 *
 * Targets:
 *   <div id="mmvw-lease-specials" data-csv="..."></div>   → Lease/Finance Specials tab
 *   <div id="mmvw-used-specials"  data-csv="..."></div>   → Used/CPO Specials tab
 *
 * Spreadsheet: fields as rows (col A), offer slots as columns (B–P = Offers 1–15).
 * Visibility:  blank cell = show  |  type "hide" = suppress
 */

(function () {
  'use strict';

  // ── SHIMMER CSS ──────────────────────────────────────────────────────────────
  // Injected once into <head>. Self-contained — no dependency on framework skeleton classes.
  var SHIMMER_STYLE_ID = 'mmvw-skel-styles';

  function injectShimmerStyles() {
    if (document.getElementById(SHIMMER_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = SHIMMER_STYLE_ID;
    style.textContent =
      '@keyframes mmvw-shimmer {' +
        '0%   { background-position: -800px 0; }' +
        '100% { background-position:  800px 0; }' +
      '}' +
      '.mmvw-skel-card {' +
        'width: 100%;' +
        'border: solid 2px rgba(0,0,0,.055);' +
        'border-radius: 4px;' +
        'overflow: hidden;' +
        'display: flex;' +
        'flex-direction: column;' +
        'height: 100%;' +
      '}' +
      '.mmvw-skel-block {' +
        'background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);' +
        'background-size: 800px 100%;' +
        'animation: mmvw-shimmer 1.4s infinite linear;' +
        'border-radius: 3px;' +
      '}' +
      '.mmvw-skel-header { height: 72px; border-radius: 0; }' +
      '.mmvw-skel-image  { height: 220px; border-radius: 0; }' +
      '.mmvw-skel-body   { padding: 28px 24px 24px; flex: 1; }' +
      '.mmvw-skel-line   { height: 14px; margin-bottom: 10px; }' +
      '.mmvw-skel-price  { height: 42px; margin-bottom: 12px; width: 60%; }' +
      '.mmvw-skel-btn    { height: 44px; margin-top: 20px; border-radius: 4px; }';
    (document.head || document.documentElement).appendChild(style);
  }

  // ── SKELETON CARD ────────────────────────────────────────────────────────────
  function skeletonCard() {
    return '<div class="mmvw-skel-card">' +
             '<div class="mmvw-skel-block mmvw-skel-header"></div>' +
             '<div class="mmvw-skel-block mmvw-skel-image"></div>' +
             '<div class="mmvw-skel-body">' +
               '<div class="mmvw-skel-block mmvw-skel-line" style="width:55%;margin:0 auto 10px;"></div>' +
               '<div class="mmvw-skel-block mmvw-skel-price" style="margin:0 auto 12px;"></div>' +
               '<div class="mmvw-skel-block mmvw-skel-line" style="width:70%;margin:0 auto 10px;"></div>' +
               '<div class="mmvw-skel-block mmvw-skel-line" style="width:45%;margin:0 auto 20px;"></div>' +
               '<div class="mmvw-skel-block mmvw-skel-btn"></div>' +
             '</div>' +
           '</div>';
  }

  // Lease skeleton: 4 ghost cards, 2-up columns (mirrors acs-six-lg layout)
  function skeletonLease() {
    var card = skeletonCard();
    var col  = '<div class="acs-twelve acs-six-lg acs-columns acs-my-2 acs-flex">' + card + '</div>';
    return '<div class="acs-wrapper acs-bg-white">' +
             '<div class="acs-container acs-py-6">' +
               '<div class="acs-row">' +
                 col + col + col + col +
               '</div>' +
             '</div>' +
           '</div>';
  }

  // Used skeleton: 6 ghost cards, 3-up columns (mirrors acs-four-2xl acs-six-lg layout)
  function skeletonUsed() {
    var card = skeletonCard();
    var col  = '<div class="acs-twelve acs-four-2xl acs-six-lg acs-columns acs-my-2 acs-flex">' + card + '</div>';
    return '<div class="acs-wrapper acs-bg-white">' +
             '<div class="acs-container acs-py-6">' +
               '<div class="acs-row acs-justify-content-center">' +
                 col + col + col + col + col + col +
               '</div>' +
             '</div>' +
           '</div>';
  }

  // ── CSV PARSER ───────────────────────────────────────────────────────────────
  // Handles quoted fields (including embedded commas and newlines).
  function parseCSV(text) {
    var rows = [];
    var lines = text.trim().split(/\r?\n/);
    lines.forEach(function (line) {
      var row = [];
      var inQuote = false;
      var val = '';
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { val += '"'; i++; }
          else { inQuote = !inQuote; }
        } else if (ch === ',' && !inQuote) {
          row.push(val.trim()); val = '';
        } else {
          val += ch;
        }
      }
      row.push(val.trim());
      rows.push(row);
    });
    return rows;
  }

  // ── PIVOT ROWS → OFFER OBJECTS ───────────────────────────────────────────────
  // Row 0 = header row (skipped). Col 0 = field name, Col 1–15 = Offer 1–15.
  // Field name normalized to lowercase_with_underscores.
  // Offers with visibility === 'hide' (case-insensitive) are filtered out.
  function pivotOffers(rows) {
    var dataRows = rows.slice(1);
    if (!dataRows.length) return [];

    var numOffers = dataRows[0].length - 1;
    var offers = [];

    for (var col = 0; col < numOffers; col++) {
      (function (c) {
        var offer = {};
        dataRows.forEach(function (row) {
          var key = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '_');
          if (!key) return;
          offer[key] = (row[c + 1] || '').trim();
        });
        offers.push(offer);
      })(col);
    }

    return offers.filter(function (o) {
      return (o.visibility || '').toLowerCase() !== 'hide';
    });
  }

  // ── HTML HELPERS ─────────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── RENDER: LEASE / FINANCE SPECIALS ─────────────────────────────────────────
  // 2-up card layout. Each card:
  //   dark blue header (year / "Volkswagen" / model + optional sales event logo)
  //   car cut image on accent3 background
  //   up to four offer columns (Offer 1 required · Offers 2–4 optional)
  //   optional fine print line
  //   CTA button
  //   optional disclaimer below <hr>
  //
  // Offer column sizing adapts automatically:
  //   1 offer  → full width (acs-twelve-md)
  //   2 offers → two halves (acs-six-md)
  //   3 offers → three thirds (acs-four-md)
  //   4 offers → two halves, two rows
  function renderLeaseSpecials(offers, container) {
    if (!offers.length) { container.innerHTML = ''; return; }

    var html = '<div class="acs-wrapper acs-bg-white">' +
               '<div class="acs-container acs-py-6">' +
               '<div class="acs-row">';

    offers.forEach(function (o) {

      var logoHTML = o.sales_event_logo_url
        ? '<div class="acs-four-sm acs-justify-content-end-lg acs-justify-content-center acs-text-center acs-text-right-lg">' +
            '<img src="' + esc(o.sales_event_logo_url) + '" alt="" class="acs-img-full-width">' +
          '</div>'
        : '<div class="acs-four-sm acs-appear acs-hide-sm"></div>';

      // Offer columns always render 50/50 (acs-six-md), stacking in pairs for 3–4 offers.
      var offerColsHTML = '';
      [1, 2, 3, 4].forEach(function (n) {
        var mt = n >= 3 ? ' style="margin-top:1.5rem;"' : '';
        offerColsHTML +=
          '<div class="acs-six-md"' + mt + '>' +
            '<p class="acs-text-4 acs-lh-3 acs-mb-3">' + esc(o['offer_' + n + '_label']) + '</p>' +
            '<p class="acs-h1">' + esc(o['offer_' + n + '_value']) + '</p>' +
            '<p class="acs-mb-0 acs-lh-4">' + esc(o['offer_' + n + '_subtext']) + '</p>' +
          '</div>';
      });

      var finePrintHTML = o.fine_print
        ? '<div class="acs-mt-3"><p class="acs-h6">' + esc(o.fine_print) + '</p></div>'
        : '';

      // Disclaimer rendered raw so ©, *, &reg; etc. display correctly.
      var disclaimerHTML = o.disclaimer
        ? '<hr><p class="acs-text-3 acs-lh-7 acs-my-3 acs-gray">' + o.disclaimer + '</p>'
        : '';

      html +=
        '<div class="acs-twelve acs-six-lg acs-columns acs-my-2 acs-flex">' +
          '<div class="acs-card acs-h35 acs-flex-fill">' +

            // Card header — dark blue band
            '<div class="acs-bg-accent4 acs-white">' +
              '<div class="acs-p-5 acs-row acs-align-self-center acs-align-items-center">' +
                '<div class="acs-four-sm acs-appear acs-hide-sm"></div>' +
                '<div class="acs-eight-sm acs-text-center acs-text-left-sm">' +
                  '<p class="acs-text-5">' + esc(o.year) + ' Volkswagen</p>' +
                  '<p class="acs-h5 acs-white">' + esc(o.model) + '</p>' +
                '</div>' +
                logoHTML +
              '</div>' +
            '</div>' +

            // Car cut image
            '<div class="acs-bg-accent3">' +
              '<img src="' + esc(o.car_cut_url) + '" class="acs-img-full-width"' +
                ' alt="' + esc(o.year + ' Volkswagen ' + o.model) + '" />' +
            '</div>' +

            // Offer columns + CTA
            '<div class="acs-px-6 acs-text-center acs-pt-8">' +
              '<div class="acs-row acs-justify-content-center">' +
                offerColsHTML +
              '</div>' +
              '<div class="acs-row acs-justify-content-center">' +
                finePrintHTML +
              '</div>' +
              '<div class="acs-row acs-mt-5">' +
                '<div class="acs-twelve acs-columns">' +
                  '<a href="' + esc(o.cta_url) + '" class="acs-button acs-button-margin acs-button-fw">' +
                    esc(o.cta_label || 'Shop Now') +
                  '</a>' +
                '</div>' +
              '</div>' +
              disclaimerHTML +
            '</div>' + // acs-px-6

          '</div>' + // acs-card
        '</div>';   // column
    });

    html += '</div></div></div>'; // acs-row / acs-container / acs-wrapper

    container.innerHTML = html;
  }

  // ── RENDER: USED / CPO SPECIALS ──────────────────────────────────────────────
  // 3-up card layout. Each card:
  //   gradient header (vehicle title + photo) — gradient class set per vehicle in sheet
  //   VIN / Stock Number line
  //   Vehicle Details CTA
  // Make is always "Volkswagen" and is not a spreadsheet field.
  function renderUsedSpecials(offers, container) {
    if (!offers.length) { container.innerHTML = ''; return; }

    var html = '<div class="acs-wrapper acs-bg-white">' +
               '<div class="acs-container acs-py-6">' +
               '<div class="acs-row acs-justify-content-center">';

    offers.forEach(function (o) {
      var condition = esc(o.condition || 'Certified Pre-Owned');
      var title     = condition + ' ' + esc(o.year) + ' Volkswagen ' + esc(o.model) +
                      (o.trim ? ' ' + esc(o.trim) : '');
      var bgClass   = esc(o.header_style || 'acs-gray-gradient');

      var vinParts = [];
      if (o.vin)          vinParts.push('VIN: ' + o.vin);
      if (o.stock_number) vinParts.push('Stock Number: ' + o.stock_number);
      var vinHTML = vinParts.length
        ? '<p class="acs-text-4 acs-lh-3 acs-opacity-50 acs-px-6 acs-pb-6">' + esc(vinParts.join(' | ')) + '</p>'
        : '';

      html +=
        '<div class="acs-twelve acs-four-2xl acs-six-lg acs-columns acs-my-2 acs-flex">' +
          '<div class="acs-card acs-h35">' +

            '<div class="' + bgClass + '">' +
              '<div class="acs-py-6">' +
                '<div class="acs-header">' +
                  '<p class="acs-h3 acs-mb-4 acs-px-6">' + title + '</p>' +
                '</div>' +
                '<div class="acs-text-center">' +
                  '<img src="' + esc(o.car_image_url) + '"' +
                      ' class="acs-img-full-width acs-ma acs-car-cut"' +
                      ' title="' + title + '"' +
                      ' alt="' + title + '" />' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="acs-px-4 acs-text-center">' +
              vinHTML +
              '<div class="acs-row">' +
                '<div class="acs-columns">' +
                  '<a href="' + esc(o.cta_url) + '" class="acs-button acs-mb-6 acs-button-fw">Vehicle Details</a>' +
                '</div>' +
              '</div>' +
            '</div>' +

          '</div>' + // acs-card
        '</div>';   // column
    });

    html += '</div></div></div>'; // acs-row / acs-container / acs-wrapper

    container.innerHTML = html;
  }

  // ── FETCH → SKELETON → RENDER ────────────────────────────────────────────────
  function fetchAndRender(el, skeletonFn, renderFn) {
    var csvUrl = el.getAttribute('data-csv');
    if (!csvUrl) {
      console.warn('[mmvw-offers] Missing data-csv on #' + el.id);
      return;
    }

    // Show skeleton immediately while CSV is in flight
    el.innerHTML = skeletonFn();

    fetch(csvUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function (text) {
        var rows   = parseCSV(text);
        var offers = pivotOffers(rows);
        renderFn(offers, el);
      })
      .catch(function (err) {
        console.error('[mmvw-offers] Failed to load #' + el.id + ':', err);
        el.innerHTML = ''; // clear skeleton on fetch failure
      });
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────
  injectShimmerStyles();

  var leaseEl = document.getElementById('mmvw-lease-specials');
  var usedEl  = document.getElementById('mmvw-used-specials');

  if (leaseEl) fetchAndRender(leaseEl, skeletonLease,  renderLeaseSpecials);
  if (usedEl)  fetchAndRender(usedEl,  skeletonUsed,   renderUsedSpecials);

})();
