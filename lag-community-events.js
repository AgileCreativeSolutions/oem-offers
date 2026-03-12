// LAG Community Events — Dynamic Insertion
// Hosted at: https://AgileCreativeSolutions.github.io/oem-offers/lag-community-events.js
// Data source: Google Sheets → File > Share > Publish to web → CSV
//
// Spreadsheet format (horizontal — matches RSMH specials pattern):
//   Row 1:  header  → "Field" | "Event 1" | "Event 2" | ...
//   Row 2:  field   → "Visibility"    | [val per event]
//   Row 3:  field   → "Logo URL"      | [val per event]
//   Row 4:  field   → "Event Title"   | [val per event]
//   Row 5:  field   → "Subtitle"      | [val per event]
//   Row 6:  field   → "Detail Line 1" | [val per event]
//   Row 7:  field   → "Detail Line 2" | [val per event]
//   Row 8:  field   → "Description 1" | [val per event]
//   Row 9:  field   → "Description 2" | [val per event]
//   Row 10: field   → "CTA Text"      | [val per event]
//   Row 11: field   → "CTA URL"       | [val per event]

(function () {

  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmSmJVbA_aMnFqwrWFIW48J4hV38Ei-dMOcbiwMVGODzkTGRDCj1O5zeDCKn2KUQ/pub?output=csv&gid=575616754';
  var CONTAINER_ID = 'lag-community-events';

  // ── CSV Parser ──────────────────────────────────────────────────────────────
  function parseCSV(text) {
    var rows = [];
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var row = [];
      var field = '';
      var inQuotes = false;
      var line = lines[i];
      for (var j = 0; j < line.length; j++) {
        var ch = line[j];
        if (ch === '"') {
          if (inQuotes && line[j + 1] === '"') { field += '"'; j++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          row.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      row.push(field.trim());
      if (row.some(function (f) { return f !== ''; })) rows.push(row);
    }
    return rows;
  }

  // ── Transpose CSV into field map ────────────────────────────────────────────
  // Converts horizontal format (fields as rows) into a lookup by field name.
  // fieldMap["Event Title"] = ["Fuel Her Fire Auction Gala", "17th Annual...", ...]
  // Index 0 = Event 1, index 1 = Event 2, etc.
  function buildFieldMap(rows) {
    var map = {};
    for (var i = 1; i < rows.length; i++) { // skip header row
      var fieldName = rows[i][0] || '';
      if (fieldName) {
        map[fieldName] = rows[i].slice(1); // drop col A, keep event values
      }
    }
    return map;
  }

  // ── Event Block Builder ─────────────────────────────────────────────────────
  function buildEvent(fieldMap, eventIndex) {
    function get(field) {
      var vals = fieldMap[field];
      return (vals && vals[eventIndex]) ? vals[eventIndex].trim() : '';
    }

    var visibility = get('Visibility').toLowerCase();
    var logoUrl    = get('Logo URL');
    var title      = get('Event Title');
    var subtitle   = get('Subtitle');
    var detail1    = get('Detail Line 1');
    var detail2    = get('Detail Line 2');
    var desc1      = get('Description 1');
    var desc2      = get('Description 2');
    var ctaText    = get('CTA Text');
    var ctaUrl     = get('CTA URL');

    if (visibility === 'hide' || !title) return null;

    var logoHtml    = logoUrl  ? '<img src="' + logoUrl + '" class="acs-img-full-width acs-ma acs-event-logo" title="" alt="">' : '';
    var detail1Html = detail1  ? '<p class="acs-lh-4 acs-mb-1">' + detail1 + '</p>' : '';
    var detail2Html = detail2  ? '<p class="acs-lh-4 acs-mb-4">' + detail2 + '</p>' : '';
    var desc2Html   = desc2    ? '<p class="acs-lh-5 acs-mb-2">' + desc2   + '</p>' : '';
    var ctaHtml     = (ctaText && ctaUrl) ? '<p class="acs-mb-2 acs-lh-5"><a target="_blank" href="' + ctaUrl + '" class="acs-link-accent">' + ctaText + '</a></p>' : '';
    var subtitleClass = (!detail1 && !detail2)
      ? 'acs-accent acs-bold acs-lh-4 acs-large acs-mb-4'
      : 'acs-accent acs-bold acs-lh-4 acs-large';

    return [
      '<div class="acs-row acs-py-6 acs-align-items-center acs-justify-content-around">',
      '<div class="acs-four-md acs-four-lg acs-columns acs-py-3 acs-px-6 acs-text-center">',
      logoHtml,
      '</div>',
      '<div class="acs-eight-md acs-seven-2xl acs-columns acs-text-center-mobile acs-pt-2 acs-pb-5">',
      '<p class="acs-text-8 acs-text-9-md acs-lh-5 acs-bold">' + title    + '</p>',
      '<p class="' + subtitleClass + '">'                       + subtitle + '</p>',
      detail1Html,
      detail2Html,
      '<hr>',
      '<p class="acs-lh-5 acs-mb-2">' + desc1 + '</p>',
      desc2Html,
      ctaHtml,
      '</div>',
      '</div>'
    ].join('\n');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render(csvText) {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var rows = parseCSV(csvText);
    if (rows.length < 2) return;

    var fieldMap   = buildFieldMap(rows);
    var numEvents  = (rows[1] ? rows[1].length - 1 : 0); // total columns minus col A
    var blocks     = [];

    for (var i = 0; i < numEvents; i++) {
      var block = buildEvent(fieldMap, i);
      if (block) blocks.push(block);
    }

    var divider = '\n<div class="acs-my-4"><hr></div>\n';
    container.innerHTML = blocks.join(divider);
  }

  // ── Fetch ───────────────────────────────────────────────────────────────────
  function init() {
    if (!CSV_URL) {
      console.warn('[LAG Events] CSV_URL not set in lag-community-events.js');
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CSV_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        render(xhr.responseText);
      }
    };
    xhr.send();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
