// =============================================================
// VWGG Lease Specials — Dynamic Insertion Script
// Slot names: Offer1 … Offer15  |  fields as rows, offers as columns
// =============================================================

// ── CSV Parser ────────────────────────────────────────────────
function parseCSV(csv) {
  const rows = [];
  let inQuotes = false, row = [], cell = '';
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i], nx = csv[i + 1];
    if (ch === '"' && inQuotes && nx === '"') { cell += '"'; i++; }
    else if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' && !inQuotes) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r' || inQuotes) { cell += ch; }
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

// ── Fetch & parse sheet ───────────────────────────────────────
async function fetchSheet(url) {
  const modelData = {};
  try {
    console.log('[VWGG] Fetching CSV:', url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    console.log('[VWGG] CSV received, first 300 chars:', text.substring(0, 300));

    const parsed = parseCSV(text);
    console.log('[VWGG] Parsed rows:', parsed.length);
    if (!parsed.length) return modelData;

    // Skip any banner/instruction rows — find the real header row
    // (the row where column A is "FIELD" or column B starts with "Offer")
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(parsed.length, 5); i++) {
      const row = parsed[i];
      if (
        (row[0] && row[0].trim().toUpperCase() === 'FIELD') ||
        (row[1] && row[1].trim().match(/^Offer\d+$/i))
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const headers  = parsed[headerRowIdx];
    const dataRows = parsed.slice(headerRowIdx + 1);
    console.log('[VWGG] Header row index:', headerRowIdx);
    console.log('[VWGG] Headers:', headers.slice(0, 6));

    for (let col = 1; col < headers.length; col++) {
      const slotName = (headers[col] || '').trim();
      if (!slotName) continue;
      modelData[slotName] = {};
      for (const row of dataRows) {
        const fieldLabel = (row[0] || '').trim();
        if (!fieldLabel) continue;
        modelData[slotName][fieldLabel.toLowerCase()] = (row[col] || '').trim();
      }
    }

    console.log('[VWGG] Slots found:', Object.keys(modelData));
  } catch (err) {
    console.error('[VWGG] Fetch error:', err);
  }
  return modelData;
}

// ── Helpers ───────────────────────────────────────────────────
function isHide(val) {
  return String(val || '').trim().toLowerCase() === 'hide';
}
function setText(el, val) { if (el) el.textContent = val || ''; }
function show(el) { if (el) el.style.display = 'block'; }
function hide(el) { if (el) el.style.display = 'none'; }
function q(parent, sel) { return parent.querySelector(sel); }

// ── Populate one card ─────────────────────────────────────────
function populateCard(card, data, slotName) {
  const visibility = data['visibility'] || '';

  if (isHide(visibility)) {
    hide(card);
    console.log('[VWGG]', slotName, '→ hidden (no data or visibility=hide)');
    return;
  }

  console.log('[VWGG]', slotName, '→ showing:', data['model title']);
  show(card);

  // Gradient — update both gradient divs
  const grad = data['gradient class'] || 'acs-silver-gradient';
  card.querySelectorAll('.vw-gradient-bg').forEach(function(el) {
    el.className = el.className.replace(/acs-\S*gradient\S*/g, '').trim() + ' ' + grad;
  });

  setText(q(card, '.vw-vehicle-name'), data['model title']);

  const OFFER_COUNT = 4;
  const offerVisible = [];

  card.querySelectorAll('.vw-sub-offer').forEach(function(sub) {
    const i = sub.getAttribute('data-offer'); // "1".."4"

    // Hide this offer if "Offer N Card" = hide, or all its fields are empty
    const cardFlag = data['offer ' + i + ' card'];
    const explicitHide = cardFlag && isHide(cardFlag);
    const autoHide = !data['offer type ' + i] && !data['monthly payment ' + i]
                  && !data['down payment ' + i] && !data['lease months ' + i];
    const visible = !(explicitHide || autoHide);
    offerVisible[Number(i)] = visible;

    if (!visible) { hide(sub); return; }
    show(sub);

    setText(q(sub, '.vw-offer-type'),      data['offer type ' + i]);
    setText(q(sub, '.vw-monthly-payment'), data['monthly payment ' + i]);
    setText(q(sub, '.vw-down-payment'),    data['down payment ' + i]);
    setText(q(sub, '.vw-lease-months'),    data['lease months ' + i]);

    // Sub-labels — only override the default text when the sheet cell is non-empty
    const setLabel = function(sel, val) {
      const el = q(sub, sel);
      if (el && val && String(val).trim()) el.textContent = String(val).trim();
    };
    setLabel('.vw-monthly-label', data['monthly label ' + i]);
    setLabel('.vw-down-label',    data['down label ' + i]);
    setLabel('.vw-months-label',  data['months label ' + i]);
  });

  // Dividers — show only between two visible offers (N = 2..4)
  card.querySelectorAll('.vw-divider').forEach(function(div) {
    const n = div.getAttribute('data-divider'); // "2".."4"
    const priorVisible = offerVisible.slice(1, Number(n)).some(Boolean);
    const divVal = data['offer ' + n + ' divider'] || '';

    if (!offerVisible[Number(n)] || !priorVisible || isHide(divVal)) {
      hide(div);
    } else {
      show(div);
      const txt = q(div, '.vw-divider-text');
      if (txt) txt.textContent = String(divVal).trim() || 'or';
    }
  });

  // Disclaimers — one per offer, collected at card bottom; hide if empty or offer hidden
  card.querySelectorAll('.vw-disclaimer').forEach(function(disc) {
    const i = disc.getAttribute('data-disc'); // "1".."4"
    const dv = data['offer ' + i + ' disclaimer'] || '';
    if (!offerVisible[Number(i)] || !dv) {
      disc.textContent = '';
      hide(disc);
    } else {
      disc.textContent = dv;
      show(disc);
    }
  });

  const stockEl = q(card, '.vw-stock-number');
  if (stockEl) {
    const sn = data['stock number'];
    stockEl.textContent = sn ? 'STOCK #' + sn : '';
  }

  const img = q(card, '.vw-offer-image');
  if (img) {
    img.src   = data['image url'] || '';
    img.alt   = data['model title'] || '';
    img.title = data['model title'] || '';
  }

  const invBtn = q(card, '.vw-inv-link');
  if (invBtn) {
    const model = data['inventory model'];
    invBtn.href = model
      ? '/new-inventory/index.htm?model=' + encodeURIComponent(model)
      : '/new-inventory/index.htm';
  }
}

// ── Main ──────────────────────────────────────────────────────
async function loadVWGGOffers() {
  const container = document.getElementById('vwgg-specials-container');
  if (!container) {
    console.error('[VWGG] Container #vwgg-specials-container not found.');
    return;
  }

  const csvUrl = container.getAttribute('data-csv');
  if (!csvUrl) {
    console.error('[VWGG] No data-csv attribute on container.');
    return;
  }

  const modelData = await fetchSheet(csvUrl);
  console.log('[VWGG] modelData keys:', Object.keys(modelData));

  const cards = document.querySelectorAll('.vw-car-offer');
  console.log('[VWGG] Card slots found in DOM:', cards.length);

  cards.forEach(function(card) {
    const slotName = card.getAttribute('data-model');
    if (!slotName) return;
    const data = modelData[slotName] || {};
    populateCard(card, data, slotName);
  });
}

// Run after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadVWGGOffers);
} else {
  loadVWGGOffers();
}
