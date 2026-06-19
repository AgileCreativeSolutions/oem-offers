// ============================================================
// Kayser Chrysler Sauk City — Commercial Truck Specials
// Specials tab + Banner tab only (Manager Picks removed).
// Built on the VAGD multi-tab pattern.
// ============================================================

// ---------- CSV PARSER ----------
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false, row = [], cell = '';
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i], nextChar = csv[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') { cell += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' && !inQuotes) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r' || inQuotes) { cell += char; }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

// ---------- MERGE MULTIPLE SHEET TABS ----------
// Tabs merge into one modelData keyed by column header (KSC-Offer1..).
// Header is the row whose col A is "Field"; falls back to row 0 if none.
async function fetchAndMergeTabs(tabMap) {
  const modelData = {};
  const entries = Object.entries(tabMap);

  const results = await Promise.all(entries.map(async ([tabName, url]) => {
    try {
      const response = await fetch(url, { cache: 'default' });
      if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
      return { tabName, parsed: parseCSV(await response.text()) };
    } catch (err) {
      console.error(`Error processing ${tabName}:`, err);
      return { tabName, parsed: [] };
    }
  }));

  for (const { tabName, parsed } of results) {
    if (!parsed.length) continue;
    let headerIdx = parsed.findIndex(r => (r[0] || '').trim().toLowerCase() === 'field');
    if (headerIdx === -1) headerIdx = 0;
    const fields = parsed[headerIdx];
    const dataRows = parsed.slice(headerIdx + 1);
    for (let col = 1; col < fields.length; col++) {
      const modelName = fields[col];
      if (!modelName) continue;
      modelData[modelName] = modelData[modelName] || {};
      modelData[modelName].__tab = tabName;
      for (const row of dataRows) {
        if (!row || row.length <= col) continue;
        const label = row[0];
        if (!label) continue;
        modelData[modelName][label] = { value: row[col] };
      }
    }
  }
  return modelData;
}

// ---------- HELPERS ----------
function isHide(val) {
  if (val == null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

// ---------- FIELD MAPS ----------
// Per-offer sub-card hide toggles (Offer N Card = hide -> hide that column)
const SPECIALS_HIDE = {
  "Offer 1 Card": "offer-1-card",
  "Offer 2 Card": "offer-2-card",
  "Offer 3 Card": "offer-3-card",
  "Offer 4 Card": "offer-4-card"
};
// Text fields: card class -> sheet label
const SPECIALS_TEXT = {
  "stock-number": "Stock Number",
  "model-title": "Model Title",
  "trim-level": "Trim Level",
  "msrp": "Body Type",          // repurposed: upfit / body line (e.g. Knapheide Dump Truck)
  "offer-1-type": "Offer 1 Type",
  "offer-1-headline": "Offer 1 Headline",
  "offer-1-terms": "Offer 1 Terms",
  "offer-1-disclaimer": "Offer 1 Disclaimer",
  "offer-2-type": "Offer 2 Type",
  "offer-2-headline": "Offer 2 Headline",
  "offer-2-terms": "Offer 2 Terms",
  "offer-2-disclaimer": "Offer 2 Disclaimer",
  "offer-3-type": "Offer 3 Type",
  "offer-3-headline": "Offer 3 Headline",
  "offer-3-terms": "Offer 3 Terms",
  "offer-3-disclaimer": "Offer 3 Disclaimer",
  "offer-4-type": "Offer 4 Type",
  "offer-4-headline": "Offer 4 Headline",
  "offer-4-terms": "Offer 4 Terms",
  "offer-4-disclaimer": "Offer 4 Disclaimer",
  "shopping-link-text": "Shopping Link Text"
};
const SPECIALS_LINK = { "shopping-link": "Shopping Link" };

// ---------- SALES EVENT BANNER ----------
// Reads from the merged Banner tab (label/value: Field | Value),
// so fetchAndMergeTabs keys it under "Value": data["Desktop Image"].value, etc.
function renderSalesEventBanner(data) {
  const hero = document.querySelector('.sales-event-hero');
  if (!hero) return;
  if (!data) { hero.style.display = 'none'; return; }

  if (isHide(data['Visibility']?.value)) { hero.style.display = 'none'; return; }

  const desktop = data['Desktop Image']?.value;
  const mobile  = data['Mobile Image']?.value;
  const alt     = data['Alt Text']?.value || '';

  if (!desktop) { hero.style.display = 'none'; return; }

  const dSource = hero.querySelector('.hero-source-desktop');
  const mSource = hero.querySelector('.hero-source-mobile');
  const img     = hero.querySelector('.hero-img');

  if (dSource) dSource.setAttribute('srcset', desktop);
  if (mSource) mSource.setAttribute('srcset', mobile || desktop);
  if (img) { img.src = desktop; img.alt = alt; }

  hero.style.display = '';
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    "Specials": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRYXiYiBEu-wBZeN6mbrniIkfOL3BnHpg8ylri9FXAOZCAUYCHlLQFKcceCsLiqYNJuVs9xGV4Ikl/pub?output=csv",
    "Banner":   "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtRYXiYiBEu-wBZeN6mbrniIkfOL3BnHpg8ylri9FXAOZCAUYCHlLQFKcceCsLiqYNJuVs9xGV4Ikl/pub?output=csv&gid=51711727"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  const markLoaded = () => {
    document.querySelectorAll('.car-offer[data-ready="1"]').forEach(s => { s.style.display = ''; });
    document.querySelectorAll('#special-offers').forEach(el => el.classList.add('acs-loaded'));
  };

  try {
    renderAll(modelData);
  } finally {
    markLoaded();
  }
}

function renderAll(modelData) {

  // Hide every card inline up front (inline beats platform CSS); revealed at end.
  document.querySelectorAll('.car-offer').forEach(s => { s.style.display = 'none'; });

  // ----- Sales event hero banner (Banner tab, keyed under "Value") -----
  renderSalesEventBanner(modelData["Value"]);

  // ----- Section intro (first non-empty across Specials columns) -----
  function firstValueForTab(tab, label) {
    for (const key of Object.keys(modelData)) {
      if (modelData[key].__tab !== tab) continue;
      const v = modelData[key][label]?.value;
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  }
  const setSection = (attr, text) => {
    if (!text) return;
    document.querySelectorAll(`[data-section="${attr}"]`).forEach(el => { el.textContent = text; });
  };
  setSection('specials-headline', firstValueForTab('Specials', 'Section Headline'));
  setSection('specials-subhead',  firstValueForTab('Specials', 'Section Subhead'));

  // ----- Render each card -----
  let specialsHasVisible = false;

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;       // KSC-Offer1..15
    const data = modelData[modelKey];

    // Full-card visibility toggle (top-level hide)
    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      return;
    }

    // Identifying-field guard
    if (!(data["Model Title"]?.value || '').trim()) { section.style.display = "none"; return; }

    // Mark for reveal at the end; keep hidden during populate.
    section.dataset.ready = "1";

    // Offer image
    const imgEl = section.querySelector(".offer-image");
    if (imgEl && data["Offer Image"]?.value) {
      imgEl.src = data["Offer Image"].value;
      imgEl.alt = (data["Model Title"]?.value || '');
    }

    // Per-offer sub-card hide toggles
    Object.entries(SPECIALS_HIDE).forEach(([label, cls]) => {
      if (isHide(data[label]?.value)) { const el = section.querySelector(`.${cls}`); if (el) el.style.display = "none"; }
    });

    // Stock band: hide if no stock number
    const stockBand = section.querySelector('.stock-band');
    if (stockBand && !(data["Stock Number"]?.value || '').trim()) stockBand.style.display = "none";

    // Auto-hide each offer card (1-4) when it has no type AND no headline.
    // Offer 1 is the prominent price up top; 2-4 are stacked below.
    [1, 2, 3, 4].forEach(i => {
      const hasContent = (data[`Offer ${i} Type`]?.value || '').trim()
                      || (data[`Offer ${i} Headline`]?.value || '').trim();
      const el = section.querySelector(`.offer-${i}-card`);
      if (el && !hasContent) el.style.display = "none";
    });

    // Text fields
    Object.entries(SPECIALS_TEXT).forEach(([cls, key]) => {
      const val = data[key]?.value; if (val == null) return;
      const el = section.querySelector(`.${cls}`); if (el) el.textContent = val;
    });

    // Disclaimer dropdown: only show if at least one disclaimer field has text.
    const hasDisclaimer = ["Offer 1 Disclaimer", "Offer 2 Disclaimer", "Offer 3 Disclaimer", "Offer 4 Disclaimer"]
      .some(k => (data[k]?.value || '').trim());
    const details = section.querySelector('details');
    if (details) details.style.display = hasDisclaimer ? '' : 'none';

    // Shopping link
    Object.entries(SPECIALS_LINK).forEach(([cls, key]) => {
      const value = data[key]?.value; if (!value) return;
      try { const url = new URL(value, location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const el = section.querySelector(`.${cls}`); if (el) { el.href = url.href; el.style.display = "inline-block"; }
        }
      } catch {}
    });

    specialsHasVisible = true;
  });

  // ----- Auto-hide empty section + rebuild anchor nav -----
  if (specialsHasVisible) {
    document.querySelectorAll('[data-nav="links"]').forEach(el => {
      el.innerHTML = '<a href="#special-offers" class="kayser-brand-bd">COMMERCIAL&nbsp;TRUCK&nbsp;SPECIALS</a>';
    });
  } else {
    const w = document.querySelector('#special-offers')?.closest('.acs-wrapper');
    if (w) w.style.display = 'none';
  }
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  else console.warn("car-offer not found after retries — script aborted.");
}
waitForOffersToLoad();