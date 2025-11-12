// Cleaned RAT script - minimal: populate rental rates only

// ---------- CSV PARSER (keeps correct quoting rules) ----------
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false, row = [], cell = '';
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      // escaped quote
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r' || inQuotes) {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

// ---------- FETCH SINGLE CSV TAB & MERGE (simple) ----------
async function fetchAndMergeTabs(tabMap) {
  // tabMap: { tabName: csvUrl, ... } but we only expect one tab here
  const modelData = {};
  for (const [tabName, url] of Object.entries(tabMap)) {
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Fetch failed: ' + url);
      const text = await resp.text();
      const parsed = parseCSV(text);
      if (!parsed.length) continue;
      const [fields, ...dataRows] = parsed;

      // fields[0] is the label column, fields[1..] are model names
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
      console.error('Error fetching/processing tab:', tabName, err);
    }
  }
  return modelData;
}

// ---------- MAIN: update only rental rate fields ----------
async function updateRentalRatesFromSheet() {
  const csvTabs = {
    "RAT": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSvWP0ox7lKkUsCJHalW62EW-V5ht2kEZL-FxKyIx4_Zjav1MMbsxj2XEzPBPkQRvJ45rHErY-Soxdo/pub?output=csv&gid=0"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  // minimal mapping we actually need for the rentals section
  const textMap = {
    "model": "Model",
    "model-title": "Model Title",
    "day-price": "Price/Day",
    "week-price": "Price/Week",
    "feature-1": "Feature 1",
    "feature-2": "Feature 2",
    "feature-3": "Feature 3"
  };

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // if no data for that model, hide the section
    if (!data) {
      section.style.display = 'none';
      section.setAttribute('aria-hidden', 'true');
      return;
    }

    // populate text fields
    Object.entries(textMap).forEach(([className, key]) => {
      const val = data[key]?.value;
      if (val == null) return;
      const el = section.querySelector(`.${className}`);
      if (!el) return;
      el.textContent = val;
    });

    // handle offer image (src + alt)
    const imgEl = section.querySelector('.offer-image');
    const imgVal = data['Offer Image']?.value;
    if (imgEl && imgVal) {
      try {
        // ensure valid absolute URL when possible
        const url = new URL(imgVal, location.origin);
        imgEl.src = url.href;
      } catch {
        imgEl.src = imgVal;
      }
      imgEl.alt = data['Model Title']?.value || data['Model']?.value || '';
    } else if (imgEl) {
      // hide empty images gracefully
      imgEl.style.display = 'none';
    }

    // ensure visible if we populated something
    section.style.display = '';
    section.removeAttribute('aria-hidden');
  });
}

// ---------- BOOTSTRAP: wait for .car-offer elements ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) {
    updateRentalRatesFromSheet().catch(err => console.error('updateRentalRatesFromSheet error:', err));
  } else if (retries > 0) {
    setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  } else {
    console.warn('car-offer not found after retries — script aborted.');
  }
}
waitForOffersToLoad();
