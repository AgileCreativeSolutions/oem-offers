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
function getPageType() {
  const fromHtml = document.documentElement?.dataset?.pageType;
  if (fromHtml === 'specials' || fromHtml === 'model') return fromHtml;
  const fromBody = document.body?.dataset?.pageType;
  if (fromBody === 'specials' || fromBody === 'model') return fromBody;
  const node = document.querySelector('[data-page-type]');
  const val = node?.getAttribute('data-page-type')?.toLowerCase();
  if (val === 'specials' || val === 'model') return val;
  if (document.querySelector('.acs-specials')) return 'specials';
  return 'unknown';
}

function isHide(val) {
  if (val == null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

// ---------- MAIN ----------
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
  const hideMap = {
    "APR Card": "apr-card",
    "Lease Card": "lease-card",
    "Purchase Card": "purchase-card",
    "Buy Card": "buy-card",
    "Bonus Offers": "bonus-offers",
    "Title Card": "title-card",
    "Offer 1 Card": "offer-1-card",
    "Offer 2 Card": "offer-2-card",
    "Offer 3 Card": "offer-3-card",
    "Offer 4 Card": "offer-4-card"
  };

  const pageType = getPageType();

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    if (!data) { section.style.display = "none"; section.setAttribute("aria-hidden","true"); return; }

    const hideGlobal = isHide(data["Visibility"]?.value);
    const hideOnSpecials = pageType === 'specials' && isHide(data["Specials Page Visibility"]?.value);
    const hideOnModel    = pageType === 'model'    && isHide(data["Model Page Visibility"]?.value);

    if (hideGlobal || hideOnSpecials || hideOnModel) {
      section.style.display = "none";
      section.setAttribute("aria-hidden","true");
      return;
    }

    Object.entries(hideMap).forEach(([label, className]) => {
      const entry = data[label];
      if (entry && isHide(entry.value)) {
        const el = section.querySelector(`.${className}`);
        if (el) el.style.display = "none";
      }
    });

    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      imgEl.alt = data["Model Title"]?.value || '';
    }

    const textMap = {
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

    Object.entries(textMap).forEach(([className, key]) => {
      const val = data[key]?.value;
      if (val == null) return;
      const el = section.querySelector(`.${className}`);
      if (el) el.textContent = val;
    });

    const linkMap = { "cta-1": "CTA 1 Link", "cta-2": "CTA 2 Link", "cta-3": "CTA 3 Link" };
    Object.entries(linkMap).forEach(([className, key]) => {
      const value = data[key]?.value;
      if (!value) return;
      try {
        const url = new URL(value, location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          const el = section.querySelector(`.${className}`);
          if (el) { el.href = url.href; el.style.display = "inline-block"; }
        }
      } catch {}
    });
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  else console.warn("car-offer not found after retries — script aborted.");
}
waitForOffersToLoad();
