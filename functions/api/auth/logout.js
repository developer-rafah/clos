import { ok } from "../../_lib/response.js";
import { clearCookie } from "../../_lib/security.js";
import { COOKIE_NAME } from "../../_lib/auth.js";

export async function onRequestPost() {
  return ok(
    { message: "Logged out" },
    200,
    { "set-cookie": clearCookie(COOKIE_NAME, { path: "/" }) }
  );
}
