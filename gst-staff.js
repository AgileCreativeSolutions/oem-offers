/* ============================================================
   Gettel Stadium Toyota — Dynamic Staff Page
   Banded layout: each department band has a [data-staff-dept]
   mount point. Static cards (e.g., hardcoded Rocky) coexist
   with dynamically rendered cards inside the same .acs-row.
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONFIG
     ============================================================ */

  var SHEET_ID = '2PACX-1vSo_SwEjJn717GKAOPCJU2yNHPz6lAzMTw2LdKgW38Dh30VkuklIgNS2fjWjhXGjxhCBECA8ws4yXhv';

  var DEPARTMENTS = [
    { key: 'management',     gid: '1097921844' },
    { key: 'service',        gid: '441113284'  },
    { key: 'parts',          gid: '1066926806' },
    { key: 'finance',        gid: '1357529768' },
    { key: 'administrative', gid: '677755646'  }
  ];

  // Placeholder cards shown per band while its CSV is loading.
  var SKELETON_COUNT = 4;

  // Background classes applied in rotation to visible bands, top-down.
  // Edit this array to change the palette (e.g., add a third color
  // for a three-band rotation). Order = top band gets index 0.
  var BAND_BG_CLASSES = ['acs-bg-gray', 'acs-bg-white'];


  /* ============================================================
     CSV PARSER — character-by-character, handles quoted fields
     with embedded commas, newlines, and escaped quotes.
     ============================================================ */

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

    while (i < text.length) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++;
        } else { field += c; i++; }
      } else {
        if (c === '"') { inQuotes = true; i++; }
        else if (c === ',') { row.push(field); field = ''; i++; }
        else if (c === '\n' || c === '\r') {
          row.push(field); field = '';
          rows.push(row); row = [];
          if (c === '\r' && text[i + 1] === '\n') i += 2;
          else i++;
        } else { field += c; i++; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function rowsToObjects(rows) {
    if (rows.length < 2) return [];
    var headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, idx) {
        obj[h] = (row[idx] || '').trim();
      });
      return obj;
    });
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function csvUrl(gid) {
    return 'https://docs.google.com/spreadsheets/d/e/' + SHEET_ID +
           '/pub?gid=' + gid + '&single=true&output=csv';
  }

  // Reject phantom rows (deleted rows sometimes publish blank).
  function isValidPerson(p) { return p && p.name && p.name.length > 0; }

  // Detect the Gettel placeholder photo (used when a real staff photo
  // isn't available yet). Cards using it render with acs-bg-gray so the
  // red logo sits on a gray block, matching the original page treatment.
  function isPlaceholderPhoto(url) {
    return /gettel-staff-generic/i.test(url);
  }

  function sortPeople(people) {
    return people
      .map(function (p, idx) {
        return {
          p: p, idx: idx,
          order: p.order ? parseFloat(p.order) : Number.POSITIVE_INFINITY
        };
      })
      .sort(function (a, b) {
        if (a.order !== b.order) return a.order - b.order;
        return a.idx - b.idx;
      })
      .map(function (x) { return x.p; });
  }


  /* ============================================================
     RENDER
     ============================================================ */

  function renderCard(p) {
    var name       = escapeHtml(p.name);
    var title      = escapeHtml(p.title || '');
    var photo      = escapeHtml(p['photo url'] || '');
    var hover      = (p['hover image url'] || '').trim();
    var contactUrl = (p['contact url'] || '').trim();
    var imgTitle   = title ? (p.name + ' - ' + p.title) : p.name;

    var mediaHtml = hover
      ? '<div class="img-swap" style="background-image: url(\'' + escapeHtml(hover) + '\')">' +
          '<img src="' + photo + '" class="acs-img-full-width" ' +
               'title="' + escapeHtml(imgTitle) + '" ' +
               'alt="' + name + ' Employee Photo">' +
        '</div>'
      : '<div class="acs-twelve' + (isPlaceholderPhoto(photo) ? ' acs-bg-gray' : '') + '">' +
          '<img src="' + photo + '" class="acs-img-full-width" ' +
               'title="' + escapeHtml(imgTitle) + '" ' +
               'alt="' + name + ' Employee Photo">' +
        '</div>';

    var contactHtml = contactUrl
      ? '<p class="acs-lh-5 acs-accent5 toyota-brand-sb">' +
          '<a href="' + escapeHtml(contactUrl) + '" class="acs-link-accent">' +
            '<span class="acs-hover-underline-animation">Contact Us ' +
              '<i class="fa fa-chevron-right"></i>' +
            '</span>' +
          '</a>' +
        '</p>'
      : '';

    return '' +
      '<div class="acs-six-sm acs-three-lg acs-p-2 acs-text-center">' +
        mediaHtml +
        '<p class="acs-h5 acs-mt-3">' + name + '</p>' +
        '<p class="acs-lh-5 acs-mb-2">' + title + '</p>' +
        contactHtml +
      '</div>';
  }

  function renderSkeleton(count) {
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '' +
        '<div class="acs-six-sm acs-three-lg acs-p-2 acs-text-center staff-skeleton">' +
          '<div class="staff-skel-img"></div>' +
          '<div class="staff-skel-line staff-skel-line-name"></div>' +
          '<div class="staff-skel-line staff-skel-line-title"></div>' +
        '</div>';
    }
    return html;
  }


  /* ============================================================
     MOUNT FLOW
     - Render skeleton on init
     - Replace with cards when CSV resolves
     - If a band ends up with NO cards (static or dynamic), hide
       the entire band wrapper. Bands with static cards (Rocky
       in Management) stay visible regardless.
     ============================================================ */

  function getMount(key) {
    return document.querySelector('[data-staff-dept="' + key + '"]');
  }

  function fillSkeleton(mount) {
    mount.innerHTML = renderSkeleton(SKELETON_COUNT);
  }

  function fillData(mount, people) {
    if (people.length) {
      mount.innerHTML = people.map(renderCard).join('');
      return;
    }
    mount.innerHTML = '';

    // If no static cards exist in this band's grid row, hide the band.
    var row = mount.parentElement; // .acs-row
    var hasStatic = row && row.querySelector('.acs-six-sm:not(.staff-skeleton)');
    if (!hasStatic) {
      var band = mount.closest('.acs-wrapper');
      if (band) band.style.display = 'none';
    }
  }

  function loadDepartment(dept) {
    var mount = getMount(dept.key);
    if (!mount) return Promise.resolve();
    fillSkeleton(mount);

    return fetch(csvUrl(dept.gid), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        var people = sortPeople(rowsToObjects(rows).filter(isValidPerson));
        fillData(mount, people);
      })
      .catch(function (err) {
        console.error('[staff] failed to load ' + dept.key + ':', err);
        fillData(mount, []);
      });
  }


  /* ============================================================
     BAND BACKGROUND ALTERNATION
     Apply BAND_BG_CLASSES in rotation to every band that's
     currently visible. Re-runs after fetches settle so any
     auto-hidden empty band drops out of the rotation.
     ============================================================ */

  function applyBandAlternation() {
    var bands = DEPARTMENTS
      .map(function (d) {
        var m = getMount(d.key);
        return m ? m.closest('.acs-wrapper') : null;
      })
      .filter(function (b) { return b && b.style.display !== 'none'; });

    bands.forEach(function (band, idx) {
      // Strip any classes from BAND_BG_CLASSES, then add the one for this slot.
      BAND_BG_CLASSES.forEach(function (cls) { band.classList.remove(cls); });
      band.classList.add(BAND_BG_CLASSES[idx % BAND_BG_CLASSES.length]);
    });
  }


  /* ============================================================
     INIT
     ============================================================ */

  function init() {
    // Set initial alternation based on starting visibility so the
    // first paint has correct colors before any fetch resolves.
    applyBandAlternation();

    // After all departments finish loading (and any auto-hide
    // decisions settle), re-alternate among the remaining visible bands.
    Promise.all(DEPARTMENTS.map(loadDepartment))
      .then(applyBandAlternation);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
