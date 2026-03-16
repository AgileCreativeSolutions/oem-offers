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

// ---------- MAIN ----------
async function updateOffersFromSheet() {
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVlDeBDpVWbm6feb9LwuQuX6OpRmi0ktrKnR5Qe4BBaFZBPCqCCHwAm30uLlAv-g/pub?output=csv&gid=1386781097';
const modelData = await fetchSheet(SHEET_URL);

document.querySelectorAll('.car-offer').forEach(section => {
const key  = section.dataset.model;
const data = modelData[key];

// Hide entire card if no data or Visibility = hide
if (!data || isHide(data['Visibility'])) {
hide(section);
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
