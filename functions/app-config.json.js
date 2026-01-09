export async function onRequestGet({ env }) {
  const gasUrl = (env.GAS_URL || "").trim();

  if (!gasUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "GAS_URL is not set in Cloudflare Pages Environment Variables",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      GAS_URL: gasUrl,
      // لاحقًا نضيف هنا مفاتيح أخرى إن احتجنا (مثلاً إعدادات FCM)، بدون لمس كود الفرونت
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // خليه قصير حتى إذا غيرت GAS_URL يتحدث بسرعة
        "cache-control": "public, max-age=60",
      },
    }
  );
}
