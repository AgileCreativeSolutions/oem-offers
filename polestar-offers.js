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

async function updateOffersFromSheet() {
const csvTabs = {
"New": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSuXx10RWzB32cg_4o4fIkfYzuyzplwrAeXQHJoViKnELZdBIhxrewO1vrIvKa5EZW9_a1qBn-d7R-G/pub?output=csv",
"Used": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSuXx10RWzB32cg_4o4fIkfYzuyzplwrAeXQHJoViKnELZdBIhxrewO1vrIvKa5EZW9_a1qBn-d7R-G/pub?output=csv&gid=589102167",
};

const modelData = await fetchAndMergeTabs(csvTabs);

const hideMap = {
"Offer Card 1": "offer-card-1",
"Offer Card 2": "offer-card-2",
"Offer Card 3": "offer-card-3",
"Offer Card 4": "offer-card-4",
"Offer Card 5": "offer-card-5",
"Offer Card 6": "offer-card-6"
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
const modelTitle = data["Model Title"]?.value;
const modelYear = data["Model Year"]?.value;
const trimLevel = data["Trim Level"]?.value;

if (imgEl && imageObj) {
imgEl.src = imageObj.value;
imgEl.alt = [modelYear, modelTitle, trimLevel].filter(Boolean).join(' ') || "Vehicle offer image";
imgEl.style.display = "block";
}

const mapping = {
"model-year": "Model Year",
"model-title": "Model Title",
"valid-date": "Valid Date",
...Object.fromEntries(
Array.from({ length: 6 }, (_, i) => i + 1).flatMap(n => [
[`offer-${n}`, `Offer ${n}`],
[`offer-${n}-heading`, `Offer ${n} Heading`],
[`offer-${n}-details`, `Offer ${n} Details`],
[`offer-${n}-disclaimer`, `Offer ${n} Disclaimer`],
])
)
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

// Handle all shopping links (primary + extras)
Object.keys(data).forEach(key => {
if (/^Shopping Link(\s\d+)?$/.test(key)) {
const num = key.match(/\d+/)?.[0] || "";
const className = `shopping-link${num ? '-' + num : ''}`;
const elements = section.querySelectorAll(`.${className}`);
if (elements.length && data[key]) {
elements.forEach(el => {
el.href = data[key].value;
el.style.display = "inline-block";
});
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
