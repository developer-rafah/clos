import { ok } from "../_lib/response.js";

export async function onRequestGet() {
  return ok({ where: "cloudflare-pages-functions", time: new Date().toISOString() });
}

