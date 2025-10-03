// ---------- CSV PARSER ----------
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false, row = [], cell = '';

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"'; i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim()); cell = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

// ---------- MERGE MULTIPLE SHEET TABS ----------
async function fetchAndMergeTabs(tabMap) {
  const modelData = {};

  for (const [tabName, url] of Object.entries(tabMap)) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      const [fields, ...dataRows] = parsed;

      for (let col = 1; col < fields.length; col++) {
        const modelName = fields[col];
        modelData[modelName] = modelData[modelName] || {};

        for (let row of dataRows) {
          if (!row || row.length <= col) continue;
          const label = row[0];
          const value = row[col];
          if (label) {
            modelData[modelName][label] = {
              value: value,
              source: tabName
            };
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${tabName}:`, err);
    }
  }

  return modelData;
}

// ---------- HELPERS FOR PAGE-AWARE HIDING ----------
function getPageType() {
  // prefer explicit marker if you add <body data-page-type="specials|model">
  const explicit = document.body?.dataset?.pageType;
  if (explicit === 'specials' || explicit === 'model') return explicit;

  // fallback heuristics
  if (document.querySelector('.acs-specials')) return 'specials';
  if (document.querySelector('.acs-model-page')) return 'model';

  // default
  return 'specials';
}

function isHide(val) {
  if (val == null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

// ---------- MAIN RENDER ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    "LAG": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=0",
    "Lovering-Test": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=1204848822",
    "Lovering-Nav": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=1600558128",
    "VV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=726262632",
    "JV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=751272513",
    "PV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=1392277631"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  // element-level hide controls (keep existing keys; do NOT include page-visibility here,
  // because those should hide the WHOLE card)
  const hideMap = {
    "APR Card": "apr-card",
    "Lease Card": "lease-card",
    "Purchase Card": "purchase-card",
    "Buy Card": "buy-card",
    "Bonus Offers": "bonus-offers",
    "Offer 1 Card": "offer-1-card",
    "Offer 2 Card": "offer-2-card",
    "Offer 3 Card": "offer-3-card",
    "Offer 4 Card": "offer-4-card"
  };

  const pageType = getPageType();

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // if no data, hide whole section
    if (!data) { section.style.display = "none"; return; }

    // global whole-card hide
    const hideGlobal = isHide(data["Visibility"]?.value);

    // page-aware whole-card hide
    const hideOnSpecials = pageType === 'specials' && isHide(data["Specials Page Visibility"]?.value);
    const hideOnModel    = pageType === 'model'    && isHide(data["Model Page Visibility"]?.value);

    if (hideGlobal || hideOnSpecials || hideOnModel) {
      section.style.display = "none";
      return;
    }

    // element-level hide
    Object.entries(hideMap).forEach(([label, className]) => {
      const entry = data[label];
      if (entry && isHide(entry.value)) {
        const el = section.querySelector(`.${className}`);
        if (el) el.style.display = "none";
      }
    });

    // image + basic fields
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    const modelTitle = data["Model Title"]?.value;
    const modelYear = data["Model Year"]?.value;
    const trimLevel = data["Trim Level"]?.value;

    if (imgEl && imageObj) {
      imgEl.src = imageObj.value;
      imgEl.alt = [modelYear, modelTitle, trimLevel].filter(Boolean).join(' ') || "Vehicle offer image";
      imgEl.style.display = "block";
    }

    // text mappings
    const mapping = {
      "model-title": "Model Title",
      "model-details": "Model Details",
      "model": "Model",
      "trim-level": "Trim Level",
      "msrp": "MSRP",
      "model-bonus": "Model Bonus",
      "lease-payment": "Lease Payment",
      "lease-terms": "Lease Terms",
      "lease-disclaimer": "Lease Disclaimer",
      "apr": "APR",
      "apr-terms": "APR Terms",
      "apr-disclaimer": "APR Disclaimer",
      "buy": "Buy",
      "buy-terms": "Buy Terms",
      "buy-disclaimer": "Buy Disclaimer",
      "purchase": "Purchase",
      "purchase-terms": "Purchase Terms",
      "purchase-disclaimer": "Purchase Disclaimer",
      "bonus-1-headline": "Bonus 1 Headline",
      "bonus-1-details": "Bonus 1 Details",
      "bonus-1-disclaimer": "Bonus 1 Disclaimer",
      "bonus-2-headline": "Bonus 2 Headline",
      "bonus-2-details": "Bonus 2 Details",
      "bonus-2-disclaimer": "Bonus 2 Disclaimer",
      "bonus-3-headline": "Bonus 3 Headline",
      "bonus-3-details": "Bonus 3 Details",
      "bonus-3-disclaimer": "Bonus 3 Disclaimer",
      "bonus-4-headline": "Bonus 4 Headline",
      "bonus-4-details": "Bonus 4 Details",
      "bonus-4-disclaimer": "Bonus 4 Disclaimer",
      "bonus-5-headline": "Bonus 5 Headline",
      "bonus-5-details": "Bonus 5 Details",
      "bonus-5-disclaimer": "Bonus 5 Disclaimer",
      "lease-allowance": "Lease Allowance",
      "purchase-allowance": "Purchase Allowance",
      "loyalty-bonus": "Loyalty Bonus",
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
    "shopping-link-text": "Shopping Link Text"
    };

    Object.entries(mapping).forEach(([className, sheetKey]) => {
      const elements = section.querySelectorAll(`.${className}`);
      if (!elements.length || !data[sheetKey]) return;

      let value = data[sheetKey].value;

      if (className === "lease-payment" && value && !value.includes('$')) {
        value = `$${value}`;
      }

      if (className === "apr" && value) {
        value = value.includes('%') ? value : `${(parseFloat(value) * 100).toFixed(2)}%`;
      }

      elements.forEach(el => {
        el.textContent = value;
      });
    });

    // shopping links (primary + extras)
    Object.keys(data).forEach(key => {
      if (/^Shopping Link(\s\d+)?$/.test(key)) {
        const num = key.match(/\d+/)?.[0] || "";
        const className = `shopping-link${num ? '-' + num : ''}`;
        const el = section.querySelector(`.${className}`);
        if (el && data[key]) {
          el.href = data[key].value;
          el.style.display = "inline-block";
        }
      }
    });
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) {
    updateOffersFromSheet();
  } else if (retries > 0) {
    setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  } else {
    console.warn("car-offer not found after retries — script aborted.");
  }
}

waitForOffersToLoad();
