// Optional "Sync now" button handler.
// Default: NO-OP that returns ok:true, skipped:true to avoid errors if Admin API not configured.
exports.handler = async () => {
  if (!process.env.ENABLE_SYNC_NOW) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, skipped: true, reason: "disabled_no_admin_api" })
    };
  }
  // If you later wire the Admin API, implement here.
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, message: "Sync stub" })
  };
};
