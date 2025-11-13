// ---------- CSV PARSER ----------
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false,
      row = [],
      cell = '';

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
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

// ---------- FETCH SINGLE SHEET ----------
async function fetchSheetModels(url) {
  const modelData = {};

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch: ${url}`);

  const parsed = parseCSV(await response.text());
  if (!parsed.length) return modelData;

  const [fields, ...dataRows] = parsed;

  // columns = models, rows = labels
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

  return modelData;
}

// ---------- HELPERS ----------
function isHide(val) {
  if (val == null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

// ---------- MAIN ----------
async function updateExclusiveOffers() {
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQvG-VlC2NZDhLQrZsEOW2Z4VIrhbZibqq8LrGEnefI_H8Ri7weiyB0H-66Rf3SIzo-8uFxQXQBPhp8/pub?output=csv&gid=0";

  let modelData = {};
  try {
    modelData = await fetchSheetModels(csvUrl);
  } catch (err) {
    console.error("Error loading offers sheet:", err);
    return;
  }

  // Only the fields actually used by the Exclusive Offers banner
  const textMap = {
    "vehicle-detail-1": "Vehicle Detail 1",
    "vehicle-detail-2": "Vehicle Detail 2",
    "vehicle-detail-3": "Vehicle Detail 3",
    "offer-detail-1": "Offer Detail 1",
    "offer-detail-2": "Offer Detail 2",
    "offer-detail-3": "Offer Detail 3",
    "offer-detail-4": "Offer Detail 4",
    "offer-detail-5": "Offer Detail 5",
    "disclaimer": "Disclaimer",
    "cta-text": "CTA Text"
  };

  document.querySelectorAll('.psb-exclusive-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // No data for this offer → hide the card
    if (!data || isHide(data["Visibility"]?.value)) {
      section.style.display = "none";
      section.setAttribute("aria-hidden", "true");
      return;
    }

    // Image
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      // use the main vehicle headline for alt text if present
      imgEl.alt = data["Vehicle Detail 1"]?.value || '';
    }

    // Text content
    Object.entries(textMap).forEach(([className, key]) => {
      const val = data[key]?.value;
      if (val == null) return;
      const el = section.querySelector(`.${className}`);
      if (el) el.textContent = val;
    });

    // CTA link (Shopping URL)
    const ctaEl = section.querySelector('.shopping-link');
    if (ctaEl) {
      const rawUrl = data["CTA Link"]?.value;

      if (rawUrl) {
        try {
          const url = new URL(rawUrl, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            ctaEl.href = url.href;
          }
        } catch (e) {
          console.warn("Invalid CTA Link for model", modelKey, rawUrl);
        }
      }
    }
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.psb-exclusive-offer')) {
    updateExclusiveOffers();
  } else if (retries > 0) {
    setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  } else {
    console.warn("psb-exclusive-offer not found after retries — script aborted.");
  }
}

waitForOffersToLoad();
