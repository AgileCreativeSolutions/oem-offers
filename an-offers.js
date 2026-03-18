/*!
 * an-specials.js
 * Audi Norwell — Dynamic Specials Page
 * Single Google Sheets CSV  →  data-csv attribute on the container div.
 *
 * ── SPREADSHEET LAYOUT (single "Lease Offers" tab) ───────────────────────────
 * Col A  = field label column (never rendered)
 * Col B  = CPO offer  (column index 1 in the parsed CSV)
 * Col C–V = Lease Slots 1–20  (column indices 2–21)
 *
 * ── FIELD ROW INDEX MAP (0-based) ────────────────────────────────────────────
 * 0  = header row  (slot labels — skipped)
 * 1  = Visibility       blank = show  |  "hide" = hidden
 * 2  = Offer Label
 * 3  = Year
 * 4  = Model            (CPO: title text e.g. "Certified Pre-owned offer")
 * 5  = Trim             (CPO: subtext / supporting copy)
 * 6  = Image URL
 * 7  = Monthly Payment  (CPO: offer text e.g. "4.99% APR")
 * 8  = Footnote Number
 * 9  = Term (Months)    (CPO: leave blank)
 * 10 = Due At Signing   (CPO: leave blank)
 * 11 = CTA Button Text
 * 12 = CTA Button Link
 * 13 = Disclaimer Text
 */

(function () {
  'use strict';

  var R = {
    VISIBILITY:  1,
    OFFER_LABEL: 2,
    YEAR:        3,
    MODEL:       4,
    TRIM:        5,
    IMAGE_URL:   6,
    MONTHLY:     7,
    FOOTNOTE:    8,
    TERM:        9,
    DUE_SIGNING: 10,
    CTA_TEXT:    11,
    CTA_LINK:    12,
    DISCLAIMER:  13
  };

  // ── CSV PARSER ──────────────────────────────────────────────────────────────
  function parseCSV(text) {
    var rows  = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line) rows.push(splitCSVLine(line));
    }
    return rows;
  }

  function splitCSVLine(line) {
    var cols     = [];
    var inQuotes = false;
    var current  = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  }

  function val(rows, rowIndex, colIndex) {
    if (!rows[rowIndex]) return '';
    return (rows[rowIndex][colIndex] || '').trim();
  }

  // ── LEASE CARD BUILDER ──────────────────────────────────────────────────────
  function buildLeaseCard(rows, colIndex, footnoteNum) {
    var offerLabel = val(rows, R.OFFER_LABEL, colIndex);
    var year       = val(rows, R.YEAR,        colIndex);
    var model      = val(rows, R.MODEL,       colIndex);
    var trim       = val(rows, R.TRIM,        colIndex);
    var imageUrl   = val(rows, R.IMAGE_URL,   colIndex);
    var monthly    = val(rows, R.MONTHLY,     colIndex);
    var term       = val(rows, R.TERM,        colIndex);
    var due        = val(rows, R.DUE_SIGNING, colIndex);
    var ctaText    = val(rows, R.CTA_TEXT,    colIndex);
    var ctaLink    = val(rows, R.CTA_LINK,    colIndex);
    var altText    = year + ' ' + model + ' ' + trim;
    var fnTag      = footnoteNum !== '' ? ' <sup>[' + footnoteNum + ']</sup>' : '';

    return (
      '<div class="acs-six-md acs-four-xl acs-columns acs-text-center acs-flex acs-my-2">' +
        '<div class="acs-vehicle-box">' +
          '<div class="acs-gradient acs-pt-5 acs-px-4">' +
            '<p class="acs-uppercase acs-text-4 acs-ls-1">' + offerLabel + '</p>' +
            '<h6 class="acs-h6">' + year + ' ' + model + '</h6>' +
            '<p class="acs-text-5 acs-lh-7">' + trim + '</p>' +
            '<img src="' + imageUrl + '" class="acs-img-full-width acs-mt-8" title="' + altText + '" alt="">' +
          '</div>' +
          '<div class="acs-pb-5 acs-px-4">' +
            '<div class="acs-row">' +
              '<div class="acs-four acs-border acs-p-2">' +
                '<p class="acs-text-8 acs-lh-4">' + monthly + fnTag + '</p>' +
                '<p class="acs-opacity-50 acs-text-4 acs-ls-1">month</p>' +
              '</div>' +
              '<div class="acs-four acs-border acs-p-2">' +
                '<p class="acs-text-8 acs-lh-4">' + term + '</p>' +
                '<p class="acs-opacity-50 acs-text-4 acs-ls-1">Months</p>' +
              '</div>' +
              '<div class="acs-four acs-p-2">' +
                '<p class="acs-text-8 acs-lh-4">' + due + '</p>' +
                '<p class="acs-opacity-50 acs-text-4 acs-ls-1">Due At Signing</p>' +
              '</div>' +
            '</div>' +
            '<div class="acs-mt-5">' +
              '<a href="' + ctaLink + '" class="acs-button3 acs-button-fw">' + ctaText + '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ── CPO SECTION INJECTOR ────────────────────────────────────────────────────
  // CPO lives at column index 1 (col B in the sheet).
  // Model row  = title text  (e.g. "Certified Pre-owned offer")
  // Monthly row = offer text (e.g. "4.99% APR")
  // Trim row   = subtext / supporting copy
  function renderCPO(rows) {
    var cpoSection = document.querySelector('[data-an-cpo]');
    if (!cpoSection) return;

    var visibility = val(rows, R.VISIBILITY, 1).toLowerCase();
    if (visibility === 'hide') {
      cpoSection.style.display = 'none';
      return;
    }

    var title      = val(rows, R.MODEL,      1);
    var offerText  = val(rows, R.MONTHLY,    1);
    var subtext    = val(rows, R.TRIM,       1);
    var footnoteN  = val(rows, R.FOOTNOTE,   1);
    var ctaText    = val(rows, R.CTA_TEXT,   1);
    var ctaLink    = val(rows, R.CTA_LINK,   1);
    var disclaimer = val(rows, R.DISCLAIMER, 1);
    var fnTag      = footnoteN ? ' <sup>[' + footnoteN + ']</sup>' : '';

    var titleEl   = cpoSection.querySelector('[data-cpo-title]');
    var offerEl   = cpoSection.querySelector('[data-cpo-offer]');
    var subtextEl = cpoSection.querySelector('[data-cpo-subtext]');
    var ctaEl     = cpoSection.querySelector('[data-cpo-cta]');

    if (titleEl)   titleEl.innerHTML   = title;
    if (offerEl)   offerEl.innerHTML   = offerText + fnTag;
    if (subtextEl) subtextEl.innerHTML = subtext;
    if (ctaEl) {
      ctaEl.setAttribute('href', ctaLink);
      ctaEl.textContent = ctaText;
    }

    // Append CPO disclaimer after lease disclaimers
    if (disclaimer && footnoteN) {
      var disclaimerEl = document.querySelector('[data-an-disclaimers]');
      if (disclaimerEl) {
        var p = document.createElement('p');
        p.className = 'acs-text-4 acs-lh-6 acs-mb-2';
        p.innerHTML = '<sup>[' + footnoteN + ']</sup> ' + disclaimer;
        disclaimerEl.appendChild(p);
      }
    }
  }

  // ── DISCLAIMER FLUSH ────────────────────────────────────────────────────────
  function flushDisclaimers(disclaimers) {
    var el = document.querySelector('[data-an-disclaimers]');
    if (!el || !disclaimers.length) return;
    var html = '<p class="acs-text-4 acs-lh-8 acs-mb-5"><span class="acs-bold">Disclaimers:</span></p>';
    for (var i = 0; i < disclaimers.length; i++) {
      html += '<p class="acs-text-4 acs-lh-6 acs-mb-2"><sup>[' + disclaimers[i].num + ']</sup> ' + disclaimers[i].text + '</p>';
    }
    el.innerHTML = html;
  }

  // ── MAIN RENDER ─────────────────────────────────────────────────────────────
  function render(csvText) {
    var rows        = parseCSV(csvText);
    var grid        = document.querySelector('[data-an-grid]');
    var disclaimers = [];
    var cards       = '';
    var fnCounter   = 1;

    if (!grid) return;

    // Lease slots: col indices 2–21  (col 0 = labels, col 1 = CPO)
    for (var col = 2; col <= 21; col++) {
      var visibility = val(rows, R.VISIBILITY, col).toLowerCase();
      if (visibility === 'hide') continue;

      var model = val(rows, R.MODEL, col);
      if (!model) continue;

      var disclaimerText = val(rows, R.DISCLAIMER, col);
      var footnoteNum    = '';

      if (disclaimerText) {
        var sheetFn = val(rows, R.FOOTNOTE, col);
        footnoteNum = sheetFn || String(fnCounter);
        disclaimers.push({ num: footnoteNum, text: disclaimerText });
        fnCounter++;
      }

      cards += buildLeaseCard(rows, col, footnoteNum);
    }

    grid.innerHTML = cards;

    // Lease disclaimers first, then CPO appends its own at the end
    flushDisclaimers(disclaimers);
    renderCPO(rows);
  }

  // ── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    var container = document.querySelector('[data-an-specials]');
    if (!container) return;

    var csvUrl = container.getAttribute('data-csv');
    if (!csvUrl) return;

    fetch(csvUrl)
      .then(function (r) { return r.text(); })
      .then(function (text) { render(text); })
      .catch(function (err) { console.warn('[AN Specials] Could not load CSV:', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
