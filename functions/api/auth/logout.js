import { json, fail } from "../../_lib/response.js";
import { clearCookie } from "../../_lib/security.js";

const COOKIE_NAME = "clos_session";

export async function onRequestPost() {
  try {
    return json({ ok: true, success: true }, 200, { "set-cookie": clearCookie(COOKIE_NAME) });
  } catch (e) {
    return fail(e?.message || String(e), 500);
  }
}

