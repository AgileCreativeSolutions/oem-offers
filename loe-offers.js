(function () {
  var container = document.getElementById('loe-offers-container');
  if (!container) return;
  var csvUrl = container.getAttribute('data-csv');
  if (!csvUrl) return;

  var SKELETON_COUNT = 6;
  var style = document.createElement('style');
  style.textContent =
    '@keyframes loe-shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}' +
    '.loe-skel-wrap{display:flex;flex-wrap:wrap;justify-content:center;margin:0 -8px}' +
    '.loe-skel-card{flex:0 0 calc(33.333% - 16px);margin:8px;background:#f5f5f5;border-radius:10px 10px 0 0;overflow:hidden;min-height:580px;display:flex;flex-direction:column}' +
    '@media(max-width:1023px){.loe-skel-card{flex:0 0 calc(50% - 16px)}}' +
    '@media(max-width:767px){.loe-skel-card{flex:0 0 calc(100% - 16px)}}' +
    '.loe-skel-img{height:220px}.loe-skel-badge{height:36px}' +
    '.loe-skel-body{background:#fff;flex:1;padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px}' +
    '.loe-skel-line{height:12px;border-radius:3px;width:80%}' +
    '.loe-skel-line.title{height:22px;width:55%}.loe-skel-line.short{width:65%}.loe-skel-line.xshort{width:40%}' +
    '.loe-skel-row{display:flex;flex-wrap:wrap;gap:12px;width:100%;justify-content:center}' +
    '.loe-skel-col{flex:1;min-width:80px;display:flex;flex-direction:column;align-items:center;gap:8px}' +
    '.loe-skel-price{height:32px;width:50%;border-radius:3px}' +
    '.loe-skel-btn{height:44px;width:80%;margin-top:12px;border-radius:3px}' +
    '.loe-skel-img,.loe-skel-badge,.loe-skel-line,.loe-skel-price,.loe-skel-btn{' +
      'background-image:linear-gradient(90deg,#e0e0e0 25%,#eeeeee 37%,#e0e0e0 63%);' +
      'background-size:600px 100%;animation:loe-shimmer 1.4s infinite linear}';
  document.head.appendChild(style);

  var skelHTML = '<div class="loe-skel-wrap">';
  for (var s = 0; s < SKELETON_COUNT; s++) {
    skelHTML +=
      '<div class="loe-skel-card">' +
        '<div class="loe-skel-img"></div><div class="loe-skel-badge"></div>' +
        '<div class="loe-skel-body">' +
          '<div class="loe-skel-line xshort"></div><div class="loe-skel-line title"></div>' +
          '<div class="loe-skel-row">' +
            '<div class="loe-skel-col"><div class="loe-skel-line xshort"></div><div class="loe-skel-price"></div><div class="loe-skel-line short"></div></div>' +
            '<div class="loe-skel-col"><div class="loe-skel-line xshort"></div><div class="loe-skel-price"></div><div class="loe-skel-line xshort"></div></div>' +
          '</div>' +
          '<div class="loe-skel-btn"></div>' +
        '</div>' +
      '</div>';
  }
  skelHTML += '</div>';
  container.innerHTML = skelHTML;

  fetch(csvUrl)
    .then(function (r) { return r.text(); })
    .then(function (csv) {
      var rows = parseCSV(csv);
      if (!rows.length) return;

      var fieldMap = {};
      for (var ri = 0; ri < rows.length; ri++) {
        var label = rows[ri][0];
        if (label && label.trim()) fieldMap[label.trim()] = ri;
      }

      var numOffers = 0;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].length - 1 > numOffers) numOffers = rows[i].length - 1;
      }

      var cards = '';
      var navItems = [];

      for (var v = 1; v <= numOffers; v++) {
        var get = (function (col) {
          return function (field) {
            var rowIdx = fieldMap[field];
            if (rowIdx === undefined) return '';
            var row = rows[rowIdx];
            return (row && row[col] !== undefined) ? String(row[col]).trim() : '';
          };
        }(v));

        if (get('Visibility').toLowerCase() === 'hide') continue;
        var model = get('Model');
        if (!model) continue; // skip genuinely empty slots

        var anchorId     = get('Anchor ID') || (model.charAt(0).toUpperCase() + model.slice(1));
        var year         = get('Year');
        var badge        = get('Badge Text');
        var image        = get('Offer Image');
        var vin          = get('VIN');
        var stock        = get('Stock Number');
        var showLease    = get('Lease Visibility').toLowerCase() !== 'hide';
        var showFinance  = get('Finance Visibility').toLowerCase() !== 'hide';
        var showOffer3   = get('Offer 3 Visibility').toLowerCase() !== 'hide';
        var showOffer4   = get('Offer 4 Visibility').toLowerCase() !== 'hide';
        var leasePrice   = get('Lease Price');
        var dueAtSigning = get('Due at Signing');
        var leaseTerm    = get('Lease Term');
        var financeRate  = get('Finance Rate');
        var financeTerm  = get('Finance Term');
        var o3Label      = get('Offer 3 Label');
        var o3Value      = get('Offer 3 Value');
        var o3Term       = get('Offer 3 Term');
        var o3Note       = get('Offer 3 Note');
        var o4Label      = get('Offer 4 Label');
        var o4Value      = get('Offer 4 Value');
        var o4Term       = get('Offer 4 Term');
        var o4Note       = get('Offer 4 Note');
        var ctaText      = get('CTA Text') || 'SHOP ' + model.toUpperCase();
        var ctaUrl       = get('CTA URL')  || '/new-inventory/index.htm?model=' + encodeURIComponent(model);
        var disc1        = get('Disclaimer [1]');
        var disc2        = get('Disclaimer [2]');

        navItems.push('<a href="#' + anchorId + '" class="acs-link-accent acs-nowrap">' + esc(model) + '</a>');

        // Count active panels for column class
        var totalPanels = 0;
        if (showLease   && leasePrice)  totalPanels++;
        if (showFinance && financeRate) totalPanels++;
        if (showOffer3  && o3Value)     totalPanels++;
        if (showOffer4  && o4Value)     totalPanels++;
        var colClass = totalPanels === 1 ? 'acs-columns acs-twelve' : 'acs-columns acs-six';

        var buildPanel = function(label, value, supNum, term, note) {
          return '<div class="' + colClass + '">' +
            '<p class="acs-bold">' + esc(label) + ':</p>' +
            '<h3 class="acs-h6 acs-mb-0 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + esc(value) + '</span><sup>[' + supNum + ']</sup></h3>' +
            (term ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + esc(term) + '</p>' : '') +
            (note ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + esc(note) + '</p>' : '') +
          '</div>';
        }

        var panelHTML = '';
        if (showLease && leasePrice) {
          panelHTML +=
            '<div class="' + colClass + '">' +
              '<p class="acs-bold">Lease:</p>' +
              '<h3 class="acs-h6 acs-mb-0 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + esc(leasePrice) + '</span><nobr>/MO.<sup>[1]</sup></nobr></h3>' +
              '<p class="acs-text-3 acs-mb-0">NJ tax and fees included</p>' +
              (dueAtSigning ? '<p class="acs-text-5 acs-lh-4">' + esc(dueAtSigning) + ' Due at Signing</p>' : '') +
              (leaseTerm    ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + esc(leaseTerm) + '</p>' : '') +
            '</div>';
        }
        if (showFinance && financeRate) {
          panelHTML +=
            '<div class="' + colClass + '">' +
              '<p class="acs-bold">Finance:</p>' +
              '<h3 class="acs-h6 acs-mb-2 acs-bold"><span class="acs-h3 acs-accent2 acs-bold">' + esc(financeRate) + '</span> APR<sup>[2]</sup></h3>' +
              (financeTerm ? '<p class="acs-text-5 acs-lh-4 acs-mb-2">' + esc(financeTerm) + '</p>' : '') +
            '</div>';
        }
        if (showOffer3 && o3Value) panelHTML += buildPanel(o3Label || 'Offer 3', o3Value, 3, o3Term, o3Note);
        if (showOffer4 && o4Value) panelHTML += buildPanel(o4Label || 'Offer 4', o4Value, 4, o4Term, o4Note);

        var discHTML = (disc1 || disc2)
          ? '<div class="acs-row acs-pb-4 acs-bg-white acs-disclaimer-box"><div class="acs-twelve"><details class="acs-text-4 acs-lh-8 acs-px-5 acs-text-center acs-py-2"><summary>Disclaimer</summary>' +
              (disc1 ? '<p class="acs-text-4 acs-lh-5 acs-mb-2">' + esc(disc1) + '</p>' : '') +
              (disc2 ? '<p class="acs-text-4 acs-lh-5 acs-mb-2">' + esc(disc2) + '</p>' : '') +
            '</details></div></div>'
          : '';

        cards +=
          '<div id="' + anchorId + '" class="acs-six-md acs-four-xl acs-columns acs-my-3">' +
            '<div class="acs-offer-cell">' +
              (image ? '<img alt="' + esc(year + ' Lincoln ' + model) + '" src="' + esc(image) + '" class="acs-img-full-width acs-offer-img">' : '') +
              (badge ? '<p class="acs-bg-accent acs-white acs-lh-4 acs-py-2 acs-mb-0">' + esc(badge) + '</p>' : '') +
              '<div class="acs-p-5"><div class="acs-text-center">' +
                '<p class="acs-text-9 acs-lh-5 acs-uppercase">' + esc(year) + ' LINCOLN</p>' +
                '<h2 class="acs-h5 acs-accent2 acs-uppercase acs-bold">' + esc(model) + '</h2>' +
                '<hr>' +
                '<div class="acs-row acs-justify-content-center"><div class="acs-columns">' +
                  (vin || stock ? '<p class="acs-text-4 acs-mb-2">' + (vin ? 'VIN: ' + esc(vin) : '') + (vin && stock ? ' | ' : '') + (stock ? 'Stock Number: ' + esc(stock) : '') + '</p>' : '') +
                  '<p class="acs-text-4 acs-mb-2 acs-italic">Art for illustration purposes only.</p>' +
                  '<div class="acs-row acs-justify-content-center">' + panelHTML + '</div>' +
                '</div></div>' +
              '</div></div>' +
              '<div class="acs-row acs-bg-white"><div class="acs-twelve acs-px-4"><a href="' + esc(ctaUrl) + '" class="acs-button3 acs-button-fw acs-button-margin">' + esc(ctaText) + '</a></div></div>' +
              discHTML +
            '</div>' +
          '</div>';
      }

      container.innerHTML = '<div class="acs-row acs-text-center">' + cards + '</div>';
      var nav = document.getElementById('loe-offers-nav');
      if (nav && navItems.length) nav.innerHTML = navItems.join(' | ');
    })
    .catch(function (err) {
      console.error('[loe-offers] fetch error:', err);
      container.innerHTML = '<p style="padding:20px;text-align:center;">Offers unavailable at this time. Please check back soon.</p>';
    });

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function parseCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      if (!line.trim()) continue;
      var cols = [], cur = '', inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else { inQ = !inQ; }
        } else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
        else { cur += ch; }
      }
      cols.push(cur);
      rows.push(cols);
    }
    return rows;
  }
}());
