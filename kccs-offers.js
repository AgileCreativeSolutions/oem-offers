// ============================================================
// Kayser Chrysler Sauk City — Specials + Manager Picks
// Built on the Village Denver (VAGD) multi-tab pattern.
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
// Both tabs merge into one modelData keyed by column header
// (KSC-Offer1.., Disc1..). Header is the row whose col A is "Field";
// falls back to row 0 if there's no title row.
async function fetchAndMergeTabs(tabMap) {
  const modelData = {};
  for (const [tabName, url] of Object.entries(tabMap)) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
      const parsed = parseCSV(await response.text());
      if (!parsed.length) continue;
      let headerIdx = parsed.findIndex(r => (r[0] || '').trim().toLowerCase() === 'field');
      if (headerIdx === -1) headerIdx = 0;
      const fields = parsed[headerIdx];
      const dataRows = parsed.slice(headerIdx + 1);
      for (let col = 1; col < fields.length; col++) {
        const modelName = fields[col];
        if (!modelName) continue;
        modelData[modelName] = modelData[modelName] || {};
        // Stash which tab this column came from, for section intros
        modelData[modelName].__tab = tabName;
        for (const row of dataRows) {
          if (!row || row.length <= col) continue;
          const label = row[0];
          if (!label) continue;
          modelData[modelName][label] = { value: row[col] };
        }
      }
    } catch (err) {
      console.error(`Error processing ${tabName}:`, err);
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
const SPECIALS_HIDE = {
  "Offer 1 Card": "offer-1-card",
  "Offer 2 Card": "offer-2-card",
  "Offer 3 Card": "offer-3-card",
  "Offer 4 Card": "offer-4-card"
};
const SPECIALS_TEXT = {
  "model-title": "Model Title",
  "trim-level": "Trim Level",
  "msrp": "MSRP",
  "savings": "Savings",
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
  "shopping-link-text": "Shopping Link Text",
  "tagline": "Tagline"
};
const SPECIALS_LINK = { "shopping-link": "Shopping Link" };

const MANAGER_TEXT = {
  "model-title-1": "Model Title 1",
  "model-title-2": "Model Title 2",
  "model-details": "Model Details",
  "save-amount": "Save Amount",
  "save-amount-2": "Save Amount 2",
  "cta-text": "CTA Text",
  "disclaimer": "Disclaimer"
};

// ---------- SALES EVENT BANNER ----------
// Reads from the merged Banner tab. That tab is label/value (Field | Value),
// so fetchAndMergeTabs keys it under "Value": data["Desktop Image"].value, etc.
function renderSalesEventBanner(data) {
  const hero = document.querySelector('.sales-event-hero');
  if (!hero) return;
  if (!data) { hero.style.display = 'none'; return; }

  // Visibility toggle
  if (isHide(data['Visibility']?.value)) { hero.style.display = 'none'; return; }

  const desktop = data['Desktop Image']?.value;
  const mobile  = data['Mobile Image']?.value;
  const alt     = data['Alt Text']?.value || '';

  // Need at least a desktop image to show anything
  if (!desktop) { hero.style.display = 'none'; return; }

  const dSource = hero.querySelector('.hero-source-desktop');
  const mSource = hero.querySelector('.hero-source-mobile');
  const img     = hero.querySelector('.hero-img');

  if (dSource) dSource.setAttribute('srcset', desktop);
  // Fall back to desktop image if no separate mobile image provided
  if (mSource) mSource.setAttribute('srcset', mobile || desktop);
  if (img) { img.src = desktop; img.alt = alt; }

  hero.style.display = '';
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    "Specials": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCPBN4WLotXZGpf_pAoTMjODOhWl-w1xmNbuR109DRAu2prKROULE4Fj-T9WMSDiQZuSHuKl8JhhhY/pub?output=csv&gid=0",
    "Manager":  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCPBN4WLotXZGpf_pAoTMjODOhWl-w1xmNbuR109DRAu2prKROULE4Fj-T9WMSDiQZuSHuKl8JhhhY/pub?output=csv&gid=99914050",
    "Banner":   "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCPBN4WLotXZGpf_pAoTMjODOhWl-w1xmNbuR109DRAu2prKROULE4Fj-T9WMSDiQZuSHuKl8JhhhY/pub?output=csv&gid=1799088364"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  const markLoaded = () => {
    document.querySelectorAll('#special-offers, #manager-picks').forEach(el => el.classList.add('acs-loaded'));
  };

  try {
    renderAll(modelData);
    // Wait for the populated offer images to finish loading before revealing,
    // so cards never appear with empty image boxes (the blank-card flash on
    // slower platforms). Cap the wait so a slow/broken image can't stall the
    // reveal indefinitely.
    await waitForImages(['#special-offers', '#manager-picks'], 2000);
  } finally {
    markLoaded();
  }
}

// Resolve once all <img> inside the given selectors are loaded (or errored),
// or once timeoutMs elapses — whichever comes first.
function waitForImages(selectors, timeoutMs) {
  return new Promise(resolve => {
    const imgs = [];
    selectors.forEach(sel => {
      const root = document.querySelector(sel);
      if (root) root.querySelectorAll('img').forEach(img => imgs.push(img));
    });
    const pending = imgs.filter(img => img.src && !img.complete);
    if (!pending.length) { resolve(); return; }

    let done = 0, finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    const tick = () => { if (++done >= pending.length) finish(); };
    pending.forEach(img => {
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    });
    setTimeout(finish, timeoutMs);
  });
}

function renderAll(modelData) {

  // ----- Sales event hero banner (merged from Banner tab, keyed under "Value") -----
  renderSalesEventBanner(modelData["Value"]);

  // ----- Section intros + page tagline (read first non-empty across all columns) -----
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
  setSection('manager-headline',  firstValueForTab('Manager', 'Section Headline'));
  setSection('manager-subhead',   firstValueForTab('Manager', 'Section Subhead'));

  const taglineText = firstValueForTab('Specials', 'Tagline');
  document.querySelectorAll('.tagline').forEach(el => {
    if (!el.closest('.car-offer') && taglineText) el.textContent = taglineText;
  });

  // ----- Render each card -----
  const sectionHasVisible = { 'special-offers': false, 'manager-picks': false };

  document.querySelectorAll('.car-offer').forEach(section => {
    const source = section.dataset.source;       // "specials" | "manager"
    const modelKey = section.dataset.model;       // KSC-Offer1.. | Disc1..
    const data = modelData[modelKey];

    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      return;
    }

    // Identifying-field guard
    if (source === "specials" && !(data["Model Title"]?.value || '').trim()) { section.style.display = "none"; return; }
    if (source === "manager"  && !(data["Model Title 1"]?.value || '').trim()) { section.style.display = "none"; return; }

    section.style.display = "";

    // Offer image
    const imgEl = section.querySelector(".offer-image");
    if (imgEl && data["Offer Image"]?.value) {
      imgEl.src = data["Offer Image"].value;
      imgEl.alt = (data["Model Title"]?.value || data["Model Title 1"]?.value || '');
    }

    if (source === "specials") {
      Object.entries(SPECIALS_HIDE).forEach(([label, cls]) => {
        if (isHide(data[label]?.value)) { const el = section.querySelector(`.${cls}`); if (el) el.style.display = "none"; }
      });
      // savings band: hide if empty
      const band = section.querySelector('.savings-band');
      if (band && !(data["Savings"]?.value || '').trim()) band.style.display = "none";

      Object.entries(SPECIALS_TEXT).forEach(([cls, key]) => {
        const val = data[key]?.value; if (val == null) return;
        const el = section.querySelector(`.${cls}`); if (el) el.textContent = val;
      });
      Object.entries(SPECIALS_LINK).forEach(([cls, key]) => {
        const value = data[key]?.value; if (!value) return;
        try { const url = new URL(value, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            const el = section.querySelector(`.${cls}`); if (el) { el.href = url.href; el.style.display = "inline-block"; }
          }
        } catch {}
      });
    } else if (source === "manager") {
      Object.entries(MANAGER_TEXT).forEach(([cls, key]) => {
        const val = data[key]?.value; if (val == null) return;
        const el = section.querySelector(`.${cls}`); if (el) el.textContent = val;
      });
      // CTA link
      const ctaVal = data["CTA Link"]?.value;
      const ctaEl = section.querySelector('.cta-link');
      if (ctaEl) {
        if (!ctaVal || isHide(ctaVal)) { ctaEl.style.display = "none"; }
        else { try { const url = new URL(ctaVal, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') { ctaEl.href = url.href; ctaEl.style.display = "inline-block"; }
        } catch {} }
      }
      // Call for details
      const phoneVal = data["Call For Details Phone"]?.value;
      const callEl = section.querySelector('.call-for-details');
      if (callEl) {
        if (phoneVal && !isHide(phoneVal)) { callEl.href = `tel:+1${phoneVal.replace(/\D/g, '')}`; callEl.style.display = "inline-block"; }
        else { callEl.style.display = "none"; }
      }
    }

    const wrap = section.closest('#special-offers') ? 'special-offers'
               : section.closest('#manager-picks') ? 'manager-picks' : null;
    if (wrap) sectionHasVisible[wrap] = true;
  });

  // ----- Auto-hide empty sections + rebuild anchor nav -----
  const navParts = [];
  if (sectionHasVisible['special-offers']) navParts.push('<a href="#special-offers" class="kayser-brand-bd">SPECIAL&nbsp;OFFERS</a>');
  else { const w = document.querySelector('#special-offers')?.closest('.acs-wrapper'); if (w) w.style.display = 'none'; }
  if (sectionHasVisible['manager-picks']) navParts.push('<a href="#manager-picks" class="kayser-brand-bd">MANAGER&nbsp;PICKS</a>');
  else { const w = document.querySelector('#manager-picks')?.closest('.acs-wrapper'); if (w) w.style.display = 'none'; }
  if (navParts.length) {
    const navHTML = navParts.join(' | ');
    document.querySelectorAll('[data-nav="links"]').forEach(el => { el.innerHTML = navHTML; });
  }
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  else console.warn("car-offer not found after retries — script aborted.");
}
waitForOffersToLoad();
