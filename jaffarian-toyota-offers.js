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
async function fetchAndMergeTabs(tabMap) {
  const modelData = {};
  for (const [tabName, url] of Object.entries(tabMap)) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
      const parsed = parseCSV(await response.text());
      if (!parsed.length) continue;
      const [fields, ...dataRows] = parsed;
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
    "JT": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlYvLHwLTTHp0fsF6ndc2aCVN0DD8UpfsUV2TJToCx5K1We86QVgcsgCTcJLQLwU4ZAKVeT0YlDWyR/pub?output=csv"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  const textMap = {
    "model-title":   "Model Title",
    "offer-payment": "Offer Payment",
    "offer-term":    "Offer Term",
    "offer-detail-1":"Offer Detail 1",
    "offer-detail-2":"Offer Detail 2",
    "offer-detail-3":"Offer Detail 3",
    "cta-text":      "CTA Text",
    "disclaimer":    "Disclaimer"
  };

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // Hide entire card if no data or Visibility = hide
    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      return;
    }

    // Offer image
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      imgEl.alt = data["Model Title"]?.value || '';
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
