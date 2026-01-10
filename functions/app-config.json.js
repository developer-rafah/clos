export async function onRequestGet({ env, request }) {
  // ✅ لا نُرجع GAS_URL للفرونت نهائيًا (لأسباب أمنية)
  // ✅ الفرونت يتعامل فقط مع /api (Cloudflare Worker Route)
  const apiBase = "/api";

  // (اختياري) إصدار/بناء للفرونت للتأكد من التحديثات
  const build =
    (env.APP_BUILD || "").trim() ||
    new Date().toISOString().slice(0, 10).replace(/-/g, "_");

  // (اختياري) علامة تشغيل/إيقاف لبعض المزايا
  const flags = {
    pushEnabled: String(env.PUSH_ENABLED || "1").trim() === "1",
  };

  // (اختياري) السماح بكاش قصير
  // لو تبي منع الكاش تماماً: خله "no-store"
  const cacheHeader = "public, max-age=60";

  return new Response(
    JSON.stringify({
      ok: true,
      API_BASE: apiBase,
      BUILD: build,
      FLAGS: flags,

      // ✅ ملاحظة: لا تضع هنا مفاتيح/روابط حساسة
      // لاحقًا يمكن إضافة إعدادات آمنة فقط (مثل public VAPID key للويب Push إذا احتجت)
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": cacheHeader,
      },
    }
  );
}
