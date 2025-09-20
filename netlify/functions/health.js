export async function handler(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    body: JSON.stringify({ ok: true, ts: new Date().toISOString() })
  };
}