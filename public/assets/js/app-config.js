let _config = null;

export async function getConfig() {
  if (_config) return _config;

  const res = await fetch('/app-config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);

  _config = await res.json();
  if (!_config.GAS_URL) throw new Error('Missing GAS_URL in app-config.json');

  return _config;
}
