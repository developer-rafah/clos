import { ok } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const { user } = auth;

  // token مرن
  const token = auth.token || user.token || "";

  // ✅ رجّع area_code حتى نعرف هل موجود فعلاً داخل JWT
  return ok({
    user: {
      username: user.username,
      name: user.name || "",
      role: user.role,
      area_code: user.area_code ?? null,
    },
    token,
  });
}
