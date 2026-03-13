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
async function fetchAndMergeTabs(tabMap) {
  const modelData = {};
  for (const [tabName, url] of Object.entries(tabMap)) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
      const parsed = parseCSV(await response.text());
      if (!parsed.length) continue;
      const [_title, fields, ...dataRows] = parsed; // row 1 is the title, row 2 is the model header
      for (let col = 1; col < fields.length; col++) {
        const modelName = fields[col];
        if (!modelName) continue;
        modelData[modelName] = modelData[modelName] || {};
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

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    // Publish each tab separately in Google Sheets:
    // File → Share → Publish to web → select tab → CSV → copy URL
    "Leases":    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSAJKgxkXiZ_X9w0Fh0ViMS3mLvATteQ0tSNtxVVuaZ2EsGJxv_lsZ9QgJN84tKYw/pub?output=csv",
    "Discounts": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSAJKgxkXiZ_X9w0Fh0ViMS3mLvATteQ0tSNtxVVuaZ2EsGJxv_lsZ9QgJN84tKYw/pub?output=csv&gid=669295447"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  // Rows that control visibility of whole sub-sections
  const hideMap = {
    "Offer 2 Card": "offer-2-col"
  };

  // Text fields: CSS class → Sheet row label
  const textMap = {
    "model-title-1":  "Model Title 1",
    "model-title-2":  "Model Title 2",
    "model-details":  "Model Details",
    "offer-1-price":  "Offer 1 Price",
    "offer-1-term":   "Offer 1 Term",
    "offer-1-note-1": "Offer 1 Note 1",
    "offer-1-note-2": "Offer 1 Note 2",
    "offer-2-price":  "Offer 2 Price",
    "offer-2-term":   "Offer 2 Term",
    "offer-2-note-1": "Offer 2 Note 1",
    "offer-2-note-2": "Offer 2 Note 2",
    "save-amount":    "Save Amount",
    "save-amount-2":  "Save Amount 2",
    "cta-text":       "CTA Text",
    "disclaimer":     "Disclaimer"
  };

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // Hide entire card if no data or Visibility = hide
    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      return;
    }

    // Hide sub-sections (e.g. second offer column)
    Object.entries(hideMap).forEach(([sheetRow, className]) => {
      const valueObj = data[sheetRow];
      if (valueObj && isHide(valueObj.value)) {
        const el = section.querySelector(`.${className}`);
        if (el) el.style.display = "none";
      }
    });

    // Offer image
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      imgEl.alt = data["Model Title 1"]?.value || '';
    }

    // Text fields
    Object.entries(textMap).forEach(([className, key]) => {
      const val = data[key]?.value;
      if (val == null) return;
      const el = section.querySelector(`.${className}`);
      if (el) el.textContent = val;
    });

    // CTA link
    const ctaLinkVal = data["CTA Link"]?.value;
    const ctaEl = section.querySelector('.cta-link');
    if (ctaEl) {
      if (!ctaLinkVal || isHide(ctaLinkVal)) {
        ctaEl.style.display = "none";
      } else {
        try {
          const url = new URL(ctaLinkVal, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            ctaEl.href = url.href;
            ctaEl.style.display = "inline-block";
          }
        } catch {}
      }
    }

    // Call For Details phone
    const phoneVal = data["Call For Details Phone"]?.value;
    const callEl = section.querySelector('.call-for-details');
    if (callEl) {
      if (phoneVal && !isHide(phoneVal)) {
        const digits = phoneVal.replace(/\D/g, '');
        callEl.href = `tel:+1${digits}`;
        callEl.style.display = "inline-block";
      } else {
        callEl.style.display = "none";
      }
    }
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  else console.warn("car-offer not found after retries — script aborted.");
}
waitForOffersToLoad();
