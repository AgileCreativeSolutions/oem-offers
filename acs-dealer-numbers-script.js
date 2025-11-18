// ---------- CSV PARSER ----------
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false,
      row = [],
      cell = '';

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

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

// ---------- FETCH SHEET (columns = models, rows = labels) ----------
async function fetchSheetModels(url) {
  const modelData = {};

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch: ${url}`);

  const parsed = parseCSV(await response.text());
  if (!parsed.length) return modelData;

  const [fields, ...dataRows] = parsed;

  // columns = models, rows = labels
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

  return modelData;
}

// ---------- HELPERS ----------
function isHide(val) {
  if (val == null) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'hide' || v === 'hidden' || v === 'no' || v === '0' || v === 'false';
}

/**
 * Apply a phone number to an element:
 * - Sets the visible text
 * - Ensures it is (or contains) an <a> with a proper tel: href
 */
function applyPhoneToElement(el, rawValue) {
  if (!el || rawValue == null) return;

  const pretty = String(rawValue).trim();
  if (!pretty) return;

  // Extract just the digits so we can build a tel: link
  const digits = pretty.replace(/\D/g, '');
  if (!digits) {
    // Fallback: just show text
    el.textContent = pretty;
    return;
  }

  let telHref;
  if (digits.length === 11 && digits.startsWith('1')) {
    // e.g. 18553926510 → tel:+18553926510
    telHref = `tel:+${digits}`;
  } else if (digits.length === 10) {
    // e.g. 8553926510 → tel:+18553926510
    telHref = `tel:+1${digits}`;
  } else {
    // Unknown length, still usable
    telHref = `tel:${digits}`;
  }

  // If the element itself is already an <a>, just update it
  if (el.tagName && el.tagName.toLowerCase() === 'a') {
    el.textContent = pretty;
    el.setAttribute('href', telHref);
    return;
  }

  // Otherwise, wrap / replace with an <a> inside the existing node
  const link = document.createElement('a');
  link.textContent = pretty;
  link.setAttribute('href', telHref);

  // Preserve any existing classes on the original element
  if (el.className) link.className = el.className;

  // Clear and append
  el.textContent = '';
  el.appendChild(link);
}

// ---------- MAIN ----------
async function updateDealerPhoneNumbers() {
  // TODO: if you move the sheet, just update this URL
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTq-piRwtsFO7HbLscDkbHiLmZd0DEnqaKeUHIpITyn4Eu4ZQzPAmOGFdOtabWWWgl4XNaBn1_gYTtq/pub?output=csv&gid=0";

  let modelData = {};
  try {
    modelData = await fetchSheetModels(csvUrl);
  } catch (err) {
    console.error("Error loading dealer phone sheet:", err);
    return;
  }

  // Map CSS class → sheet label
  // e.g. class="sales" ← "Sales" column in the sheet
  const phoneFieldMap = {
    sales:   "Sales",
    service: "Service",
    parts:   "Parts"
  };

  document.querySelectorAll('.dealer-phone-numbers').forEach(section => {
    const modelKey = section.dataset.model;
    if (!modelKey) return;

    const data = modelData[modelKey];

    // No data for this model or explicitly hidden → hide the block
    if (!data || isHide(data["Visibility"]?.value)) {
      section.style.display = "none";
      section.setAttribute("aria-hidden", "true");
      return;
    }

    // For each phone type we support, apply numbers if present
    Object.entries(phoneFieldMap).forEach(([className, fieldName]) => {
      const val = data[fieldName]?.value;
      if (val == null) return;

      const el = section.querySelector(`.${className}`);
      if (!el) return;

      applyPhoneToElement(el, val);
    });
  });
}

// ---------- BOOTSTRAP ----------
function waitForDealerPhoneNumbers(retries = 20) {
  if (document.querySelector('.dealer-phone-numbers')) {
    updateDealerPhoneNumbers();
  } else if (retries > 0) {
    setTimeout(() => waitForDealerPhoneNumbers(retries - 1), 300);
  } else {
    console.warn("dealer-phone-numbers not found after retries — script aborted.");
  }
}

waitForDealerPhoneNumbers();
