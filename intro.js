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

  document.body.style.overflow = 'hidden';
  if (site) site.inert = true;
  enterBtn.focus();

  function finish() {
    sessionStorage.setItem('metro-intro-seen', '1');
    overlay.classList.add('intro-hide');
    document.body.style.overflow = '';
    if (site) site.inert = false;
    video.pause();
    setTimeout(function () { overlay.remove(); }, 700);
  }

  enterBtn.addEventListener('click', function () {
    overlay.classList.add('intro-playing');
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(finish);
  });

  skipBtn.addEventListener('click', finish);
  video.addEventListener('ended', finish);
})();
