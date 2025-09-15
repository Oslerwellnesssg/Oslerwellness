// netlify/functions/notify-preorder.js
// Sends an email to IT when a PRE-ORDER is created.
// Requires RESEND_API_KEY. Optional PREORDER_TO_EMAIL and PREORDER_FROM_EMAIL.

export default async function handler(req, context) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      patientId,
      productName,
      sku,
      qty,
      location,
      doctor,
      remarks,
      createdAt
    } = body || {};

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const toEmail = process.env.PREORDER_TO_EMAIL || "it@osler-group.com";
    const fromEmail = process.env.PREORDER_FROM_EMAIL || "noreply@oslerwellness.app";

    const subject = `PRE-ORDER: ${productName || sku} x${qty} (${location})`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
        <h2>New PRE-ORDER</h2>
        <table cellpadding="6" cellspacing="0" border="0" style="border-collapse: collapse">
          <tr><td><strong>Created</strong></td><td>${createdAt || new Date().toISOString()}</td></tr>
          <tr><td><strong>Patient</strong></td><td>${patientId || "-"}</td></tr>
          <tr><td><strong>Product</strong></td><td>${productName || "-"}</td></tr>
          <tr><td><strong>SKU</strong></td><td>${sku || "-"}</td></tr>
          <tr><td><strong>Qty</strong></td><td>${qty || "-"}</td></tr>
          <tr><td><strong>Location</strong></td><td>${location || "-"}</td></tr>
          <tr><td><strong>Doctor</strong></td><td>${doctor || "-"}</td></tr>
          <tr><td><strong>Remarks</strong></td><td>${remarks || ""}</td></tr>
        </table>
      </div>
    `;

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: "Email send failed", details: txt }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, id: data.id || null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
