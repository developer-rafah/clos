import { json, serverError } from "../../_lib/response.js";
import { requireAuth } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const { user, token, errorResponse } = await requireAuth(request, env);
    if (errorResponse) return errorResponse;

    return json({
      ok: true,
      success: true,
      user,
      token, // مفيد للديبغ
    });
  } catch (e) {
    return serverError(e);
  }
}
