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
async function fetchSheet(url, skipTitleRow = false) {
const modelData = {};
try {
const response = await fetch(url, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
let parsed = parseCSV(await response.text());
if (!parsed.length) return modelData;
if (skipTitleRow) parsed = parsed.slice(1); // drop title band (row 1); header is row 2
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

// ---------- MERGE MULTIPLE SHEET TABS ----------
async function fetchAndMergeTabs(tabMap) {
const modelData = {};
for (const [tabName, cfg] of Object.entries(tabMap)) {
try {
const url = typeof cfg === 'string' ? cfg : cfg.url;
const skipTitleRow = typeof cfg === 'string' ? false : !!cfg.skipTitleRow;
const merged = await fetchSheet(url, skipTitleRow);
for (const [modelName, fields] of Object.entries(merged)) {
modelData[modelName] = modelData[modelName] || {};
Object.assign(modelData[modelName], fields);
}
} catch (err) {
console.error(`Error processing ${tabName}:`, err);
}
}
return modelData;
}

// ---------- HELPERS ----------
function isHide(val) {
if (!val) return false;
const v = String(val).trim().toLowerCase();
return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

function setText(el, value) {
if (el) el.textContent = value || '';
}

function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

// Column width classes for 2 vs 3 offers
const COL_WIDTHS = {
2: 'acs-twelve-lg acs-six-xl acs-columns acs-my-2',
3: 'acs-twelve-lg acs-four-xl acs-columns acs-my-2',
};

// ---------- MANAGER / FEATURED CARD RENDERER ----------
function renderManagerCard(section, data) {
// Image
const imgEl = section.querySelector('.offer-image');
if (imgEl) {
imgEl.src = data['Offer Image'] || '';
imgEl.alt = data['Model Title 1'] || '';
}

// Text fields
const textMap = {
'model-title-1': 'Model Title 1',
'model-title-2': 'Model Title 2',
'model-details': 'Model Details',
'save-amount':   'Save Amount',
'save-amount-2': 'Save Amount 2',
'disclaimer':    'Disclaimer'
};
Object.entries(textMap).forEach(([className, key]) => {
const el = section.querySelector(`.${className}`);
if (!el) return;
const val = data[key];
setText(el, val);
if (className === 'disclaimer') el.style.display = val ? '' : 'none';
});

// CTA link (href from CTA Link, label from CTA Text span)
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
ctaEl.style.display = 'inline-block';
}
const spanEl = ctaEl.querySelector('.cta-text');
if (spanEl && ctaText) spanEl.textContent = ctaText;
}

// Call For Details phone
const callEl = section.querySelector('.call-for-details');
if (callEl) {
const phoneVal = data['Call For Details Phone'];
if (phoneVal && !isHide(phoneVal)) {
callEl.href = `tel:+1${String(phoneVal).replace(/\D/g, '')}`;
callEl.style.display = 'inline-block';
} else {
hide(callEl);
}
}
}

// ---------- MAIN ----------
async function updateOffersFromSheet() {
const csvTabs = {
"LEASE": 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVlDeBDpVWbm6feb9LwuQuX6OpRmi0ktrKnR5Qe4BBaFZBPCqCCHwAm30uLlAv-g/pub?output=csv&gid=1386781097',
"MGR":   { url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVlDeBDpVWbm6feb9LwuQuX6OpRmi0ktrKnR5Qe4BBaFZBPCqCCHwAm30uLlAv-g/pub?output=csv&gid=942788749', skipTitleRow: true }
};
const modelData = await fetchAndMergeTabs(csvTabs);

document.querySelectorAll('.car-offer').forEach(section => {
const key  = section.dataset.model;
const data = modelData[key];

// Hide entire card if no data or Visibility = hide
if (!data || isHide(data['Visibility'])) {
hide(section);
return;
}

// ----- Manager / Featured cards (GMCD "Disc" layout) -----
if (section.querySelector('.model-title-1')) {
renderManagerCard(section, data);
return;
}

// Header
setText(section.querySelector('.model-title'),  data['Model Title']);
setText(section.querySelector('.stock-msrp'),   data['Stock & MSRP']);

// Image
const imgEl = section.querySelector('.offer-image');
if (imgEl) {
imgEl.src = data['Offer Image'] || '';
imgEl.alt = data['Model Title'] || '';
}

// Orange banner
const bannerEl = section.querySelector('.orange-banner');
if (bannerEl) {
const bannerText = data['Orange Banner'];
if (bannerText && !isHide(bannerText)) {
bannerEl.textContent = bannerText;
show(bannerEl);
} else {
hide(bannerEl);
}
}

// Count populated offers
const offerCount = [1, 2, 3].filter(n =>
data[`Offer ${n} Label`] || data[`Offer ${n} Value`]
).length;

const colClass = COL_WIDTHS[offerCount] || COL_WIDTHS[2];

// Render each offer column
[1, 2, 3].forEach(n => {
const colEl  = section.querySelector(`.offer-${n}-col`);
const label  = data[`Offer ${n} Label`];
const value  = data[`Offer ${n} Value`];
const term   = data[`Offer ${n} Term`];

if (label || value) {
colEl.className = colClass;
show(colEl);
setText(colEl.querySelector(`.offer-${n}-label`), label);
setText(colEl.querySelector(`.offer-${n}-value`), value);
const termEl = colEl.querySelector(`.offer-${n}-term`);
if (termEl) {
setText(termEl, term);
termEl.style.display = term ? '' : 'none';
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
if (el) {
setText(el, val);
el.style.display = val ? '' : 'none';
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
