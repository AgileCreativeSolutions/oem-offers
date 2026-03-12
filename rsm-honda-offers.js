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

// ---------- CACHE CONFIG ----------
const CACHE_KEY = 'rsmh_offers_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ---------- PARSE CSV INTO MODEL DATA ----------
function parseSheetCSV(csv) {
  const modelData = {};
  const parsed = parseCSV(csv);
  if (!parsed.length) return modelData;
  const [fields, ...dataRows] = parsed;
  for (let col = 1; col < fields.length; col++) {
    const modelName = fields[col];
    if (!modelName) continue;
    modelData[modelName] = modelData[modelName] || {};
    for (const row of dataRows) {
      if (!row || row.length <= col) continue;
      const label = row[0];
      if (!label) continue;
      modelData[modelName][label] = row[col];
    }
  }
  return modelData;
}

// ---------- LOCALSTORAGE CACHE ----------
function getCachedSheet() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { csv, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null; // expired
    return parseSheetCSV(csv);
  } catch (e) {
    return null;
  }
}

// ---------- FETCH SHEET ----------
async function fetchSheet(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
    const csv = await response.text();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ csv, ts: Date.now() }));
    } catch (e) { /* storage full or unavailable — silently ignore */ }
    return parseSheetCSV(csv);
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return {};
  }
}

// ---------- HELPERS ----------
function isHide(val) {
  if (!val) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

function setText(el, value) { if (el) el.textContent = value || ''; }
function setHTML(el, value) {
  if (!el) return;
  // Convert [1] [2] [3] etc. to small superscripts
  el.innerHTML = (value || '').replace(/\[(\d+)\]/g, '<sup style="position: relative;font-size: 75%;line-height: 0;vertical-align: baseline;">[$1]</sup>');
}
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

// ---------- RENDER ----------
function renderOffers(modelData) {
  const anchorItems = [];

  document.querySelectorAll('.car-offer').forEach(section => {
    const key  = section.dataset.model;
    const data = modelData[key];

    if (!data || isHide(data['Visibility'])) {
      hide(section);
      return;
    }

    const anchorId    = data['Anchor ID'];
    const anchorLabel = data['Anchor Label'];
    if (anchorId) section.id = anchorId;
    if (anchorId && anchorLabel) anchorItems.push({ id: anchorId, label: anchorLabel });

    // Header
    setText(section.querySelector('.model-subtitle'), data['Model Subtitle']);
    setText(section.querySelector('.model-title'),    data['Model Title']);

    // Image
    const imgEl = section.querySelector('.offer-image');
    if (imgEl) {
      imgEl.src = data['Offer Image'] || '';
      imgEl.alt = data['Offer Image Alt'] || '';
    }

    // Offer columns
    [1, 2].forEach(n => {
      const colEl = section.querySelector(`.offer-${n}-col`);
      const label = data[`Offer ${n} Label`];
      const value = data[`Offer ${n} Value`];

      if (label || value) {
        show(colEl);
        setText(colEl.querySelector(`.offer-${n}-label`), label);
        setHTML(colEl.querySelector(`.offer-${n}-value`), value);
        const termEl = colEl.querySelector(`.offer-${n}-term`);
        if (termEl) { setText(termEl, data[`Offer ${n} Term`]); termEl.style.display = data[`Offer ${n} Term`] ? '' : 'none'; }

        if (n === 1) {
          const noteEl = colEl.querySelector('.offer-1-note');
          const vinsEl = colEl.querySelector('.offer-1-vins');
          if (noteEl) { setText(noteEl, data['Offer 1 Note']); noteEl.style.display = data['Offer 1 Note'] ? '' : 'none'; }
          if (vinsEl) { setText(vinsEl, data['Offer 1 VINs']); vinsEl.style.display = data['Offer 1 VINs'] ? '' : 'none'; }
        }
      } else {
        hide(colEl);
      }
    });

    // CTA
    const ctaEl = section.querySelector('.cta-link');
    if (ctaEl) {
      const ctaLink = data['CTA Link'];
      const ctaText = data['CTA Text'];
      if (!ctaLink || isHide(ctaLink)) {
        hide(ctaEl);
      } else {
        try {
          const url = new URL(ctaLink, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') ctaEl.href = url.href;
        } catch { ctaEl.href = ctaLink; }
        show(ctaEl);
      }
      const spanEl = ctaEl.querySelector('.cta-text');
      if (spanEl && ctaText) spanEl.textContent = ctaText;
    }

    // Disclaimers
    [1, 2, 3].forEach(n => {
      const el  = section.querySelector(`.disclaimer-${n}`);
      const val = data[`Disclaimer ${n}`];
      if (el) { setText(el, val); el.style.display = val ? '' : 'none'; }
    });
  });

  // Build anchor nav
  const navEl = document.getElementById('anchor-nav');
  if (navEl && anchorItems.length) {
    navEl.innerHTML = anchorItems.map((item, i) =>
      (i > 0 ? ' <span class="acs-px-1">|</span> ' : '') +
      `<a href="#${item.id}" class="acs-link-accent acs-nowrap">${item.label}</a>`
    ).join('');
  }
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjOz7LJ2VueuaLodKGKkkz-1gq1fc5Ww-_XXBpXCmFc9LmOwhvJ9ZxVqZXehz0I4aejhTap64_ftY2/pub?output=csv';

  // Render from cache immediately if available — no visible delay
  const cached = getCachedSheet();
  if (cached) renderOffers(cached);

  // Always fetch fresh data in the background and re-render
  const fresh = await fetchSheet(SHEET_URL);
  if (Object.keys(fresh).length) renderOffers(fresh);
}

// ---------- BOOTSTRAP ----------
function waitForOffers(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffers(retries - 1), 300);
  else console.warn('car-offer elements not found.');
}
waitForOffers();
