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

// ---------- FETCH SHEET ----------
async function fetchSheet(url) {
  const modelData = {};
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
    const parsed = parseCSV(await response.text());
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
  } catch (err) {
    console.error('Sheet fetch error:', err);
  }
  return modelData;
}

// ---------- HELPERS ----------
function isHide(val) {
  if (!val) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

function setText(section, selector, value) {
  const el = section.querySelector(selector);
  if (el) el.textContent = value || '';
}

function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpSc6q-axazVUnOMSmX6Pl2p1Y1bXPUXtoVqqYq6WlogWm2mLxQFWqiJ4huUIRk3Xh5d4t75g9FUTR/pub?output=csv';
  const modelData = await fetchSheet(SHEET_URL);

  document.querySelectorAll('.car-offer').forEach(section => {
    const key  = section.dataset.model;
    const data = modelData[key];

    // Hide entire card if no data or visibility = hide
    if (!data || isHide(data['Visibility'])) {
      hide(section);
      return;
    }

    // Model title & image
    setText(section, '.model-title', data['Model Title']);
    const imgEl = section.querySelector('.offer-image');
    if (imgEl) {
      imgEl.src = data['Offer Image'] || '';
      imgEl.alt = data['Offer Image Alt'] || '';
    }

    // Render each offer block (1, 2, 3)
    [1, 2, 3].forEach(n => {
      const label = data[`Offer ${n} Label`];
      const value = data[`Offer ${n} Value`];
      const block = section.querySelector(`.offer-${n}-block`);

      if (label || value) {
        show(block);
        setText(section, `.offer-${n}-label`, label);
        setText(section, `.offer-${n}-value`, value);
        setText(section, `.offer-${n}-term`,  data[`Offer ${n} Term`]);
        setText(section, `.offer-${n}-note`,  data[`Offer ${n} Note`]);
        const termEl = section.querySelector(`.offer-${n}-term`);
        const noteEl = section.querySelector(`.offer-${n}-note`);
        if (termEl) termEl.style.display = data[`Offer ${n} Term`] ? '' : 'none';
        if (noteEl) noteEl.style.display = data[`Offer ${n} Note`] ? '' : 'none';
      } else {
        hide(block);
      }
    });

    // Dividers — only show if both surrounding offers have content
    const hasOffer1 = !!(data['Offer 1 Label'] || data['Offer 1 Value']);
    const hasOffer2 = !!(data['Offer 2 Label'] || data['Offer 2 Value']);
    const hasOffer3 = !!(data['Offer 3 Label'] || data['Offer 3 Value']);

    const div12     = section.querySelector('.divider-1-2');
    const div23     = section.querySelector('.divider-2-3');
    const div12text = section.querySelector('.divider-1-2-text');
    const div23text = section.querySelector('.divider-2-3-text');

    if (hasOffer1 && hasOffer2 && !isHide(data['Divider 1-2'])) {
      show(div12);
      if (div12text) div12text.textContent = data['Divider 1-2'] || 'or';
    } else {
      hide(div12);
    }

    if (hasOffer2 && hasOffer3 && !isHide(data['Divider 2-3'])) {
      show(div23);
      if (div23text) div23text.textContent = data['Divider 2-3'] || 'or';
    } else {
      hide(div23);
    }

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
      if (el) {
        el.textContent     = val || '';
        el.style.display   = val ? '' : 'none';
      }
    });
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffers(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffers(retries - 1), 300);
  else console.warn('car-offer elements not found.');
}
waitForOffers();
