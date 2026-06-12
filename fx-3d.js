/* ─────────────────────────────────────────────────────────────
   fx-3d.js — interactive 3D layer for the FIFA World Cup theme
   Pure enhancement: no app logic here. Cards tilt toward the
   cursor with a moving light sheen. Works on dynamically
   rendered cards via event delegation. Skipped on touch
   devices, small screens, and prefers-reduced-motion.
───────────────────────────────────────────────────────────── */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;

  const TILT_SELECTOR =
    '.team-card, .motm-card, .card, .h2h-matchup-header, .pvp-matchup-header, .history-entry';
  const MAX_TILT = 6; // degrees
  let current = null;
  let raf = null;

  function resetTilt(el) {
    if (!el) return;
    el.classList.remove('tilt-active');
    el.style.removeProperty('transform');
    el.style.removeProperty('opacity');
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  }

  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;

    if (current && current !== el) resetTilt(current);
    current = el;
    if (!el || window.innerWidth < 768) return;

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;

      // entrance animations fill forwards and would override the
      // inline transform — kill them once the user starts interacting.
      // The cards' base style is opacity:0 (only the animation makes
      // them visible), so we must pin opacity:1 or they'd vanish.
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.classList.add('tilt-active');
      el.style.transform =
        `perspective(900px)` +
        ` rotateX(${((0.5 - py) * MAX_TILT).toFixed(2)}deg)` +
        ` rotateY(${((px - 0.5) * MAX_TILT).toFixed(2)}deg)` +
        ` translateY(-4px)`;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    });
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    resetTilt(current);
    current = null;
  });
})();
