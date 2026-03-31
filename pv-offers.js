(function () {
  var container = document.getElementById('pv-offers-container');
  if (!container) return;
  var csvUrl = container.getAttribute('data-csv');
  if (!csvUrl) return;

  var SKELETON_COUNT = 6;
  var style = document.createElement('style');
  style.textContent =
    '@keyframes pv-shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}' +
    '.pv-skel-wrap{display:flex;flex-wrap:wrap;margin:0 -8px}' +
    '.pv-skel-card{flex:0 0 calc(50% - 16px);margin:8px;background:#f5f5f5;border-radius:4px;overflow:hidden;min-height:520px;display:flex;flex-direction:column}' +
    '@media(max-width:1023px){.pv-skel-card{flex:0 0 calc(100% - 16px)}}' +
    '.pv-skel-badge{height:38px}' +
    '.pv-skel-title{height:28px;width:55%;margin:20px 20px 0;border-radius:3px}' +
    '.pv-skel-img{height:200px;margin:16px 20px;border-radius:3px}' +
    '.pv-skel-body{background:#fff;flex:1;padding:20px}' +
    '.pv-skel-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}' +
    '.pv-skel-col{flex:1;min-width:120px;display:flex;flex-direction:column;gap:8px}' +
    '.pv-skel-line{height:12px;border-radius:3px}' +
    '.pv-skel-line.tall{height:28px;width:60%}' +
    '.pv-skel-line.short{width:70%}' +
    '.pv-skel-line.xshort{width:45%}' +
    '.pv-skel-btns{display:flex;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0}' +
    '.pv-skel-btn{height:38px;border-radius:3px}' +
    '.pv-skel-btn.primary{flex:0 0 160px}' +
    '.pv-skel-btn.secondary{flex:0 0 120px}' +
    '.pv-skel-badge,.pv-skel-title,.pv-skel-img,.pv-skel-line,.pv-skel-btn{' +
      'background-image:linear-gradient(90deg,#e0e0e0 25%,#f0f0f0 37%,#e0e0e0 63%);' +
      'background-size:600px 100%;animation:pv-shimmer 1.4s infinite linear}';
  document.head.appendChild(style);

  var skelHTML = '<div class="pv-skel-wrap">';
  for (var s = 0; s < SKELETON_COUNT; s++) {
    skelHTML +=
      '<div class="pv-skel-card">' +
        '<div class="pv-skel-badge"></div>' +
        '<div class="pv-skel-title pv-skel-badge"></div>' +
        '<div class="pv-skel-img pv-skel-badge"></div>' +
        '<div class="pv-skel-body">' +
          '<div class="pv-skel-row">' +
            '<div class="pv-skel-col"><div class="pv-skel-line xshort"></div><div class="pv-skel-line tall"></div><div class="pv-skel-line short"></div></div>' +
            '<div class="pv-skel-col"><div class="pv-skel-line xshort"></div><div class="pv-skel-line tall"></div><div class="pv-skel-line"></div></div>' +
          '</div>' +
          '<div class="pv-skel-btns"><div class="pv-skel-btn primary"></div><div class="pv-skel-btn secondary"></div></div>' +
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

        var anchorId     = get('Anchor ID') || model.toLowerCase().replace(/\s+/g, '-');
        var year         = get('Year');
        var badge        = get('Badge Text');
        var image        = get('Offer Image');
        var showLease    = get('Lease Visibility').toLowerCase() !== 'hide';
        var showFinance  = get('Finance Visibility').toLowerCase() !== 'hide';
        var showOffer3   = get('Offer 3 Visibility').toLowerCase() !== 'hide';
        var showOffer4   = get('Offer 4 Visibility').toLowerCase() !== 'hide';
        var leasePrice   = get('Lease Price');
        var leaseTerm    = get('Lease Term');
        var dueAtSigning = get('Due at Signing');
        var modelNote    = get('Model Note');
        var financeRate  = get('Finance Rate');
        var financeNote  = get('Finance Note');
        var o3Label      = get('Offer 3 Label');
        var o3Value      = get('Offer 3 Value');
        var o3Term       = get('Offer 3 Term');
        var o3Note       = get('Offer 3 Note');
        var o4Label      = get('Offer 4 Label');
        var o4Value      = get('Offer 4 Value');
        var o4Term       = get('Offer 4 Term');
        var o4Note       = get('Offer 4 Note');
        var cta1Text     = get('CTA 1 Text') || 'Get This Special';
        var cta1Url      = get('CTA 1 URL')  || '/special-offer-contact-form.htm';
        var cta2Text     = get('CTA 2 Text') || 'View Inventory';
        var cta2Url      = get('CTA 2 URL')  || '/new-inventory/index.htm';
        var disc1        = get('Disclaimer [1]');
        var disc2        = get('Disclaimer [2]');

        navItems.push('<a href="#' + anchorId + '" class="acs-accent">' + esc(model) + '</a>');

        // Count active panels to determine column widths
        var activePanels = [];
        if (showLease   && leasePrice)  activePanels.push('lease');
        if (showFinance && financeRate) activePanels.push('finance');
        if (showOffer3  && o3Value)     activePanels.push('o3');
        if (showOffer4  && o4Value)     activePanels.push('o4');

        var totalPanels = activePanels.length;
        // 1 panel = full width, 2 = half, 3-4 = half (wraps to 2x2)
        var colClass = totalPanels === 1
          ? 'acs-twelve acs-columns acs-px-4 acs-p-4'
          : 'acs-six-lg acs-columns acs-border-offer acs-px-4 acs-p-4';

        var buildPanel = function(label, value, supNum, term, note) {
          return '<div class="' + colClass + '">' +
            '<p class="acs-text-6">' + esc(label) + '</p>' +
            '<p class="acs-text-10 acs-lh-4 acs-mb-2"><span class="acs-bold acs-lh-4">' + esc(value) + '</span><span class="acs-text-5"> <sup>[' + supNum + ']</sup></span></p>' +
            (term ? '<p class="acs-text-5 acs-n-ls-1 acs-mb-2 acs-lh-4 acs-opacity-50">' + esc(term) + '</p>' : '') +
            (note ? '<p class="acs-text-5 acs-n-ls-1 acs-lh-4 acs-opacity-50">' + esc(note) + '</p>' : '') +
          '</div>';
        }

        var panelHTML = '';
        if (showLease && leasePrice) {
          panelHTML +=
            '<div class="' + colClass + '">' +
              '<p class="acs-text-6">Lease</p>' +
              '<p class="acs-text-10 acs-lh-4 acs-mb-2"><span class="acs-bold acs-lh-4">' + esc(leasePrice) + '</span><span class="acs-text-5 acs-lh-4"> per <nobr>month<sup> [1]</sup></nobr></span></p>' +
              ((leaseTerm || dueAtSigning) ? '<p class="acs-text-5 acs-n-ls-1 acs-mb-2 acs-lh-4 acs-opacity-50">' + (leaseTerm ? 'for ' + esc(leaseTerm) : '') + (leaseTerm && dueAtSigning ? '; ' : '') + (dueAtSigning ? esc(dueAtSigning) : '') + '</p>' : '') +
              (modelNote ? '<p class="acs-text-5 acs-n-ls-1 acs-lh-4 acs-italic acs-opacity-50">' + esc(modelNote) + '</p>' : '') +
            '</div>';
        }
        if (showFinance && financeRate) {
          panelHTML +=
            '<div class="' + colClass + '">' +
              '<p class="acs-text-6">Finance</p>' +
              '<p class="acs-text-10 acs-lh-4 acs-mb-2"><span class="acs-bold">' + esc(financeRate) + '</span><span class="acs-text-5"> APR<sup> [2]</sup></span></p>' +
              (financeNote ? '<p class="acs-text-5 acs-n-ls-1 acs-mb-2 acs-lh-4 acs-opacity-50">' + esc(financeNote) + '</p>' : '') +
            '</div>';
        }
        if (showOffer3 && o3Value) panelHTML += buildPanel(o3Label || 'Offer', o3Value, 3, o3Term, o3Note);
        if (showOffer4 && o4Value) panelHTML += buildPanel(o4Label || 'Offer', o4Value, 4, o4Term, o4Note);

        var stlHTML = showLease
          ? '<div class="acs-mt-2 acs-columns acs-text-center-xl"><p class="acs-bold acs-text-5 acs-lh-4 acs-my-2">Interested in a <span class="acs-nowrap">Short Term Lease</span> Quote? <a href="#/" onclick="liteModal.open(\'#shorttermleasepopup\')" tabindex="0" class="acs-link-accent acs-underline" data-mv="' + esc(model) + ' Recharge">Learn More +</a></p></div>'
          : '';

        var discHTML = (disc1 || disc2)
          ? '<details class="acs-text-4 acs-lh-8 acs-px-5"><summary>Disclaimer</summary>' + (disc1 ? '<p class="acs-text-3 acs-mb-2">' + esc(disc1) + '</p>' : '') + (disc2 ? '<p class="acs-text-3 acs-mb-2">' + esc(disc2) + '</p>' : '') + '</details>'
          : '';

        cards +=
          '<div id="' + anchorId + '" class="acs-six-xl acs-columns acs-my-2">' +
            '<div class="acs-offer-cell acs-bg-gray acs-border acs-br-2">' +
              (badge ? '<p class="acs-bg-accent acs-p-2 acs-text-5 acs-lh-4 acs-align-items-center acs-mb-2 acs-text-center acs-white"><span class="acs-bold">' + esc(badge) + '</span></p>' : '') +
              '<div class="acs-lease-model acs-pt-5 acs-px-5 acs-relative acs-z-index-3"><h4 class="acs-h4 acs-mb-3"><span class="acs-text-7 acs-display-block">' + esc(year) + ' Volvo</span> ' + esc(model) + '</h4></div>' +
              (image ? '<img src="' + esc(image) + '" class="acs-img-full-width acs-px-5 acs-mt-9 acs-mb-9" alt="' + esc(year + ' Volvo ' + model) + '">' : '') +
              '<div class="acs-row acs-p-5 acs-bg-white"><div class="acs-twelve">' +
                '<div class="acs-row">' + panelHTML + stlHTML + '</div>' +
                '<hr>' +
                '<div class="acs-row acs-align-self-end">' +
                  '<div class="acs-six-sm acs-five-xl acs-p-2 acs-align-self-end"><a href="' + esc(cta1Url) + '" class="acs-button5">' + esc(cta1Text) + '</a></div>' +
                  '<div class="acs-six-sm acs-twelve acs-six-xl acs-p-2 acs-align-self-end"><a href="' + esc(cta2Url) + '" class="acs-link-accent3">' + esc(cta2Text) + ' &gt;</a></div>' +
                '</div>' +
                discHTML +
              '</div></div>' +
            '</div>' +
          '</div>';
      }

      container.innerHTML = '<div class="acs-row acs-lease-specials">' + cards + '</div>';
      var nav = document.getElementById('pv-offers-nav');
      if (nav && navItems.length) nav.innerHTML = navItems.join('&nbsp;|&nbsp;');
    })
    .catch(function (err) {
      console.error('[pv-offers] fetch error:', err);
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
