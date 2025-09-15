// dispense.js — legacy UI preserved; only logic changed to support PRE-ORDER flow.
//
// Requirements: the page must provide the following inputs/ids:
//   #productSelect, #locationSelect, #qtyInput, #patientIdInput, #doctorInitialsInput, #remarksInput, #submitBtn
// and must have a Supabase client exposed as window.supabase (same as before).

function toast(msg) { alert(msg); }

async function getOnHandFor(supabase, productId, loc) {
  const { data, error } = await supabase
    .from('products_with_balances')
    .select('id,on_hand_sv,on_hand_rh1')
    .eq('id', productId)
    .single();
  if (error) throw error;
  if (loc === 'SV')  return data?.on_hand_sv  ?? 0;
  if (loc === 'RH1') return data?.on_hand_rh1 ?? 0;
  return 0;
}

async function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;

  try {
    const productId  = document.getElementById('productSelect').value;
    const loc        = document.getElementById('locationSelect').value;   // 'SV' or 'RH1'
    const qty        = parseInt(document.getElementById('qtyInput').value || '0', 10);
    const patientId  = (document.getElementById('patientIdInput')?.value || '').trim();
    const doctorInit = (document.getElementById('doctorInitialsInput')?.value || '').trim();
    const remarks    = (document.getElementById('remarksInput')?.value || '').trim();

    if (!productId || !loc || !qty || qty <= 0) {
      toast('Please choose product, location and a positive quantity.');
      return;
    }

    // 1) Check stock
    const onHand = await getOnHandFor(window.supabase, productId, loc);

    if (onHand >= qty) {
      // Normal dispense
      const { error: saleErr } = await window.supabase.rpc('post_sale_at', {
        p_product: productId,
        p_loc: loc,
        p_qty: qty,
        p_price: 0,
        p_patient: patientId || null,
        p_doctor: doctorInit || null,
        p_remarks: remarks || null
      });
      if (saleErr) throw saleErr;
      toast('Dispensed successfully.');
      e.target.reset?.();
      return;
    }

    // Insufficient — offer pre-order
    const msg = `Insufficient stock at ${loc}. On hand: ${onHand}.\\n\\n` +
                `Record a PRE-ORDER instead? (No stock will be moved.)`;
    const ok = confirm(msg);
    if (!ok) return;

    const { error: preErr } = await window.supabase.rpc('place_preorder', {
      p_product: productId,
      p_loc: loc,
      p_qty: qty,
      p_patient: patientId || null,
      p_doctor: doctorInit || null,
      p_remarks: remarks || null
    });
    if (preErr) throw preErr;

    toast('Pre-order recorded (no stock deducted).');
    e.target.reset?.();

  } catch (err) {
    const msg = err?.message || String(err);
    if (/Insufficient stock/i.test(msg)) {
      const productId  = document.getElementById('productSelect').value;
      const loc        = document.getElementById('locationSelect').value;
      const qty        = parseInt(document.getElementById('qtyInput').value || '0', 10);
      const patientId  = (document.getElementById('patientIdInput')?.value || '').trim();
      const doctorInit = (document.getElementById('doctorInitialsInput')?.value || '').trim();
      const remarks    = (document.getElementById('remarksInput')?.value || '').trim();

      const ok = confirm('Stock is insufficient. Record a PRE-ORDER instead?');
      if (ok) {
        const { error: preErr } = await window.supabase.rpc('place_preorder', {
          p_product: productId,
          p_loc: loc,
          p_qty: qty,
          p_patient: patientId || null,
          p_doctor: doctorInit || null,
          p_remarks: remarks || null
        });
        if (preErr) alert(`Pre-order failed: ${preErr.message}`);
        else { alert('Pre-order recorded.'); e.target.reset?.(); }
      }
    } else {
      alert(`Error: ${msg}`);
    }
  } finally {
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (form) form.addEventListener('submit', handleSubmit);
});