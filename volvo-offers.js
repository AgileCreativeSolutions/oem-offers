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

async function updateOffersFromSheet() {
const csvTabs = {
"LAG": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=0",
"VV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=726262632",
"JV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=751272513",
"PV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv&gid=1392277631",
};

const modelData = await fetchAndMergeTabs(csvTabs);

const hideMap = {
"APR Card": "apr-card",
"Lease Card": "lease-card",
"Purchase Card": "purchase-card",
"Bonus Offers": "bonus-offers"
};

document.querySelectorAll('.car-offer').forEach(section => {
const modelKey = section.dataset.model;
const data = modelData[modelKey];

if (!data || (data["Visibility"] && data["Visibility"].value.toLowerCase() === "hide")) {
section.style.display = "none";
return;
}

Object.entries(hideMap).forEach(([label, className]) => {
const entry = data[label];
if (entry && entry.value.toLowerCase() === "hide") {
const el = section.querySelector(`.${className}`);
if (el) el.style.display = "none";
}
});

const imgEl = section.querySelector(".offer-image");
const imageObj = data["Offer Image"];
if (imgEl && imageObj) {
imgEl.src = imageObj.value;
imgEl.style.display = "block";
}

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
"savings": "Savings"
};

Object.entries(mapping).forEach(([className, sheetKey]) => {
const el = section.querySelector(`.${className}`);
if (!el || !data[sheetKey]) return;

let value = data[sheetKey].value;

if (className === "lease-payment" && value && !value.includes('$')) {
value = `$${value}`;
}

if (className === "apr" && value) {
value = value.includes('%') ? value : `${(parseFloat(value) * 100).toFixed(2)}%`;
}

el.textContent = value;
});

// Primary shopping link
const primaryLink = data["Shopping Link"];
const primaryEl = section.querySelector(".shopping-link");
if (primaryEl && primaryLink) {
primaryEl.href = primaryLink.value;
primaryEl.style.display = "inline-block";
}

// Extra shopping links: Shopping Link 2, 3, etc.
Object.keys(data).forEach(key => {
if (/^Shopping Link \d+$/.test(key)) {
const num = key.match(/\d+/)[0];
const el = section.querySelector(`.shopping-link-${num}`);
if (el && data[key]) {
el.href = data[key].value;
el.style.display = "inline-block";
}
}
});
});
}

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
