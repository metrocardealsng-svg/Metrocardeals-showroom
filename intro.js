(function () {
  var overlay = document.getElementById('introOverlay');
  if (!overlay) return;

  if (document.documentElement.classList.contains('intro-seen')) {
    overlay.remove();
    return;
  }

  var site = document.getElementById('siteContent');
  var video = document.getElementById('introVideo');
  var enterBtn = document.getElementById('introEnter');
  var skipBtn = document.getElementById('introSkip');

  var REQUIRED = 320;
  var reveal = 0;
  var triggered = false;

  document.body.style.overflow = 'hidden';
  if (site) site.inert = true;
  enterBtn.focus();

  function setReveal(value) {
    reveal = Math.max(0, Math.min(1, value));
    overlay.style.setProperty('--reveal', String(reveal));
  }

  function finish() {
    sessionStorage.setItem('metro-intro-seen', '1');
    overlay.classList.add('intro-hide');
    document.body.style.overflow = '';
    if (site) site.inert = false;
    video.pause();
    setTimeout(function () { overlay.remove(); }, 700);
  }

  function beginPlayback() {
    if (triggered) return;
    triggered = true;
    setReveal(1);
    overlay.classList.add('intro-playing');
    video.currentTime = 0;
    video.muted = false;
    video.play().catch(function () {
      // iOS blocks unmuted playback unless play() is called directly from a
      // discrete tap/click gesture — a touchmove-driven call gets rejected.
      // Fall back to a muted play so the reveal still happens visually.
      video.muted = true;
      video.play().catch(finish);
    });
  }

  function onWheel(e) {
    if (triggered) return;
    if (e.ctrlKey) return;
    e.preventDefault();
    setReveal(reveal + e.deltaY / REQUIRED);
    if (reveal >= 1) beginPlayback();
  }

  var touchStartY = null;
  function onTouchStart(e) {
    if (triggered) return;
    touchStartY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (triggered || touchStartY === null) return;
    e.preventDefault();
    var delta = touchStartY - e.touches[0].clientY;
    touchStartY = e.touches[0].clientY;
    setReveal(reveal + delta / REQUIRED);
  }
  function onTouchEnd() {
    // Only actually start playback on touchend: iOS Safari treats touchmove
    // as too indirect a gesture to permit unmuted video.play() from it.
    if (!triggered && reveal >= 1) beginPlayback();
  }

  overlay.addEventListener('wheel', onWheel, { passive: false });
  overlay.addEventListener('touchstart', onTouchStart, { passive: true });
  overlay.addEventListener('touchmove', onTouchMove, { passive: false });
  overlay.addEventListener('touchend', onTouchEnd, { passive: true });

  enterBtn.addEventListener('click', beginPlayback);
  skipBtn.addEventListener('click', finish);
  video.addEventListener('ended', finish);
})();
