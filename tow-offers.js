/**
 * Toyota of Watertown — Dynamic Specials Insertion
 * Agile Creative Solutions
 *
 * GMCD-style: spreadsheet fields as rows, vehicle slots as columns.
 *   Row 1  : section title (ignored by parser)
 *   Row 2  : column headers — col A label | col B+ = slot names (Offer1, Offer2 …)
 *   Rows 3+: field rows — col A = field label, col B+ = value per slot
 *
 * Script tag attributes:
 *   data-csv-offer      — published CSV URL for the Offer Specials tab
 *   data-csv-certified  — published CSV URL for the Certified Used tab
 *
 * Injection targets in the HTML:
 *   #tow-offer-container
 *   #tow-certified-container
 */

(function () {
  var script = document.currentScript;
  var leaseUrl = script.getAttribute('data-csv-offer');
  var certUrl  = script.getAttribute('data-csv-certified');

  // ── CSV PARSER ─────────────────────────────────────────────────────────────
  // Transposed / GMCD-style: fields = rows, vehicles = columns
  //   Row 1  : title row (skipped)
  //   Row 2  : column headers (col B onward = slot names)
  //   Rows 3+: field rows — col A = label, col B+ = value per slot
  // Returns an array of objects, one per column (slot).
  function parseCSV(text) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 3) return [];

    var headerRow = splitLine(lines[1]);           // Row 2
    var numSlots  = headerRow.length - 1;          // everything after col A

    var slots = [];
    for (var i = 0; i < numSlots; i++) {
      slots.push({ _slot: (headerRow[i + 1] || ('Slot' + (i + 1))).trim() });
    }

    for (var r = 2; r < lines.length; r++) {       // Rows 3+
      var raw = lines[r].trim();
      if (!raw) continue;
      var vals  = splitLine(raw);
      var label = (vals[0] || '').trim();
      if (!label) continue;
      for (var c = 0; c < numSlots; c++) {
        slots[c][label] = (vals[c + 1] || '').trim();
      }
    }

    return slots;
  }

  function splitLine(line) {
    var result = [], cell = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"' && inQ && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cell); cell = ''; }
      else { cell += ch; }
    }
    result.push(cell);
    return result;
  }

  function isVisible(slot) {
    return (slot['Visibility'] || '').toLowerCase() !== 'hide';
  }
  // Visibility: leave blank to show, type HIDE to hide

  // ── OFFER CARD ─────────────────────────────────────────────────────────────
  function buildOfferCard(v) {
    var hidden = !isVisible(v) ? ' style="display:none"' : '';
    return [
      '<div class="acs-twelve acs-six-lg acs-columns acs-my-2"' + hidden + '>',
      '  <div class="acs-card">',
      '    <div class="acs-gradient acs-pb-6 acs-text-center">',
      '      <img src="' + v['Offer Image'] + '" class="acs-img-full-width acs-ma acs-car-cut" alt="" />',
      '    </div>',
      '    <div class="acs-px-2">',
      '      <h6 class="acs-text-9 acs-bold acs-text-center acs-mb-4 acs-lh-4">' + v['Model Title'] + '</h6>',
      '      <div class="acs-row acs-mt-4 acs-mb-4 acs-justify-content-center acs-align-self-center acs-text-center">',
      '        <div class="acs-six-lg acs-columns">',
      '          <p class="acs-text-5 acs-bold acs-accent">Offer:</p>',
      '          <p class="acs-text-9 acs-lh-3 acs-mb-2">' + v['Monthly Payment'] + '<span class="acs-text-4"><nobr>/MO.<sup>[1]</sup></nobr></span></p>',
      '          <p class="acs-text-4 acs-lh-3 acs-opacity-50 acs-mb-5">' + v['Due At Signing'] + ' due at signing</p>',
      '        </div>',
      '      </div>',
      '      <div class="acs-row acs-mt-5">',
      '        <div class="acs-twelve acs-columns">',
      '          <a href="' + v['Shop URL'] + '" class="acs-button acs-button-fw">Shop Now</a>',
      '        </div>',
      '      </div>',
      '      <hr>',
      '      <details closed class="acs-mb-5">',
      '        <summary class="acs-text-4 acs-text-center">Disclaimer</summary>',
      '        <p class="acs-text-3 acs-lh-5 acs-my-2 acs-opacity-50 acs-text-center"><sup>[1]</sup> ' + v['Disclaimer'] + '</p>',
      '      </details>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  // ── CERTIFIED USED CARD ────────────────────────────────────────────────────
  function buildCertifiedCard(v) {
    var hidden = !isVisible(v) ? ' style="display:none"' : '';
    return [
      '<div class="acs-twelve acs-six-lg acs-columns acs-my-2"' + hidden + '>',
      '  <div class="acs-card">',
      '    <img style="border-bottom: solid 8px rgba(0,0,0,.055)" src="' + v['Offer Image'] + '" class="acs-img-full-width" alt="' + (v['Image Alt'] || '') + '">',
      '    <div class="acs-p-6 acs-text-center">',
      '      <div class="acs-row">',
      '        <div class="acs-twelve acs-columns">',
      '          <p class="acs-h2 acs-bold acs-lh-5 acs-mt-2 acs-accent">' + v['APR'] + '</p>',
      '          <p class="acs-lh-4 acs-mb-2">' + v['Financing Label'] + '<br>' + v['Eligible Models'] + '</p>',
      '        </div>',
      '      </div>',
      '      <div class="acs-ten-md acs-twelve acs-ma">',
      '        <a href="' + v['Shop URL'] + '" class="acs-button acs-button-fw acs-mt-6">Shop Certified</a>',
      '        <a href="' + v['Why Certified URL'] + '" class="acs-button2 acs-button-fw acs-mt-6">Why Certified</a>',
      '        <p class="acs-text-3 acs-lh-5 acs-mt-4 acs-opacity-60">' + v['Disclaimer'] + '</p>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  // ── FETCH + INJECT ─────────────────────────────────────────────────────────
  function fetchAndBuild(csvUrl, buildFn) {
    return fetch(csvUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        return parseCSV(text).map(buildFn).join('\n');
      });
  }

  function init() {
    var container = document.getElementById('tow-offer-container');
    if (!container) return;

    var offerPromise = leaseUrl
      ? fetchAndBuild(leaseUrl, buildOfferCard)
      : Promise.resolve('');

    var certPromise = certUrl
      ? fetchAndBuild(certUrl, buildCertifiedCard)
      : Promise.resolve('');

    Promise.all([offerPromise, certPromise])
      .then(function (results) {
        container.innerHTML = results[0] + results[1];
      })
      .catch(function (err) {
        console.error('TOW Specials: failed to load —', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
