const CONFIG_URL = "/app-config.json";
const LS_KEY = "APP_CONFIG_CACHE_V1";

export async function loadAppConfig({ timeoutMs = 7000 } = {}) {
  // 1) محاولة من الشبكة
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(CONFIG_URL, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!res.ok) throw new Error(`Config HTTP ${res.status}`);
    const data = await res.json();

    if (!data?.ok || !data?.GAS_URL) throw new Error("Invalid config payload");

    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch (e) {
    // 2) fallback من التخزين المحلي
    const cachedRaw = localStorage.getItem(LS_KEY);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached?.data?.ok && cached?.data?.GAS_URL) return cached.data;
      } catch {}
    }
    throw e;
  }
}
