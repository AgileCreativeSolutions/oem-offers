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
row.push(cell.trim()); rows.push(row);
}
return rows;
}

async function fetchAndMergeTabs(tabMap) {
const modelData = {};

for (const [tabName, url] of Object.entries(tabMap)) {
const response = await fetch(url);
const csvText = await response.text();
const parsed = parseCSV(csvText);
const [fields, ...dataRows] = parsed;

for (let col = 1; col < fields.length; col++) {
const modelName = fields[col];
modelData[modelName] = modelData[modelName] || {};
for (let row of dataRows) {
const label = row[0];
const value = row[col];
modelData[modelName][label] = {
value: value,
source: tabName
};
}
}
}

return modelData;
}

async function updateOffersFromSheet() {
const csvTabs = {
"RSM": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTa_l-JizbJbuK69JtJQz5D1dA45_1kICCn0F2Bfl3lGeVVwi_YMlVYXmc5KgZ2lmtDFLcjrTpALXeF/pub?output=csv&gid=517885078",
"HV": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTa_l-JizbJbuK69JtJQz5D1dA45_1kICCn0F2Bfl3lGeVVwi_YMlVYXmc5KgZ2lmtDFLcjrTpALXeF/pub?output=csv&gid=2109471915"
};

const modelData = await fetchAndMergeTabs(csvTabs);

const disclaimerClasses = [
"lease-disclaimer", "apr-disclaimer",
"bonus-1-disclaimer", "bonus-2-disclaimer",
"bonus-3-disclaimer", "bonus-4-disclaimer",
"bonus-5-disclaimer"
];

const imageKey = "Offer Image";

const hideMap = {
"APR Card": "apr-card",
"Lease Card": "lease-card",
"Zero Down Lease Card": "zero-down-lease-card",
"Bonus Offers": "bonus-offers"
};

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
const imageObj = data[imageKey];
if (imgEl && imageObj) {
imgEl.src = imageObj.value;
imgEl.style.display = "block";
}

const mapping = {
"model-year": "Model Year",
"model-title": "Model Title",
"trim-level": "Trim Level",
"lease-model": "Lease Model",
"model": "Model",
"msrp": "MSRP",
"model-bonus": "Model Bonus",
"lease-payment": "Lease Payment",
"lease-terms": "Lease Terms",
"down-payment": "Down Payment",
"zero-down-lease-payment": "Zero Down Lease Payment",
"zero-down-lease-terms": "Zero Down Lease Terms",
"apr": "APR",
"apr-terms": "APR Terms",
"apr-short-term": "APR Short Term",
"apr-long-term": "APR Long Term",
"apr-disclaimer": "APR Disclaimer",
"purchase": "Purchase",
"purchase-terms": "Purchase Terms",
"shopping-link": "Shopping Link",
"lease-disclaimer": "Lease Disclaimer",
"purchase-disclaimer": "Purchase Disclaimer"
};

Object.entries(mapping).forEach(([className, sheetKey]) => {
const el = section.querySelector(`.${className}`);
if (!el) return;

const dataObj = data[sheetKey];
if (!dataObj) return;

let value = dataObj.value;

if (className === "lease-payment" && value && !value.includes('$')) {
value = `$${value}`;
}

if (className === "apr" && value) {
value = value.includes('%') ? value : `${(parseFloat(value) * 100).toFixed(2)}%`;
}

if (className === "shopping-link") {
el.href = value;
el.style.display = "inline-block";
} else {
el.textContent = value;
}
});

// Primary shopping link (Shopping Link)
const primaryLink = data["Shopping Link"];
const primaryEl = section.querySelector(".shopping-link");
if (primaryEl && primaryLink) {
primaryEl.href = primaryLink.value;
primaryEl.style.display = "inline-block";
}

// Extra shopping links: Shopping Link 2, 3, ...
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
