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
"Master": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjprXV_Lvni8wfpyzN4-F1XIdvoQEGEzlNPC69zkzC-19alfdjBCGUjdof0yZItXmyBBG1v6wk74VB/pub?output=csv&gid=0",
"AFS": "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjprXV_Lvni8wfpyzN4-F1XIdvoQEGEzlNPC69zkzC-19alfdjBCGUjdof0yZItXmyBBG1v6wk74VB/pub?output=csv&gid=956788854"
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
"Comment Card": "comment-card"
};

document.querySelectorAll('.car-offer').forEach(section => {
const modelKey = section.dataset.model;
const data = modelData[modelKey];

// Hide the full block if model is missing or set to hide
if (!data || (data["Visibility"] && data["Visibility"].value.toLowerCase() === "hide")) {
section.style.display = "none";
return;
}

// Hide specific sections
Object.entries(hideMap).forEach(([sheetRow, className]) => {
const valueObj = data[sheetRow];
if (valueObj && valueObj.value.toLowerCase() === "hide") {
const element = section.querySelector(`.${className}`);
if (element) {
element.style.display = "none";
}
}
});

// Set offer image
const imgEl = section.querySelector(".offer-image");
const imageObj = data["Offer Image"];
const modelTitle = data["Model Title"];
if (imgEl && imageObj) {
imgEl.src = imageObj.value;
imgEl.alt = modelTitle?.value || "Vehicle offer image";
imgEl.style.display = "block";
}

const mapping = {
"units-available": "Units Available",
"vehicle": "Vehicle",
"save": "Save",
"msrp": "MSRP",
"fleet-sale-price": "Fleet Sale Price",
"comment-1": "Comment 1",
"comment-2": "Comment 2",
"comment-3": "Comment 3",
"comment-4": "Comment 4",
"comment-5": "Comment 5",
"disclaimer": "Disclaimer",
"date": "Date"
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

el.textContent = value;
});

// Primary shopping link (unchanged behavior)
const primaryLink = data["Shopping Link"];
const primaryEl = section.querySelector(".shopping-link");
if (primaryEl && primaryLink) {
primaryEl.href = primaryLink.value;
primaryEl.style.display = "inline-block";
}

// Additional shopping links: Shopping Link 2, 3, etc.
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
