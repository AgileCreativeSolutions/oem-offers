(function () {
  'use strict';

  var wrap, track, slides, prevBtn, nextBtn;
  var perView = 1, slidePct = 100, page = 0, pageCount = 1, built = false;

  // Below 768px a slide is 85% of the track, so the next card peeks in and
  // signals the carousel is swipeable (matches the Courtesy reference).
  var MOBILE_PEEK_PCT = 85;

  function calcSlidePct() {
    // Only peek if there's actually a next card to reveal.
    if (slides && slides.length < 2) return 100;
    return window.innerWidth < 768 ? MOBILE_PEEK_PCT : 100;
  }

  // Breakpoints match the page's grid CSS: 1 / 2 @768 / 3 @1024 / 4 @1536
  function calcPerView() {
    var w = window.innerWidth;
    if (w >= 1536) return 4;
    if (w >= 1024) return 3;
    if (w >= 768) return 2;
    return 1;
  }

  function layout() {
    perView = calcPerView();
    slidePct = calcSlidePct();
    pageCount = Math.max(1, Math.ceil(slides.length / perView));
    if (page > pageCount - 1) page = pageCount - 1;
    wrap.style.setProperty('--gst-per-view', perView);
    wrap.style.setProperty('--gst-slide-pct', slidePct + '%');
    apply(true);
  }

  // Translate the track by whole pages. Each slide occupies
  // (slidePct / perView) percent of the track width.
  function offsetFor(p) {
    var slideW = slidePct / perView;          // % of track per slide
    var maxIndex = Math.max(0, slides.length - perView);
    var index = Math.min(p * perView, maxIndex);
    var off = index * slideW;
    // Never scroll past the end: cap so the final slide's right edge lands on
    // the track's right edge (100%). Without this the peek would leave a gap.
    var maxOff = Math.max(0, slides.length * slideW - 100);
    if (off > maxOff) off = maxOff;
    return -off;
  }

  function apply(noAnim) {
    if (noAnim) wrap.classList.add('gst-no-anim');
    track.style.transform = 'translateX(' + offsetFor(page) + '%)';
    if (noAnim) {
      // Force reflow so the transition doesn't animate this jump
      void track.offsetWidth;
      wrap.classList.remove('gst-no-anim');
    }
  }

  function goTo(p) {
    // Loop: wrap around at both ends
    if (p < 0) p = pageCount - 1;
    else if (p > pageCount - 1) p = 0;
    page = p;
    apply(false);
  }

  // ── Swipe / drag ──────────────────────────────────────────────────
  var dragging = false, startX = 0, startY = 0, delta = 0, locked = null;

  function pointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true; locked = null; delta = 0;
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    wrap.classList.add('gst-no-anim', 'gst-dragging');
  }

  function pointerMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    var y = (e.touches ? e.touches[0].clientY : e.clientY);
    var dx = x - startX, dy = y - startY;

    // Decide once whether this gesture is horizontal (drag) or vertical
    // (page scroll). Never hijack a vertical scroll.
    if (locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (locked === 'y') return;

    if (e.cancelable) e.preventDefault();
    delta = dx;
    var pct = (delta / track.offsetWidth) * 100;
    track.style.transform = 'translateX(' + (offsetFor(page) + pct) + '%)';
  }

  function pointerUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('gst-no-anim', 'gst-dragging');
    var threshold = Math.max(40, track.offsetWidth * 0.12);
    if (locked === 'x' && Math.abs(delta) > threshold) {
      goTo(delta < 0 ? page + 1 : page - 1);
    } else {
      apply(false);
    }
    delta = 0; locked = null;
  }

  function build() {
    if (built) return;
    wrap  = document.getElementById('gst-carousel-wrap');
    track = document.getElementById('gst-carousel');
    if (!wrap || !track) return;

    slides = track.querySelectorAll('.car-offer');
    if (!slides.length) return;   // no offers — leave the grid alone

    prevBtn = wrap.querySelector('.gst-prev');
    nextBtn = wrap.querySelector('.gst-next');

    // Wrap the track in a clipping viewport. The wrapper itself can't clip,
    // because the arrows sit in its side padding and would be cut off.
    var viewport = document.createElement('div');
    viewport.className = 'gst-viewport';
    track.parentNode.insertBefore(viewport, track);
    viewport.appendChild(track);

    built = true;
    wrap.classList.add('gst-is-carousel');
    layout();

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(page - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(page + 1); });

    track.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    track.addEventListener('touchstart', pointerDown, { passive: true });
    track.addEventListener('touchmove', pointerMove, { passive: false });
    track.addEventListener('touchend', pointerUp);

    // Don't let a drag fire the card's links
    track.addEventListener('click', function (e) {
      if (Math.abs(delta) > 5) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 150);
    });
  }

  // gst-offers.js dispatches gst:ready after all builders resolve and after a
  // double rAF, so cards are populated, revealed and laid out before we build.
  document.addEventListener('gst:ready', function () {
    try { build(); }
    catch (e) { console.error('[gst-carousel] init failed:', e); }
  });
})();
