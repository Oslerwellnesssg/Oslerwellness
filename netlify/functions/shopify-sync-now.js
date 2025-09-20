const ok = (b) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const err = (e) => ({ statusCode: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: JSON.stringify(e) });

exports.handler = async (event) => {
  try {
    // record a 'manual refresh' event so the table will refetch
    const url = `${process.env.SUPABASE_URL}/rest/v1/shopify_events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{ raw: { note: 'manual refresh' }, status: 'ping' }])
    });
    const text = await res.text();
    if (!res.ok) return err({ ok:false, error:'supabase_error', status: res.status, text });
    return ok({ ok:true });
  } catch (e) {
    return err({ ok:false, error:e.message });
  }
};