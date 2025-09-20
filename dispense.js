/* dispense.js
 * Adds a fallback: if normal dispense fails with "Insufficient stock",
 * offer to create a PRE-ORDER (no stock change) and then redirect to records.
 *
 * Requirements:
 * - A Supabase client can be created from window.SUPABASE_URL / window.SUPABASE_ANON_KEY
 *   OR is already available as window.supabase.
 * - The page has the following elements (adjust IDs below if your HTML differs):
 *     #productSelect     (select of products; option value = product UUID)
 *     #locationSelect    (select: "RH1" or "SV")
 *     #qtyInput          (number)
 *     #doctorInput       (text, optional)
 *     #remarksInput      (text/textarea, optional)
 *     #patientIdHidden   (hidden input containing patient id, optional if you pass null)
 *     #submitBtn         (button)
 *     #statusText        (a small <div> or <span> to show "Submitting...")
 * - The database already has:
 *     - function post_sale_at(uuid,text,int,numeric,text,text,text)
 *     - function place_preorder(uuid,text,int,text,text,text) RETURNS uuid
 */

(function () {
  // ---- Helpers -------------------------------------------------------------
  function q(id) { return document.getElementById(id); }
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  // Create or reuse Supabase client
  function ensureSupabase() {
    if (window.supabase) return window.supabase;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      alert('Supabase keys not found on page.');
      throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');
    }
    // globalThis.supabase is provided by @supabase/supabase-js script loaded on the page
    return window.supabase = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }

  function setBusy(on) {
    const btn = q('submitBtn');
    const st = q('statusText');
    if (btn) btn.disabled = !!on;
    if (st) st.textContent = on ? 'Submitting...' : '';
  }

  async function postSaleAt(sb, args) {
    // args: { p_product, p_loc, p_qty, p_price, p_patient, p_doctor, p_remarks }
    return await sb.rpc('post_sale_at', {
      p_product: args.p_product,
      p_loc: args.p_loc,
      p_qty: args.p_qty,
      p_price: args.p_price ?? 0,
      p_patient: args.p_patient ?? null,
      p_doctor: args.p_doctor ?? null,
      p_remarks: args.p_remarks ?? null,
    });
  }

  async function placePreorder(sb, args) {
    // args: { p_product, p_loc, p_qty, p_patient, p_doctor, p_remarks }
    return await sb.rpc('place_preorder', {
      p_product: args.p_product,
      p_loc: args.p_loc,
      p_qty: args.p_qty,
      p_patient: args.p_patient ?? null,
      p_doctor: args.p_doctor ?? null,
      p_remarks: args.p_remarks ?? '',
    });
  }

  // ---- Main submit handler -------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      const sb = ensureSupabase();

      const productId   = q('productSelect').value;    // UUID
      const loc         = q('locationSelect').value;   // 'RH1' | 'SV'
      const qty         = Number(q('qtyInput').value || 0);
      const doctor      = (q('doctorInput') && q('doctorInput').value) || null;
      const remarks     = (q('remarksInput') && q('remarksInput').value) || '';
      const patientIdEl = q('patientIdHidden');
      const patientId   = patientIdEl ? patientIdEl.value : null;

      if (!productId) throw new Error('Please select a product.');
      if (!loc)       throw new Error('Please choose a location.');
      if (!qty || qty <= 0) throw new Error('Quantity must be > 0.');

      // 1) Try the normal dispense
      const { error } = await postSaleAt(sb, {
        p_product: productId,
        p_loc: loc,
        p_qty: qty,
        p_price: 0,
        p_patient: patientId,
        p_doctor: doctor,
        p_remarks: remarks
      });

      if (error) throw error;

      alert('Dispense completed.');
      const token = getQueryParam('token') || '';
      window.location.href = `records.html?token=${encodeURIComponent(token)}`;
    } catch (err) {
      // 2) If insufficient stock, offer PRE-ORDER (no stock change)
      const msg = String(err?.message || err);
      if (/Insufficient stock/i.test(msg)) {
        const loc = q('locationSelect').value;
        const confirmPO = window.confirm(
          `Insufficient stock at ${loc}.\n\nCreate a PRE-ORDER instead (no stock change)?`
        );
        if (!confirmPO) { setBusy(false); return; }

        try {
          const sb = ensureSupabase();
          const productId = q('productSelect').value;
          const qty       = Number(q('qtyInput').value || 0);
          const doctor    = (q('doctorInput') && q('doctorInput').value) || null;
          const remarks   = (q('remarksInput') && q('remarksInput').value) || '';
          const patientId = q('patientIdHidden') ? q('patientIdHidden').value : null;

          const { data, error } = await placePreorder(sb, {
            p_product: productId,
            p_loc: loc,
            p_qty: qty,
            p_patient: patientId,
            p_doctor: doctor,
            p_remarks: remarks
          });
          if (error) throw error;

          alert('Pre-order recorded. (No stock was changed.)');
          const token = getQueryParam('token') || '';
          window.location.href = `records.html?token=${encodeURIComponent(token)}`;
          return;
        } catch (poErr) {
          alert('Pre-order failed: ' + (poErr?.message || poErr));
        }
      } else {
        // Other errors
        alert(msg);
      }
      setBusy(false);
    }
  }

  // ---- Wire up -------------------------------------------------------------
  function boot() {
    const btn = q('submitBtn');
    if (btn) btn.addEventListener('click', handleSubmit);
    const form = document.querySelector('form#dispenseForm');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  // start after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
