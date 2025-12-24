// ---------- CSV PARSER ----------
function parseCSV(csv) {
const rows = [];
let inQuotes = false,
row = [],
cell = '';
for (let i = 0; i < csv.length; i++) {
const char = csv[i],
nextChar = csv[i + 1];
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

// ---------- MERGE MULTIPLE SHEET TABS ----------
async function fetchAndMergeTabs(tabMap) {
const modelData = {};
for (const [tabName, url] of Object.entries(tabMap)) {
try {
const response = await fetch(url, {
cache: 'no-store'
});
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
modelData[modelName][label] = {
value: row[col]
};
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
"MOD": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnyFq3XjQiFMnbNR-T9zUFQE-Tg5L1h7FLO2J71YMNF_OTcZG1l7oP8JG7I_2xOygbMsLYnp8Eajw7/pub?output=csv&gid=0",
"LD": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnyFq3XjQiFMnbNR-T9zUFQE-Tg5L1h7FLO2J71YMNF_OTcZG1l7oP8JG7I_2xOygbMsLYnp8Eajw7/pub?output=csv&gid=1709161226",
"AMD": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnyFq3XjQiFMnbNR-T9zUFQE-Tg5L1h7FLO2J71YMNF_OTcZG1l7oP8JG7I_2xOygbMsLYnp8Eajw7/pub?output=csv&gid=339970371",
"MASD": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnyFq3XjQiFMnbNR-T9zUFQE-Tg5L1h7FLO2J71YMNF_OTcZG1l7oP8JG7I_2xOygbMsLYnp8Eajw7/pub?output=csv&gid=1359928964"
};

const modelData = await fetchAndMergeTabs(csvTabs);
const hideMap = {
"Offer 1 Card": "offer-1-card",
"Offer 2 Card": "offer-2-card",
};

const pageType = getPageType();

document.querySelectorAll('.car-offer').forEach(section => {
const modelKey = section.dataset.model;
const data = modelData[modelKey];

if (!data || (data["Visibility"] && data["Visibility"].value.toLowerCase() === "hide")) {
section.style.display = "none";
return;
}

Object.entries(hideMap).forEach(([sheetRow, className]) => {
const valueObj = data[sheetRow];
if (valueObj && valueObj.value.toLowerCase() === "hide") {
const element = section.querySelector(`.${className}`);
if (element) {
element.style.display = "none";
}
}
});

const imgEl = section.querySelector(".offer-image");
const imageObj = data["Offer Image"];
if (imgEl && imageObj?.value) {
imgEl.src = imageObj.value;
imgEl.alt = data["Model Title"]?.value || '';
}

const textMap = {
"banner": "Banner",
"model-title": "Model Title",
"model-details": "Model Details",
"model": "Model",
"offer-1-special-type": "Offer 1 Special Type",
"offer-1-special": "Offer 1 Special",
"offer-1-term-type": "Offer 1 Term Type",
"offer-1-term": "Offer 1 Term",
"offer-1-detail-1": "Offer 1 Detail 1",
"offer-1-detail-2": "Offer 1 Detail 2",
"offer-1-detail-3": "Offer 1 Detail 3",
"offer-1-disclaimer": "Offer 1 Disclaimer",
"offer-2-special-type": "Offer 2 Special Type",
"offer-2-special": "Offer 2 Special",
"offer-2-term-type": "Offer 2 Term Type",
"offer-2-term": "Offer 2 Term",
"offer-2-detail-1": "Offer 2 Detail 1",
"offer-2-detail-2": "Offer 2 Detail 2",
"offer-2-detail-3": "Offer 2 Detail 3",
"offer-2-disclaimer": "Offer 2 Disclaimer",
"shopping-link-text": "Shopping Link Text"
};

Object.entries(textMap).forEach(([className, key]) => {
const val = data[key]?.value;
if (val == null) return;
const el = section.querySelector(`.${className}`);
if (el) el.textContent = val;
});

// ---- Links (anchors) ----
const linkMap = {
"cta-1": "CTA 1 Link",
"cta-2": "CTA 2 Link",
"cta-3": "CTA 3 Link",
"shopping-link": "Shopping Link" // 👈 new entry for the Shopping URL
};

Object.entries(linkMap).forEach(([className, key]) => {
const value = data[key]?.value;
if (!value) return;
try {
const url = new URL(value, location.origin);
if (url.protocol === 'http:' || url.protocol === 'https:') {
const el = section.querySelector(`.${className}`);
if (el) {
el.href = url.href;
el.style.display = "inline-block";
// optional:
// el.target = "_blank";
// el.rel = "noopener noreferrer";
}
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
