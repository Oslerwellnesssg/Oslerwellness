/* Osler Wellness — dispense with preorder fallback */
(function () {
  const statusEl = document.getElementById("status");
  const form = document.getElementById("dispense-form");

  function say(html) {
    statusEl.innerHTML = html;
  }
  function ok(msg) { say(`<div style="color:#34d399">${msg}</div>`); }
  function err(msg) { say(`<div style="color:#fda4af">${msg}</div>`); }

  // Reuse existing supabase client if present
  let supabase = window.supabase;
  if (!supabase) {
    const env = window.__OSLER_ENV__ || {};
    if (!env.url || !env.key) {
      err("Missing Supabase credentials. Make sure __SUPABASE_URL and __SUPABASE_ANON_KEY are set globally.");
      return;
    }
    supabase = window.supabase = window.supabase.createClient(env.url, env.key);
  }

  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function tryDispense(payload) {
    // Call your existing function post_sale_at(product, loc, qty, price, patient, doctor, remarks)
    return rpc("post_sale_at", {
      p_product: payload.product_id,
      p_loc: payload.loc,
      p_qty: payload.qty,
      p_price: payload.price || 0,
      p_patient: payload.patient_id || null,
      p_doctor: payload.doctor_initials || null,
      p_remarks: payload.remarks || null
    });
  }

  async function placePreorder(payload) {
    // place_preorder(product, loc, qty, patient, doctor, remarks)
    return rpc("place_preorder", {
      p_product: payload.product_id,
      p_loc: payload.loc,
      p_qty: payload.qty,
      p_patient: payload.patient_id || null,
      p_doctor: payload.doctor_initials || null,
      p_remarks: (payload.remarks ? payload.remarks + " " : "") + "[PRE-ORDER]"
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err(""); ok("");
    const payload = {
      product_id: document.getElementById("product_id").value.trim(),
      loc: document.getElementById("loc").value.trim(),
      qty: parseInt(document.getElementById("qty").value, 10) || 1,
      patient_id: document.getElementById("patient_id").value.trim() || null,
      doctor_initials: document.getElementById("doctor_initials").value.trim() || null,
      remarks: document.getElementById("remarks").value.trim() || null,
      price: 0
    };

    try {
      await tryDispense(payload);
      ok("✔ Dispense recorded successfully.");
    } catch (e1) {
      const msg = (e1 && e1.message) ? String(e1.message) : String(e1);
      // Detect insufficient stock
      if (/insufficient stock/i.test(msg) || /Insufficient stock/i.test(msg)) {
        const go = window.confirm("Insufficient stock.\n\nWould you like to record a PRE-ORDER (no stock movement) instead?");
        if (!go) { err("Dispense cancelled."); return; }
        try {
          await placePreorder(payload);
          err(""); ok("📝 PRE-ORDER recorded (no stock change). Staff can fulfill later when stock arrives.");
        } catch (e2) {
          err("Failed to create preorder: " + (e2.message || e2));
        }
      } else {
        err("Failed to dispense: " + msg);
      }
    }
  });
})();