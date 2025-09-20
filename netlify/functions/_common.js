function env(name, required = true) {
  const v = process.env[name];
  if (!v && required) throw new Error(`Missing env ${name}`);
  return v;
}

async function supabaseFetch(path, opts = {}) {
  const url = `${env('SUPABASE_URL')}${path}`;
  const headers = Object.assign(
    { 'Content-Type': 'application/json', 'apikey': env('SUPABASE_SERVICE_ROLE'), 'Authorization': `Bearer ${env('SUPABASE_SERVICE_ROLE')}` },
    opts.headers || {}
  );
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return data;
}

export { env, supabaseFetch };