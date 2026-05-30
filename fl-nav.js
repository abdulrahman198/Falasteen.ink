// fl-nav.js — mark the active bottom-nav link for the current page.
// Matches the real markup: .bottom-nav a[href="Page.html"] (with optional
// data-page override). Safe to load alongside pages that already hardcode
// class="active" — it simply re-affirms the correct link.
(function() {
  function currentPage() {
    var segments = window.location.pathname.split('/').filter(Boolean);
    var last = segments.length ? segments[segments.length - 1] : '';
    return (last.replace('.html', '') || 'Index').toLowerCase();
  }

  document.addEventListener('DOMContentLoaded', function() {
    var page = currentPage();
    document.querySelectorAll('.bottom-nav a').forEach(function(a) {
      var target = a.dataset.page
        ? a.dataset.page
        : (a.getAttribute('href') || '').split('/').pop().replace('.html', '');
      if (target && target.toLowerCase() === page) a.classList.add('active');
    });
  });
})();
