import { ok } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const { user } = auth;

  // ✅ اجعل token مصدره مرنًا (لضمان عدم رجوع undefined)
  const token = auth.token || user.token || "";

  return ok({
    user: { username: user.username, name: user.name || "", role: user.role },
    token,
  });
}
