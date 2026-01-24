import { json, serverError } from "../../_lib/response.js";
import { clearCookie } from "../../_lib/security.js";
import { COOKIE_NAME } from "../../_lib/auth.js";

export async function onRequestPost() {
  try {
    return json(
      { ok: true, success: true },
      {
        status: 200,
        headers: {
          "set-cookie": clearCookie(COOKIE_NAME, { path: "/" }),
        },
      }
    );
  } catch (e) {
    return serverError(e);
  }
}
