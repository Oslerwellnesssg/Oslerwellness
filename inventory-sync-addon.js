
/**
 * Inventory Sync Add-on (non-breaking)
 * - Injects a "Sync now" button next to the Inventory title
 * - Calls your existing window.loadInv() when clicked
 * - Shows a tiny toast for success/error
 * - Auto-refreshes when the page becomes visible
 */
(() => {
  const addToast = (msg, ok = true) => {
    let t = document.createElement('div');
    t.textContent = msg;
    t.style.position = 'fixed';
    t.style.right = '14px';
    t.style.bottom = '14px';
    t.style.padding = '10px 14px';
    t.style.borderRadius = '10px';
    t.style.fontSize = '14px';
    t.style.background = ok ? 'rgba(16,185,129,.95)' : 'rgba(239,68,68,.95)'; // green/red
    t.style.color = 'white';
    t.style.boxShadow = '0 6px 24px rgba(0,0,0,.15)';
    t.style.zIndex = 9999;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  };

  const injectButton = () => {
    // Try to find a title area
    const h1 = Array.from(document.querySelectorAll('h1,h2'))
      .find(el => /Inventory/i.test(el.textContent || ''));
    if (!h1) return;

    // Avoid duplicates
    if (document.getElementById('ow-sync-now')) return;

    const btn = document.createElement('button');
    btn.id = 'ow-sync-now';
    btn.type = 'button';
    btn.textContent = 'Sync now';
    btn.style.marginLeft = '12px';
    btn.style.padding = '6px 12px';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.background = '#f59e0b'; // amber-ish
    btn.style.color = 'white';
    btn.style.fontWeight = '600';
    btn.style.boxShadow = '0 2px 10px rgba(0,0,0,.12)';
    btn.addEventListener('mouseenter', () => (btn.style.opacity = '.9'));
    btn.addEventListener('mouseleave', () => (btn.style.opacity = '1'));

    btn.addEventListener('click', async () => {
      try {
        if (typeof window.loadInv === 'function') {
          const maybe = window.loadInv();
          if (maybe && typeof maybe.then === 'function') {
            await maybe;
          }
          addToast('Inventory refreshed');
        } else {
          addToast('Could not find loadInv() on this page', false);
        }
      } catch (e) {
        console.error(e);
        addToast('Refresh failed. Check console.', false);
      }
    });

    // Place button after the title
    h1.insertAdjacentElement('afterend', btn);
  };

  // Auto refresh on initial load and when tab comes back to foreground
  const autoRefresh = async () => {
    try {
      if (typeof window.loadInv === 'function') {
        const maybe = window.loadInv();
        if (maybe && typeof maybe.then === 'function') await maybe;
      }
    } catch (e) {
      // silent
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectButton();
    // initial auto refresh (non-blocking)
    setTimeout(autoRefresh, 200);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      autoRefresh();
    }
  });
})();
