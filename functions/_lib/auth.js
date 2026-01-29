// functions/_lib/auth.js
import { verifyJwt } from "./jwt.js";

export function getBearer(req) {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function requireAuth(req, env) {
  const token = getBearer(req);
  if (!token) throw new Error("Unauthorized");
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return payload;
}

export function normalizeRole(r) {
  const s = String(r || "");
  if (s.includes("مدير") || s.toLowerCase() === "admin") return "admin";
  if (s.includes("موظف") || s.toLowerCase() === "staff") return "staff";
  if (s.includes("مندوب") || s.toLowerCase() === "agent") return "agent";
  return s || "agent";
}
