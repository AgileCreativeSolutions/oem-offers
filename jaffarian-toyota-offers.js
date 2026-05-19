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

function isEmpty(val) {
  return val == null || String(val).trim() === '';
}

// Returns true if every value in the supplied key list is empty for this model.
function allEmpty(data, keys) {
  return keys.every(k => isEmpty(data[k]?.value));
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    "JT": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVlDeBDpVWbm6feb9LwuQuX6OpRmi0ktrKnR5Qe4BBaFZBPCqCCHwAm30uLlAv-g/pub?output=csv&gid=901719774"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  // ---------- Page header (sheet-driven via "Header" column) ----------
  // "Header Image":    URL  → show image     | blank → hide image | "hide" → hide image
  // "Header Tagline":  text → replace H2     | blank → keep HTML default | "hide" → hide H2
  const headerData = modelData["Header"];
  if (headerData) {
    const headerImgEl = document.querySelector('.header-image');
    if (headerImgEl) {
      const url = headerData["Header Image"]?.value;
      if (url && !isHide(url)) {
        headerImgEl.src = url;
        headerImgEl.style.display = "";
      } else {
        headerImgEl.style.display = "none";
      }
    }
    const headerTaglineEl = document.querySelector('.header-tagline');
    if (headerTaglineEl) {
      const tagline = headerData["Header Tagline"]?.value;
      if (tagline && isHide(tagline)) {
        headerTaglineEl.style.display = "none";
      } else if (tagline && String(tagline).trim()) {
        headerTaglineEl.textContent = String(tagline).trim();
        headerTaglineEl.style.display = "";
      }
      // blank → leave the HTML default text alone
    }
  }

  // Sheet field -> HTML class
  const textMap = {
    "model-title":          "Model Title",
    "model-details":        "Model Details",
    "offer-1-special-type": "Offer 1 Special Type",
    "offer-1-special":      "Offer 1 Special",
    "offer-1-term-type":    "Offer 1 Term Type",
    "offer-1-term":         "Offer 1 Term",
    "offer-1-detail-1":     "Offer 1 Detail 1",
    "offer-1-detail-2":     "Offer 1 Detail 2",
    "offer-1-detail-3":     "Offer 1 Detail 3",
    "offer-1-disclaimer":   "Offer 1 Disclaimer",
    "offer-2-special-type": "Offer 2 Special Type",
    "offer-2-special":      "Offer 2 Special",
    "offer-2-term-type":    "Offer 2 Term Type",
    "offer-2-term":         "Offer 2 Term",
    "offer-2-detail-1":     "Offer 2 Detail 1",
    "offer-2-detail-2":     "Offer 2 Detail 2",
    "offer-2-detail-3":     "Offer 2 Detail 3",
    "offer-2-disclaimer":   "Offer 2 Disclaimer",
    "offer-3-special-type": "Offer 3 Special Type",
    "offer-3-special":      "Offer 3 Special",
    "offer-3-term-type":    "Offer 3 Term Type",
    "offer-3-term":         "Offer 3 Term",
    "offer-3-detail-1":     "Offer 3 Detail 1",
    "offer-3-detail-2":     "Offer 3 Detail 2",
    "offer-3-detail-3":     "Offer 3 Detail 3",
    "offer-3-disclaimer":   "Offer 3 Disclaimer",
    "offer-4-special-type": "Offer 4 Special Type",
    "offer-4-special":      "Offer 4 Special",
    "offer-4-term-type":    "Offer 4 Term Type",
    "offer-4-term":         "Offer 4 Term",
    "offer-4-detail-1":     "Offer 4 Detail 1",
    "offer-4-detail-2":     "Offer 4 Detail 2",
    "offer-4-detail-3":     "Offer 4 Detail 3",
    "offer-4-disclaimer":   "Offer 4 Disclaimer",
    "cta-text":             "CTA Text"
  };

  // Keys that, if all empty for a given Offer N, mean that whole sub-card should hide
  const offerKeysFor = (n) => [
    `Offer ${n} Special Type`, `Offer ${n} Special`, `Offer ${n} Term Type`, `Offer ${n} Term`,
    `Offer ${n} Detail 1`, `Offer ${n} Detail 2`, `Offer ${n} Detail 3`
  ];
  const OFFER_COUNT = 4;

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // Hide entire card if no data or Visibility = hide
    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      return;
    }

    // ---------- Offer Image ----------
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      imgEl.alt = data["Model Title"]?.value || '';
    }

    // ---------- Call Out (green banner at top of card) ----------
    const calloutVal = data["Call Out"]?.value;
    const calloutWrap = section.querySelector('.call-out-band');
    const calloutEl = section.querySelector('.call-out');
    if (calloutWrap && calloutEl) {
      if (calloutVal && !isHide(calloutVal)) {
        calloutEl.textContent = calloutVal;
        calloutWrap.style.display = "";
      } else {
        calloutWrap.style.display = "none";
      }
    }

    // ---------- Plain text fields ----------
    Object.entries(textMap).forEach(([className, key]) => {
      const val = data[key]?.value;
      const el = section.querySelector(`.${className}`);
      if (!el) return;
      if (isEmpty(val)) {
        // Hide labels (the *-type elements) when blank so the value stands alone.
        // Hide -term too when blank (works with the term-block hide below).
        // Leave other empties as empty text content (won't visually impact).
        if (className.endsWith('-special-type') ||
            className.endsWith('-term-type')   ||
            className.endsWith('-term')        ||
            className.endsWith('-special')     ||
            className.endsWith('-detail-1')    ||
            className.endsWith('-detail-2')    ||
            className.endsWith('-detail-3')    ||
            className.endsWith('-disclaimer')  ||
            className === 'model-details') {
          el.style.display = "none";
        } else {
          el.textContent = '';
        }
      } else {
        el.textContent = val;
        el.style.display = "";
      }
    });

    // ---------- Term column hide (when both Term Type and Term are empty) ----------
    for (let n = 1; n <= OFFER_COUNT; n++) {
      const tt = data[`Offer ${n} Term Type`]?.value;
      const tv = data[`Offer ${n} Term`]?.value;
      const block = section.querySelector(`.offer-${n}-term-block`);
      if (block) {
        if (isEmpty(tt) && isEmpty(tv)) block.style.display = "none";
        else block.style.display = "";
      }
    }

    // ---------- Detail bar pipe separators (hide pipes when neighbors empty) ----------
    for (let n = 1; n <= OFFER_COUNT; n++) {
      const d1 = !isEmpty(data[`Offer ${n} Detail 1`]?.value);
      const d2 = !isEmpty(data[`Offer ${n} Detail 2`]?.value);
      const d3 = !isEmpty(data[`Offer ${n} Detail 3`]?.value);
      const pipe1 = section.querySelector(`.offer-${n}-pipe-1`);
      const pipe2 = section.querySelector(`.offer-${n}-pipe-2`);
      if (pipe1) pipe1.style.display = (d1 && d2) ? "" : "none";
      if (pipe2) pipe2.style.display = (d2 && d3) ? "" : "none";
    }

    // ---------- Sub-card hide (explicit "Offer N Card" = hide, OR all offer-N fields empty) ----------
    for (let n = 1; n <= OFFER_COUNT; n++) {
      const explicitHide = data[`Offer ${n} Card`]?.value && isHide(data[`Offer ${n} Card`].value);
      const autoHide = allEmpty(data, offerKeysFor(n));
      const cardEl = section.querySelector(`.offer-${n}-card`);
      if (cardEl) {
        cardEl.style.display = (explicitHide || autoHide) ? "none" : "";
      }
    }

    // ---------- Divider text + hide (Offer 2/3/4 only) ----------
    // Sheet value:  blank → show default "or"  |  any text → show that text  |  "hide" → hide divider
    // Note: divider lives inside its offer-N-card, so it also hides automatically when the card hides.
    for (let n = 2; n <= OFFER_COUNT; n++) {
      const divVal = data[`Offer ${n} Divider`]?.value;
      const dividerEl = section.querySelector(`.offer-${n}-divider`);
      const dividerTextEl = section.querySelector(`.offer-${n}-divider-text`);
      if (!dividerEl) continue;
      if (divVal && isHide(divVal)) {
        dividerEl.style.display = "none";
      } else {
        dividerEl.style.display = "";
        if (dividerTextEl) {
          const txt = (divVal && String(divVal).trim()) ? String(divVal).trim() : "or";
          dividerTextEl.textContent = txt;
        }
      }
    }

    // ---------- Disclaimer wrapper hide (when all disclaimers empty) ----------
    const allDiscEmpty = [1, 2, 3, 4].every(n =>
      isEmpty(data[`Offer ${n} Disclaimer`]?.value)
    );
    const discWrap = section.querySelector('.disclaimer-band');
    if (discWrap) discWrap.style.display = allDiscEmpty ? "none" : "";

    // ---------- CTA link ----------
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
            ctaEl.style.display = "inline-flex";
          }
        } catch {}
      }
    }

    // ---------- Call For Details phone ----------
    const phoneVal = data["Call For Details Phone"]?.value;
    const callEl = section.querySelector('.call-for-details');
    if (callEl) {
      if (phoneVal && !isHide(phoneVal)) {
        const digits = String(phoneVal).replace(/\D/g, '');
        callEl.href = `tel:+1${digits}`;
        callEl.style.display = "inline-flex";
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
