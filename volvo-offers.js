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

async function updateOffersFromSheet() {
  console.log("Fetching offers from Google Sheet...");

  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9hPn5l-8ASjL1236ah9LJf4VBi8QSw531JhWp7-7PMSixmI9xMJmqHQ_SQwYwBODAnV224CEhrdmv/pub?output=csv';
  const response = await fetch(csvUrl);
  const csvText = await response.text();
  const parsed = parseCSV(csvText);

  const [fields, ...dataRows] = parsed;
  const modelData = {};

  for (let col = 1; col < fields.length; col++) {
    const modelName = fields[col];
    modelData[modelName] = {};
    for (let row of parsed) {
      const label = row[0];
      const value = row[col];
      modelData[modelName][label] = value;
    }
  }

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
    "Bonus Offers": "bonus-offers"
  };

  document.querySelectorAll('.car-offer').forEach(section => {
    const modelKey = section.dataset.model;
    const data = modelData[modelKey];
    if (!data) return;

    console.log(`Updating content for model: ${modelKey}`);

    // Hide sections if flagged
    Object.entries(hideMap).forEach(([sheetRow, className]) => {
      const value = data[sheetRow];
      if (value && value.toLowerCase() === "hide") {
        const element = section.querySelector(`.${className}`);
        if (element) {
          console.log(`Hiding .${className} for ${modelKey}`);
          element.style.display = "none";
        }
      }
    });

    // Set image if provided
    const imgEl = section.querySelector(".offer-image");
    if (imgEl && data[imageKey]) {
      imgEl.src = data[imageKey];
      imgEl.style.display = "block";
    }

    const mapping = {
      "model": "Model",
      "lease-payment": "Lease Payment",
      "lease-terms": "Lease Terms",
      "lease-disclaimer": "Lease Disclaimer",
      "apr": "APR",
      "apr-terms": "APR Terms",
      "apr-disclaimer": "APR Disclaimer",
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
      "model-bonus": "Model Bonus"
    };

    Object.entries(mapping).forEach(([className, sheetKey]) => {
      const el = section.querySelector(`.${className}`);
      if (!el) return;

      let value = data[sheetKey];

      if (className === "lease-payment" && value && !value.includes('$')) {
        value = `$${value}`;
      }

      if (className === "apr" && value) {
        value = value.includes('%') ? value : `${(parseFloat(value) * 100).toFixed(2)}%`;
      }

      if (value) {
        el.textContent = value;
      } else if (disclaimerClasses.includes(className)) {
        const detailsEl = el.closest('details');
        if (detailsEl) {
          detailsEl.style.display = "none";
        }
      }
    });
  });
}

// 🔁 Resilient loader: wait until .car-offer exists in DOM
function waitForOffersToLoad(retries = 20) {
  if (document.querySelector('.car-offer')) {
    console.log("car-offer element found, loading offer data...");
    updateOffersFromSheet();
  } else if (retries > 0) {
    console.log("Waiting for car-offer to appear...");
    setTimeout(() => waitForOffersToLoad(retries - 1), 300);
  } else {
    console.warn("car-offer not found after retries — script aborted.");
  }
}

waitForOffersToLoad();
