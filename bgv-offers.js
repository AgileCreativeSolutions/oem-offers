/**
 * bgv-offers.js
 * Brigham-Gill Village — Dynamic Specials Insertion
 * Agile Creative Solutions
 *
 * Spreadsheet layout: Column A = Field names, Columns B–P = Offer 1–15
 * Visibility: blank = show | "hide" = suppress
 * Host: AgileCreativeSolutions.github.io/oem-offers/
 */

(function () {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────────── */
  var CONTAINER_ID  = 'bgv-specials-container';
  var NAV_ID        = 'bgv-filter-nav';
  var NUM_SLOTS     = 15;
  var SKELETON_COUNT = 6;

  /* ─── Skeleton CSS ────────────────────────────────────────────── */
  var SKEL_CSS = [
    '.bgv-skel-wrap{background:#fff;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,.1);margin:1.25rem 0;overflow:hidden;}',
    '.bgv-shimmer{background:linear-gradient(90deg,#efefef 25%,#e0e0e0 50%,#efefef 75%);background-size:200% 100%;animation:bgv-sh 1.4s ease infinite;}',
    '@keyframes bgv-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    '.bgv-skel-logo{height:50px;width:120px;margin:24px auto 12px;border-radius:4px;}',
    '.bgv-skel-img{height:190px;}',
    '.bgv-skel-title{height:18px;margin:14px 30px 8px;border-radius:3px;}',
    '.bgv-skel-sub{height:13px;margin:0 50px 18px;border-radius:3px;}',
    '.bgv-skel-offers{display:flex;justify-content:center;gap:10px;padding:16px 20px;}',
    '.bgv-skel-block{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;}',
    '.bgv-skel-label{height:11px;width:75%;border-radius:3px;}',
    '.bgv-skel-price{height:28px;width:65%;border-radius:3px;}',
    '.bgv-skel-detail{height:10px;width:88%;border-radius:3px;}',
    '.bgv-skel-btn{height:42px;margin:14px 20px 22px;border-radius:4px;}'
  ].join('');

  function injectSkelCSS() {
    if (document.getElementById('bgv-skel-css')) return;
    var s = document.createElement('style');
    s.id = 'bgv-skel-css';
    s.textContent = SKEL_CSS;
    document.head.appendChild(s);
  }

  function skelCard() {
    return [
      '<div class="acs-four-lg acs-six-md acs-align-items-center acs-columns">',
        '<div class="bgv-skel-wrap">',
          '<div class="bgv-skel-logo bgv-shimmer"></div>',
          '<div class="bgv-skel-img bgv-shimmer"></div>',
          '<div class="bgv-skel-title bgv-shimmer"></div>',
          '<div class="bgv-skel-sub bgv-shimmer"></div>',
          '<div class="bgv-skel-offers">',
            '<div class="bgv-skel-block">',
              '<div class="bgv-skel-label bgv-shimmer"></div>',
              '<div class="bgv-skel-price bgv-shimmer"></div>',
              '<div class="bgv-skel-detail bgv-shimmer"></div>',
              '<div class="bgv-skel-detail bgv-shimmer"></div>',
            '</div>',
            '<div class="bgv-skel-block">',
              '<div class="bgv-skel-label bgv-shimmer"></div>',
              '<div class="bgv-skel-price bgv-shimmer"></div>',
              '<div class="bgv-skel-detail bgv-shimmer"></div>',
            '</div>',
            '<div class="bgv-skel-block">',
              '<div class="bgv-skel-label bgv-shimmer"></div>',
              '<div class="bgv-skel-price bgv-shimmer"></div>',
              '<div class="bgv-skel-detail bgv-shimmer"></div>',
            '</div>',
          '</div>',
          '<div class="bgv-skel-btn bgv-shimmer"></div>',
        '</div>',
      '</div>'
    ].join('');
  }

  function showSkeleton(container) {
    var html = '';
    for (var i = 0; i < SKELETON_COUNT; i++) html += skelCard();
    container.innerHTML = html;
  }

  /* ─── CSV Parser ──────────────────────────────────────────────── */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuote = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuote) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch !== '\r') { field += ch; }
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* ─── Build offer objects ─────────────────────────────────────── */
  // Row 0 = header ("Field", "Offer 1"...) — skipped
  // Column A = field name → normalized key
  // Columns B–P = Offer 1–15
  function buildOffers(rows) {
    if (rows.length < 2) return [];
    var dataRows = rows.slice(1); // skip header
    var offers = [];
    for (var col = 0; col < NUM_SLOTS; col++) {
      var offer = {};
      for (var r = 0; r < dataRows.length; r++) {
        var key = (dataRows[r][0] || '').trim().toLowerCase().replace(/\s+/g, '_');
        offer[key] = (dataRows[r][col + 1] || '').trim();
      }
      offers.push(offer);
    }
    return offers;
  }

  /* ─── Filter nav ──────────────────────────────────────────────── */
  // All brand tabs are always visible regardless of what's in the sheet.
  var BRANDS = [
    { key: 'all',      label: 'Show All'  },
    { key: 'chrysler', label: 'Chrysler'  },
    { key: 'dodge',    label: 'Dodge'     },
    { key: 'jeep',     label: 'Jeep'      },
    { key: 'ram',      label: 'RAM'       }
  ];

  var EMPTY_STATE_HTML = [
    '<div class="acs-twelve acs-columns bgv-empty-state" style="text-align:center;padding:60px 20px;">',
      '<p style="font-size:1.5rem;margin-bottom:0.5rem;">&#128663;</p>',
      '<p style="font-size:1.1rem;font-weight:700;color:#333;margin-bottom:0.4rem;">No offers available right now.</p>',
      '<p style="font-size:0.9rem;color:#777;">Check back soon &mdash; new specials are updated monthly.</p>',
    '</div>'
  ].join('');

  function applyFilter(filter) {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var cards = container.querySelectorAll('.bgv-special-card');
    var emptyState = container.querySelector('.bgv-empty-state');
    var visible = 0;

    cards.forEach(function (card) {
      var show = filter === 'all' || card.getAttribute('data-make') === filter;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (emptyState) emptyState.parentNode.removeChild(emptyState);
    if (visible === 0) container.insertAdjacentHTML('beforeend', EMPTY_STATE_HTML);
  }

  function buildFilterNav() {
    var navEl = document.getElementById(NAV_ID);
    if (!navEl) return;

    navEl.innerHTML = BRANDS.map(function (b, idx) {
      return '<button class="acs-filter-btn' + (idx === 0 ? ' acs-active' : '') + '" data-bgv-filter="' + b.key + '">' + b.label + '</button>';
    }).join('');

    navEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bgv-filter]');
      if (!btn) return;
      var filter = btn.getAttribute('data-bgv-filter');
      navEl.querySelectorAll('[data-bgv-filter]').forEach(function (b) { b.classList.remove('acs-active'); });
      btn.classList.add('acs-active');
      applyFilter(filter);
    });
  }

  /* ─── Render one card ─────────────────────────────────────────── */
  function renderCard(o) {
    var make = (o.make || '').toLowerCase();

    /* Lease block — hidden if lease_block = "hide" OR lease_payment is blank */
    var leaseBlock = '';
    if ((o.lease_block || '').toLowerCase() !== 'hide' && o.lease_payment) {
      leaseBlock = [
        '<div class="acs-columns acs-six-lg acs-pb-4 acs-align-self-center">',
          '<p class="acs-lh-5 acs-text-5 acs-mb-1 acs-bold">Lease</p>',
          '<p class="acs-lh-4 acs-text-10 acs-bold acs-accent">' + o.lease_payment + '/mo.</p>',
          o.lease_term && o.lease_miles_per_year
            ? '<p class="acs-lh-4 acs-text-5 acs-mb-1">' + o.lease_term + ' Months | ' + o.lease_miles_per_year + ' Miles/Year</p>'
            : '',
          o.lease_cash_down
            ? '<p class="acs-lh-4 acs-text-5 acs-mb-1">' + o.lease_cash_down + ' Cash Down</p>'
            : '',
        '</div>'
      ].join('');
    }

    /* Purchase block — hidden if purchase_block = "hide" OR purchase_price is blank */
    var purchaseBlock = '';
    if ((o.purchase_block || '').toLowerCase() !== 'hide' && o.purchase_price) {
      purchaseBlock = [
        '<div class="acs-columns acs-six-lg acs-pb-4 acs-align-self-center">',
          '<p class="acs-lh-5 acs-text-5 acs-mb-1 acs-bold">Purchase for</p>',
          '<p class="acs-lh-4 acs-text-10 acs-bold acs-accent">' + o.purchase_price + '</p>',
          o.purchase_savings
            ? '<p class="acs-lh-4 acs-text-5 acs-mb-1">' + o.purchase_savings + '</p>'
            : '',
        '</div>'
      ].join('');
    }

    /* Finance block — hidden if finance_block = "hide" OR apr is blank */
    var financeBlock = '';
    if ((o.finance_block || '').toLowerCase() !== 'hide' && o.apr) {
      var aprNote = o.apr_note
        ? '<p class="acs-lh-4 acs-text-4 acs-mb-1 acs-bg-accent-orange acs-white acs-p-2">' + o.apr_note + '</p>'
        : '';
      var aprColWidth = o.apr_note ? 'acs-ten-lg' : 'acs-six-lg';
      financeBlock = [
        '<div class="acs-columns ' + aprColWidth + ' acs-pb-4 acs-align-self-center">',
          '<p class="acs-lh-5 acs-text-5 acs-mb-1 acs-bold">Finance Offers</p>',
          '<p class="acs-lh-4 acs-text-10 acs-bold acs-accent">' + o.apr + '</p>',
          o.apr_term
            ? '<p class="acs-lh-4 acs-text-5 acs-mb-1">for ' + o.apr_term + ' Months</p>'
            : '',
          aprNote,
        '</div>'
      ].join('');
    }

    /* Logo row */
    var logoRow = o.logo_image_url
      ? '<div class="acs-row"><img src="' + o.logo_image_url + '" class="acs-img-full-width acs-logo" alt="' + (o.make || '') + ' Sales Event"></div>'
      : '';

    /* Phone (mobile only) */
    var phoneHtml = '';
    if (o.phone_number) {
      var digits = o.phone_number.replace(/\D/g, '');
      phoneHtml = [
        '<div class="acs-appear acs-hide-lg">',
          '<p class="acs-phone acs-my-3">',
            '<span class="acs-bg-accent acs-py-2 acs-mr-5">',
              '<i class="fa fa-phone" aria-hidden="true"></i>',
            '</span>',
            '<a href="tel:1' + digits + '" target="_blank" class="acs-button-number">' + o.phone_number + '</a>',
          '</p>',
        '</div>'
      ].join('');
    }

    /* Disclaimer paragraphs */
    var disclaimerHTML = (o.disclaimer || '')
      .split(/\n+/)
      .filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p class="acs-text-3 acs-lh-5 acs-pt-1 acs-opacity-60">' + p.trim() + '</p>'; })
      .join('');

    return [
      '<div class="acs-four-lg acs-six-md acs-align-items-center acs-columns bgv-special-card" data-make="' + make + '">',
        '<div class="acs-bg-white acs-bs-1 acs-my-5 acs-card">',
          '<div class="acs-text-left">',
            logoRow,
            /* Vehicle image — alt built from title fields */
            '<img src="' + (o.vehicle_image_url || '') + '" alt="' + ((o.title_line_1 || '') + ' ' + (o.title_line_2 || '')).trim() + '" class="acs-img-full-width">',
            /* Title */
            '<p class="acs-h6 acs-text-center acs-px-6 acs-mb-3">' + (o.title_line_1 || '') + '<br>' + (o.title_line_2 || '') + '</p>',
            '<p class="acs-text-center">MSRP: ' + (o.msrp || '') + ' | Stock# ' + (o.stock_number || '') + '</p>',
            /* Offer blocks */
            '<div class="acs-row acs-text-center acs-justify-content-center acs-pt-5">',
              leaseBlock,
              purchaseBlock,
              financeBlock,
            '</div>',
            /* CTA */
            '<div class="acs-row">',
              '<div class="acs-twelve acs-px-5">',
                '<a href="' + (o.button_url || '#') + '" class="acs-button acs-button-fw acs-mt-2">' + (o.button_text || 'View Offer') + '</a>',
                phoneHtml,
              '</div>',
            '</div>',
            /* Disclaimer */
            '<div class="acs-row acs-px-5 acs-py-3">',
              '<div class="acs-twelve">',
                '<details closed>',
                  '<summary class="acs-text-4">Disclaimer</summary>',
                  disclaimerHTML,
                '</details>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  /* ─── Init ────────────────────────────────────────────────────── */
  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var csvUrl = container.getAttribute('data-csv');
    if (!csvUrl) {
      console.warn('[bgv-offers] Missing data-csv attribute on #bgv-specials-container.');
      return;
    }

    injectSkelCSS();
    showSkeleton(container);

    fetch(csvUrl)
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var rows    = parseCSV(text);
        var all     = buildOffers(rows);
        var visible = all.filter(function (o) {
          return (o.visibility || '').toLowerCase() !== 'hide';
        });

        buildFilterNav();

        if (!visible.length) {
          container.innerHTML = '<p class="acs-text-center acs-py-7">No specials available at this time.</p>';
          return;
        }

        container.innerHTML = visible.map(renderCard).join('');
      })
      .catch(function (err) {
        console.error('[bgv-offers] Failed to load specials:', err);
        container.innerHTML = '<p class="acs-text-center acs-py-7">Unable to load specials at this time.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
