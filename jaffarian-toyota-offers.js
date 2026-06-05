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

function allEmpty(data, keys) {
  return keys.every(k => isEmpty(data[k]?.value));
}

function val(data, key) {
  const v = data[key]?.value;
  return isEmpty(v) ? '' : String(v).trim();
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
  const csvTabs = {
    "JT": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVlDeBDpVWbm6feb9LwuQuX6OpRmi0ktrKnR5Qe4BBaFZBPCqCCHwAm30uLlAv-g/pub?output=csv&gid=901719774"
  };

  const modelData = await fetchAndMergeTabs(csvTabs);

  // ---------- Page header (sheet-driven via "Header" column) ----------
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
    }
  }

  const OFFER_COUNT = 4;

  // Merged term line: "Term | Detail 1 | Detail 2 | Detail 3" (Term Type label dropped)
  function buildTermLine(data, n) {
    const term    = val(data, `Offer ${n} Term`);
    const details = [
      val(data, `Offer ${n} Detail 1`),
      val(data, `Offer ${n} Detail 2`),
      val(data, `Offer ${n} Detail 3`)
    ].filter(Boolean);
    return [term, ...details].filter(Boolean).join('  |  ');
  }

  const offerKeysFor = (n) => [
    `Offer ${n} Special Type`, `Offer ${n} Special`, `Offer ${n} Term Type`, `Offer ${n} Term`,
    `Offer ${n} Detail 1`, `Offer ${n} Detail 2`, `Offer ${n} Detail 3`
  ];

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];

    // Hide entire card if no data or Visibility = hide
    if (!data || (data["Visibility"] && isHide(data["Visibility"].value))) {
      section.style.display = "none";
      section.classList.remove('is-loading');
      return;
    }

    // ---------- Model header ----------
    const titleEl = section.querySelector('.model-title');
    if (titleEl) titleEl.textContent = val(data, "Model Title");

    const detailsEl = section.querySelector('.model-details');
    if (detailsEl) {
      const md = val(data, "Model Details");
      detailsEl.textContent = md;
      detailsEl.style.display = md ? "" : "none";
    }

    // ---------- Offer Image ----------
    const imgEl = section.querySelector(".offer-image");
    const imageObj = data["Offer Image"];
    if (imgEl && imageObj?.value) {
      imgEl.src = imageObj.value;
      imgEl.alt = val(data, "Model Title");
    }

    // ---------- Call Out (green banner) ----------
    const calloutVal = data["Call Out"]?.value;
    const calloutEl = section.querySelector('.offer-callout');
    if (calloutEl) {
      if (calloutVal && !isHide(calloutVal)) {
        calloutEl.textContent = calloutVal;
        calloutEl.style.display = "";
      } else {
        calloutEl.style.display = "none";
      }
    }

    // ---------- Render each offer (stacked: type / value / term line) ----------
    const offerVisible = [];
    for (let n = 1; n <= OFFER_COUNT; n++) {
      const explicitHide = data[`Offer ${n} Card`]?.value && isHide(data[`Offer ${n} Card`].value);
      const autoHide = allEmpty(data, offerKeysFor(n));
      const cardEl = section.querySelector(`.offer-${n}-card`);
      const visible = !(explicitHide || autoHide);
      offerVisible[n] = visible;

      if (!cardEl) continue;
      if (!visible) {
        cardEl.style.display = "none";
        continue;
      }
      cardEl.style.display = "";

      const typeEl = section.querySelector(`.offer-${n}-special-type`);
      if (typeEl) {
        const t = val(data, `Offer ${n} Special Type`);
        typeEl.textContent = t;
        typeEl.style.display = t ? "" : "none";
      }
      const specialEl = section.querySelector(`.offer-${n}-special`);
      if (specialEl) {
        const s = val(data, `Offer ${n} Special`);
        specialEl.textContent = s;
        specialEl.style.display = s ? "" : "none";
      }
      const termLineEl = section.querySelector(`.offer-${n}-termline`);
      if (termLineEl) {
        const line = buildTermLine(data, n);
        termLineEl.textContent = line;
        termLineEl.style.display = line ? "" : "none";
      }
    }

    // ---------- Dividers (gated: show only between two visible offers) ----------
    for (let n = 2; n <= OFFER_COUNT; n++) {
      const dividerEl = section.querySelector(`.offer-${n}-divider`);
      const dividerTextEl = section.querySelector(`.offer-${n}-divider-text`);
      if (!dividerEl) continue;

      const priorVisible = offerVisible.slice(1, n).some(Boolean);
      const divVal = data[`Offer ${n} Divider`]?.value;

      if (!offerVisible[n] || !priorVisible || (divVal && isHide(divVal))) {
        dividerEl.style.display = "none";
      } else {
        dividerEl.style.display = "";
        if (dividerTextEl) {
          dividerTextEl.textContent = (divVal && String(divVal).trim())
            ? String(divVal).trim()
            : "or";
        }
      }
    }

    // ---------- Disclaimers + collapsible band ----------
    let anyDisc = false;
    for (let n = 1; n <= OFFER_COUNT; n++) {
      const el = section.querySelector(`.offer-${n}-disclaimer`);
      const dv = val(data, `Offer ${n} Disclaimer`);
      if (el) {
        el.textContent = dv;
        el.style.display = dv ? "" : "none";
        if (dv) anyDisc = true;
      }
    }
    const discWrap = section.querySelector('.disclaimer-band');
    if (discWrap) discWrap.style.display = anyDisc ? "" : "none";

    // ---------- CTA link ----------
    const ctaLinkVal = data["CTA Link"]?.value;
    const ctaEl = section.querySelector('.cta-link');
    if (ctaEl) {
      const ctaText = data["CTA Text"]?.value;
      if (ctaText) ctaEl.textContent = ctaText;
      if (!ctaLinkVal || isHide(ctaLinkVal)) {
        ctaEl.style.display = "none";
      } else {
        try {
          const url = new URL(ctaLinkVal, location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            ctaEl.href = url.href;
            ctaEl.style.display = "";
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
        callEl.style.display = "";
      } else {
        callEl.style.display = "none";
      }
    }

    // ---------- Reveal: drop skeleton ----------
    section.classList.remove('is-loading');
  });
}

// ---------- BOOTSTRAP ----------
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) updateOffersFromSheet();
  else if (retries > 0) setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  else console.warn("car-offer not found after retries — script aborted.");
}
waitForOffersToLoad();
