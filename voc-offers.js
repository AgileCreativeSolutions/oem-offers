(function () {
  const container = document.getElementById('voc-offers-container');
  if (!container) return;
  const csvUrl = container.getAttribute('data-csv');
  if (!csvUrl) return;

  fetch(csvUrl)
    .then(function (r) { return r.text(); })
    .then(function (csv) {
      const rows = parseCSV(csv);
      if (!rows.length) return;

      // Structure: fields as rows, vehicles as columns
      // rows[0] = ["Field", "Offer 1", "Offer 2", ...]
      // rows[1] = ["Visibility", "", "hide", ...]

      const fieldMap = {};
      rows.forEach(function (row, i) {
        if (row[0]) fieldMap[row[0].trim()] = i;
      });

      const numVehicles = rows[0].length - 1;
      let html = '';

      for (let v = 1; v <= numVehicles; v++) {
        function get(field) {
          return (rows[fieldMap[field]] && rows[fieldMap[field]][v] !== undefined)
            ? rows[fieldMap[field]][v].trim()
            : '';
        }

        if (get('Visibility').toLowerCase() === 'hide') continue;

        const year        = get('Year');
        const make        = get('Make') || 'Volvo';
        const model       = get('Model / Trim');
        const stock       = get('Stock #');
        const imgUrl      = get('Image URL');
        const offerType   = get('Offer Type');
        const payment     = get('Monthly Payment');
        const term        = get('Term');
        const miles       = get('Miles Per Year');
        const dueSigning  = get('Due at Signing');
        const ctaText     = get('CTA Button Text');
        const ctaUrl      = get('CTA Button URL');
        const disclaimer  = get('Disclaimer');
        const modelSlug   = model.split(' ')[0];
        const shopUrl     = ctaUrl || ('/new-inventory/index.htm?model=' + modelSlug);

        html += '<div class="acs-six-md acs-four-lg acs-columns acs-mb-5">' +
          '<div class="acs-bg-accent acs-white">' +
            '<div class="acs-p-5">' +
              '<p class="acs-text-5">' + year + ' ' + make + '</p>' +
              '<h2 class="acs-h5">' + model + '</h2>' +
            '</div>' +
          '</div>' +
          '<div class="acs-twelve-md acs-bg-white acs-pb-5 acs-text-center">' +
            '<img src="' + imgUrl + '" title="' + year + ' ' + make + ' ' + model + '" alt="' + year + ' ' + make + ' ' + model + '" class="acs-img-full-width acs-ma acs-p-3">' +
            '<div class="acs-px-5">' +
              '<p class="acs-text-5">Stock # ' + stock + '</p>' +
              '<div class="acs-row acs-justify-content-center">' +
                '<div class="acs-ten-sm">' +
                  '<p class="acs-text-8 acs-black">' + offerType + ':</p>' +
                  '<p class="acs-h3 acs-accent acs-lh-4 acs-bold">' + payment + '</p>' +
                  (term        ? '<p class="acs-text-6 acs-black acs-lh-4">' + term + '</p>'       : '') +
                  (miles       ? '<p class="acs-text-6 acs-black acs-lh-4">' + miles + '</p>'      : '') +
                  (dueSigning  ? '<p class="acs-text-4 acs-mt-2 acs-opacity-50 acs-black acs-lh-4">' + dueSigning + '</p>' : '') +
                '</div>' +
              '</div>' +
              '<div class="acs-my-5">' +
                '<a class="acs-button acs-button-fw" href="' + shopUrl + '">' + ctaText + '</a>' +
              '</div>' +
            '</div>' +
            (disclaimer
              ? '<div class="acs-mt-5">' +
                  '<details class="acs-details">' +
                    '<summary class="acs-summary acs-text-5 acs-mb-3"><span>Disclaimers</span></summary>' +
                    '<div class="content acs-text-left">' +
                      '<p class="acs-text-4 acs-px-5 acs-mb-5">' + disclaimer + '</p>' +
                    '</div>' +
                  '</details>' +
                '</div>'
              : '') +
          '</div>' +
        '</div>';
      }

      document.getElementById('voc-offers-row').innerHTML = html;
    })
    .catch(function (err) { console.error('VOC Offers Error:', err); });

  function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (!line.trim()) continue;
      const row = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) {
          row.push(cur); cur = '';
        } else {
          cur += c;
        }
      }
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }
})();
