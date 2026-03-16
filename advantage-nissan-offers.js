/**
 * Advantage Nissan — Dynamic Specials Page
 * ACS | AgileCreativeSolutions.github.io/oem-offers/advantage-nissan/
 *
 * Page integration:
 *   1. Add id="anb-specials-nav" to the anchor links span inside .acs-anchors
 *   2. Add id="anb-specials" to the <div class="acs-row"> inside the specials wrapper
 *   3. Add <script src="URL_TO_THIS_FILE"></script> before </body>
 *
 * Spreadsheet layout (GMCD-style: fields as rows, vehicles as columns)
 *   Row 1  : Section title headers
 *   Row 2  : Vehicle column headers (B = Vehicle 1 ... P = Vehicle 15)
 *   Rows 3+: Field rows — one field per row, values across vehicle columns
 *
 *   Columns B–J  : Pre-filled vehicles (Rogue → Pathfinder)
 *   Columns K–P  : Reserve slots for future vehicles (leave blank or fill as needed)
 *
 * Field rows (column A label → what the script reads):
 *   Visibility | Offer Image | Model Title 1 | Model Title 2 | Model Details |
 *   Header Label 1 | Header Value 1 | Header Label 2 | Header Value 2 |
 *   Lease | Tab Label | Lease | Payment | Lease | Down | Lease | Down Label |
 *   Lease | Months | Lease | Miles |
 *   Zero Down | Tab Label | Zero Down | Payment | Zero Down | Months | Zero Down | Miles |
 *   Purchase | Tab Label | Purchase | Price | Purchase | Savings |
 *   Finance | Tab Label | Finance | APR | Finance | Term |
 *   CTA 1 Text | CTA 1 Link | CTA 2 Text | CTA 2 Link | Disclaimer
 *
 * Tab auto-detection:
 *   Lease tab appears   → if "Lease Payment" is populated
 *   $0 Down tab appears → if "Zero Down Payment" is populated
 *   Purchase tab appears → if "Purchase Price" is populated
 *   Finance tab appears  → if "Finance APR" is populated
 *   Any combination of 1–4 tabs is supported.
 *
 * Visibility:
 *   Leave blank or set to "show" to display the vehicle.
 *   Set to "hide" to suppress it without deleting the row.
 */

(function () {
  'use strict';

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  var CSV_URL        = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoGHVOcr2qW0yCwiSi1543JziWy5970jVJDXJnfvLZtBW10A7kAvjTMS9-TL_rK2jpR7_E8xSRBZBl/pub?output=csv';
  var NAV_CONTAINER  = 'anb-specials-nav';
  var CARD_CONTAINER = 'anb-specials';
  // ──────────────────────────────────────────────────────────────────────────


  // ─── CSV PARSER ───────────────────────────────────────────────────────────
  // GMCD-style sheet: fields as rows, vehicles as columns.
  //   Row 1  : section title (ignored)
  //   Row 2  : vehicle column headers  — col B onward
  //   Rows 3+: field rows — col A = label, col B+ = value per vehicle
  function parseCSV(text) {
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 3) return [];

    // Row 2 (index 1): vehicle column headers — col B onward
    var headerRow  = splitLine(lines[1]);
    var numVehicles = headerRow.length - 1; // subtract col A

    // Build one object per vehicle column
    var vehicles = [];
    for (var i = 0; i < numVehicles; i++) {
      vehicles.push({ _colHeader: (headerRow[i + 1] || '').trim() });
    }

    // Rows 3+ (index 2+): field rows — col A = label, col B+ = values
    for (var r = 2; r < lines.length; r++) {
      var raw = lines[r].trim();
      if (!raw) continue;
      var vals = splitLine(raw);
      var fieldLabel = (vals[0] || '').trim();
      if (!fieldLabel) continue;
      for (var c = 0; c < numVehicles; c++) {
        vehicles[c][fieldLabel] = (vals[c + 1] || '').trim();
      }
    }

    return vehicles;
  }

  function splitLine(line) {
    var result = [];
    var inQuote = false;
    var current = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        // Handle doubled quotes inside quoted fields
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }


  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function slug(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Returns a unique vehicle ID derived from Model Title 1 (e.g. "2026 Nissan ROGUE" → "2026-nissan-rogue")
  function vehicleId(r, index) {
    return slug(r['Model Title 1'] || r['_colHeader'] || ('vehicle-' + index));
  }


  // ─── TAB BUILDER ──────────────────────────────────────────────────────────
  function buildTabs(r, id) {
    // Collect which tabs are active
    var tabDefs = [];

    if (r['Lease | Payment']) {
      tabDefs.push({
        id:    id + '-lease-tab',
        label: r['Lease | Tab Label'] || 'Lease',
        type:  'lease'
      });
    }
    if (r['Zero Down | Payment']) {
      tabDefs.push({
        id:    id + '-zerdown-tab',
        label: r['Zero Down | Tab Label'] || '$0 Down Lease',
        type:  'zerdown'
      });
    }
    if (r['Purchase | Price']) {
      tabDefs.push({
        id:    id + '-purchase-tab',
        label: r['Purchase | Tab Label'] || 'Purchase',
        type:  'purchase'
      });
    }
    if (r['Finance | APR']) {
      tabDefs.push({
        id:    id + '-finance-tab',
        label: r['Finance | Tab Label'] || 'Finance',
        type:  'finance'
      });
    }

    if (!tabDefs.length) return '';

    var groupId = id + '-tab-group';

    // ── Tab navigation bar ──
    var navHtml;
    if (tabDefs.length === 1) {
      // Single offer — use non-interactive span
      navHtml = '<div class="acs-tabs clearfix acs-flex acs-justify-content-between">' +
        '<div class="acs-flex-fill"><span class="acs-one-tab">' + esc(tabDefs[0].label) + '</span></div>' +
        '</div>';
    } else {
      var tabLinks = tabDefs.map(function (t, i) {
        var activeClass = i === 0 ? ' class="active"' : '';
        return '<div class="acs-flex-fill">' +
          '<a href="#' + t.id + '"' + activeClass + '>' + esc(t.label) + '</a>' +
          '</div>';
      }).join('');
      navHtml = '<div class="acs-tabs clearfix acs-flex acs-justify-content-between" data-acstabgroup="' + groupId + '">' +
        tabLinks +
        '</div>';
    }

    // ── Tab panel content ──
    var panelHtml = tabDefs.map(function (t, i) {
      var hidden = i > 0 ? ' style="display:none"' : '';
      var inner  = buildTabContent(r, t.type);
      return '<div id="' + t.id + '" class="acs-tab-offer acs-fadein"' + hidden + '>' + inner + '</div>';
    }).join('');

    return '<div>' + navHtml + '</div>' +
      '<section id="' + groupId + '">' + panelHtml + '</section>';
  }

  function buildTabContent(r, type) {
    if (type === 'lease') {
      var stats = [];
      stats.push({ value: r['Lease | Payment'], label: 'A Month' });
      if (r['Lease | Down']) {
        stats.push({ value: r['Lease | Down'], label: r['Lease | Down Label'] || 'Cash or Trade Down' });
      }
      if (r['Lease | Months']) stats.push({ value: r['Lease | Months'], label: 'Months' });
      if (r['Lease | Miles'])  stats.push({ value: r['Lease | Miles'],  label: 'Miles/Year' });

      return '<div class="acs-row acs-twelve acs-pt-5 acs-justify-content-center">' +
        renderStatBoxes(stats) +
        '</div>';
    }

    if (type === 'zerdown') {
      var stats = [];
      stats.push({ value: r['Zero Down | Payment'], label: 'A Month' });
      if (r['Zero Down | Months']) stats.push({ value: r['Zero Down | Months'], label: 'Months' });
      if (r['Zero Down | Miles'])  stats.push({ value: r['Zero Down | Miles'],  label: 'Miles/Year' });

      return '<div class="acs-row acs-twelve acs-pt-5 acs-justify-content-center">' +
        renderStatBoxes(stats) +
        '</div>';
    }

    if (type === 'purchase') {
      var savings = r['Purchase | Savings']
        ? '<p class="acs-lh-5 acs-text-5">' + esc(r['Purchase | Savings']) + '</p>'
        : '';
      return '<div class="acs-pt-5">' +
        '<p class="acs-text-7 acs-text-10-md acs-lh-2 acs-black acs-mb-1">' + esc(r['Purchase | Price']) + '</p>' +
        savings +
        '</div>';
    }

    if (type === 'finance') {
      var term = r['Finance | Term']
        ? '<p class="acs-lh-5 acs-text-5">' + esc(r['Finance | Term']) + '</p>'
        : '';
      return '<div class="acs-pt-5">' +
        '<p class="acs-text-7 acs-text-10-md acs-lh-2 acs-black acs-mb-1">' + esc(r['Finance | APR']) + '</p>' +
        term +
        '</div>';
    }

    return '';
  }

  // Renders an array of {value, label} as bordered stat boxes.
  // Last item has no right border.
  function renderStatBoxes(stats) {
    return stats.map(function (s, i) {
      var border = i < stats.length - 1 ? ' acs-offer-border' : '';
      return '<div class="acs-three-sm acs-twelve acs-columns' + border + '">' +
        '<p class="acs-text-7 acs-text-10-md acs-lh-2 acs-black acs-mb-4 acs-offer">' + esc(s.value) + '</p>' +
        '<p class="acs-lh-3 acs-text-4">' + esc(s.label) + '</p>' +
        '</div>';
    }).join('');
  }


  // ─── CARD BUILDER ─────────────────────────────────────────────────────────
  function buildCard(r, index) {
    var id       = vehicleId(r, index);
    var title1   = r['Model Title 1'] || '';
    var title2   = r['Model Title 2'] || '';
    var details  = r['Model Details']  || '';

    // Right-side price labels
    var priceHtml = '';
    if (r['Header Label 1'] && r['Header Value 1']) {
      priceHtml += '<p><strong class="acs-bold">' + esc(r['Header Label 1']) + ':</strong> ' + esc(r['Header Value 1']) + '</p>';
    }
    if (r['Header Label 2'] && r['Header Value 2']) {
      priceHtml += '<p><strong class="acs-bold">' + esc(r['Header Label 2']) + ':</strong> ' + esc(r['Header Value 2']) + '</p>';
    }
    var priceCol = priceHtml
      ? '<div class="acs-six-md acs-columns acs-my-1 acs-text-right-md acs-text-5 acs-lh-5"><div class="acs-columns">' + priceHtml + '</div></div>'
      : '';

    // CTA buttons
    var cta1Label = r['CTA 1 Text'] || 'Get This Special';
    var cta1URL   = r['CTA 1 Link'] || '/special-contact-form';
    var cta2Label = r['CTA 2 Text'] || 'View Inventory';
    var cta2URL   = r['CTA 2 Link'] || '/new-vehicles/';

    // Disclaimer
    var disclaimer = r['Disclaimer']
      ? '<div class="acs-row acs-p-3">' +
          '<div class="acs-twelve acs-mb-2">' +
            '<div class="acs-new-disclaimer">' +
              '<p>' + esc(r['Disclaimer']) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '';

    var tabHtml = buildTabs(r, id);

    return '<div class="acs-twelve acs-six-2xl acs-columns">' +
      '<div id="' + id + '" class="acs-row acs-mb-8">' +
        '<div class="acs-twelve">' +
          '<div class="acs-offer-cell">' +

            // Header row
            '<div class="acs-row">' +
              '<div class="acs-twelve acs-columns acs-pt-8">' +
                '<div class="acs-row">' +
                  '<p class="acs-text-9 acs-mb-4 acs-px-4 acs-twelve">New <strong class="acs-bold">' + esc(title1) + '</strong> ' + esc(title2) + '</p>' +
                  '<div class="acs-six-md acs-columns acs-my-1">' +
                    '<p class="acs-text-5 acs-lh-5 acs-opacity-50">' + esc(details) + '</p>' +
                  '</div>' +
                  priceCol +
                '</div>' +
                '<hr style="margin-bottom:0px;">' +
              '</div>' +
            '</div>' +

            // Image + tabs + buttons
            '<div class="acs-row acs-flex-row-reverse-lg acs-text-center acs-align-items-center">' +
              '<div class="acs-twelve acs-px-3 acs-pb-3">' +
                '<img src="' + esc(r['Offer Image'] || '') + '" class="acs-img-full-width" title="Advantage Nissan Specials" alt="">' +
              '</div>' +
              '<div class="acs-twelve acs-columns acs-mt-2">' +
                tabHtml +
                '<div class="acs-row acs-mt-2 acs-px-2">' +
                  '<div class="acs-twelve acs-p-2">' +
                    '<a href="' + esc(cta1URL) + '" class="acs-button acs-button-fw acs-nissan-icon">' + esc(cta1Label) + '</a>' +
                  '</div>' +
                  '<div class="acs-twelve acs-p-2">' +
                    '<a href="' + esc(cta2URL) + '" class="acs-button3 acs-button-fw acs-nissan-icon">' + esc(cta2Label) + '</a>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            disclaimer +

          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }


  // ─── ANCHOR NAV BUILDER ───────────────────────────────────────────────────
  function buildNav(rows) {
    return rows.map(function (r, i) {
      var id    = vehicleId(r, i);
      var label = r['Nav Label'] || r['Model Title 1'] || r['_colHeader'] || '';
      return '<a data-smooth-scroll="" href="#' + id + '">' + esc(label) + '</a>';
    }).join(' |\n');
  }


  // ─── TAB INTERACTIONS ─────────────────────────────────────────────────────
  // Uses event delegation on the cards container so it works with dynamic HTML.
  function initTabs(container) {
    container.addEventListener('click', function (e) {
      var link = e.target;
      if (link.tagName !== 'A') return;

      // Only intercept clicks on .acs-tabs links
      var tabsEl = link.parentElement && link.parentElement.parentElement;
      if (!tabsEl || !tabsEl.hasAttribute('data-acstabgroup')) return;

      e.preventDefault();

      var groupId = tabsEl.getAttribute('data-acstabgroup');
      var section = document.getElementById(groupId);
      if (!section) return;

      // Update active tab
      var allLinks = tabsEl.querySelectorAll('a');
      for (var i = 0; i < allLinks.length; i++) {
        allLinks[i].classList.remove('active');
      }
      link.classList.add('active');

      // Show/hide panels
      var panels = section.querySelectorAll('.acs-tab-offer');
      for (var j = 0; j < panels.length; j++) {
        panels[j].style.display = 'none';
      }
      var targetId = link.getAttribute('href').replace(/^#/, '');
      var target = document.getElementById(targetId);
      if (target) target.style.display = '';
    });
  }


  // ─── MAIN ─────────────────────────────────────────────────────────────────
  function init() {
    var cardsEl = document.getElementById(CARD_CONTAINER);
    if (!cardsEl) {
      console.warn('ANB Specials: container #' + CARD_CONTAINER + ' not found.');
      return;
    }

    fetch(CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var allRows = parseCSV(text);

        // Filter: skip empty reserve columns and any explicitly hidden
        var rows = allRows.filter(function (r) {
          if (!r['Model Title 1'] && !r['Offer Image']) return false; // blank reserve column
          var v = (r['Visibility'] || '').toLowerCase();
          return v !== 'hide';
        });

        if (!rows.length) return;

        // Render cards
        cardsEl.innerHTML = rows.map(buildCard).join('\n');

        // Render anchor nav (if container exists)
        var navEl = document.getElementById(NAV_CONTAINER);
        if (navEl) navEl.innerHTML = buildNav(rows);

        // Wire up tab clicks
        initTabs(cardsEl);
      })
      .catch(function (err) {
        console.error('ANB Specials: failed to load specials data.', err);
      });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
