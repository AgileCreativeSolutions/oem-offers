// ---------- MCLAREN MODEL PAGE BANNERS ----------
// Fills every .acs-model-banner on the page from the specials sheet.
// Each banner carries a page key: <div class="acs-model-banner" data-banner="artura">
// In the sheet, the "Page Banner" row holds the key(s) for each offer column.
// Comma-separate keys to feed one offer to more than one page (e.g. "artura, 750s").
(function () {
var FLAG_ROW = "Page Banner";
var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTJnaNHyZbQpSwAVLCBFjXR1Zm7aOF5ZTfqGMnES7Z0efhd3AyI9erjxzMe8yIgaP6oAUgnSQoixVS/pub?output=csv&gid=0";

// ---------- CSV PARSER ----------
function parseCSV(csv) {
var rows = [], inQuotes = false, row = [], cell = '';
for (var i = 0; i < csv.length; i++) {
var c = csv[i], n = csv[i + 1];
if (c === '"' && inQuotes && n === '"') { cell += '"'; i++; }
else if (c === '"') { inQuotes = !inQuotes; }
else if (c === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
else if (c === '\n' && !inQuotes) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
else if (c !== '\r' || inQuotes) { cell += c; }
}
if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
return rows;
}

// ---------- HELPERS ----------
function isHide(val) {
if (val == null) return false;
var v = String(val).trim().toLowerCase();
return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

function normalizeKey(val) {
return String(val || '').trim().toLowerCase();
}

function buildModelData(parsed) {
var data = {};
if (!parsed.length) return data;
var fields = parsed[0];
for (var col = 1; col < fields.length; col++) {
var name = fields[col];
if (!name) continue;
data[name] = data[name] || {};
for (var r = 1; r < parsed.length; r++) {
var row = parsed[r];
if (!row || row.length <= col || !row[0]) continue;
data[name][row[0]] = row[col];
}
}
return data;
}

// First visible offer column whose "Page Banner" value includes this key
function findOffer(data, key) {
var match = null;
Object.keys(data).some(function (col) {
var d = data[col];
if (isHide(d["Visibility"])) return false;
var keys = String(d[FLAG_ROW] || '').split(',').map(normalizeKey);
if (keys.indexOf(key) !== -1) { match = d; return true; }
return false;
});
return match;
}

// ---------- FILL ONE BANNER ----------
function fillBanner(banner, offer) {
var hideMap = { "Offer 1 Card": "offer-1-card", "Offer 2 Card": "offer-2-card" };
Object.keys(hideMap).forEach(function (rowName) {
if (isHide(offer[rowName])) {
var el = banner.querySelector('.' + hideMap[rowName]);
if (el) el.style.display = 'none';
}
});

var img = banner.querySelector('.offer-image');
if (img && offer["Offer Image"]) {
img.src = offer["Offer Image"];
img.alt = offer["Model Title"] || '';
}

var textMap = {
"banner": "Banner",
"model-title": "Model Title",
"model-details": "Model Details",
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
"offer-2-disclaimer": "Offer 2 Disclaimer"
};
Object.keys(textMap).forEach(function (cls) {
var val = offer[textMap[cls]];
if (val == null) return;
var el = banner.querySelector('.' + cls);
if (el) el.textContent = val;
});

banner.style.removeProperty('display');
}

// ---------- MAIN ----------
async function run() {
var banners = document.querySelectorAll('.acs-model-banner[data-banner]');
if (!banners.length) return;

var data;
try {
var res = await fetch(CSV_URL, { cache: 'no-store' });
if (!res.ok) throw new Error('Failed to fetch sheet');
data = buildModelData(parseCSV(await res.text()));
} catch (err) {
console.error('McLaren banner:', err);
return;
}

banners.forEach(function (banner) {
var key = normalizeKey(banner.dataset.banner);
if (!key) return;
var offer = findOffer(data, key);
if (offer) fillBanner(banner, offer); // no match: banner stays hidden
});
}

// ---------- BOOTSTRAP ----------
function waitForBanners(retries) {
if (document.querySelector('.acs-model-banner[data-banner]')) run();
else if (retries > 0) setTimeout(function () { waitForBanners(retries - 1); }, 300);
}
waitForBanners(20);
})();