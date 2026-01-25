// public/assets/js/ui.js
// Minimal UI helpers: loading, toast, view render

function getRoot() {
  return (
    document.getElementById("app") ||
    document.querySelector("[data-app]") ||
    document.querySelector("main") ||
    document.body
  );
}

let _loadingEl = null;

export function showLoading(text = "جاري التحميل...") {
  const root = getRoot();
  if (!_loadingEl) {
    _loadingEl = document.createElement("div");
    _loadingEl.id = "__clos_loading__";
    _loadingEl.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(10,7,16,.55); z-index:99999; backdrop-filter: blur(6px);
      font-family: system-ui, -apple-system, Segoe UI, Tahoma, Arial;
    `;
    _loadingEl.innerHTML = `
      <div style="
        min-width: 260px; max-width: 92vw;
        padding: 18px 16px; border-radius: 18px;
        background: rgba(20, 14, 30, .85);
        border: 1px solid rgba(255,255,255,.12);
        color: #fff; text-align:center;">
        <div style="width:44px;height:44px;border:4px solid rgba(255,255,255,.18);
          border-top-color:#b88fcf;border-radius:50%;margin:0 auto 10px;
          animation:spin 1s linear infinite"></div>
        <div id="__clos_loading_txt__" style="opacity:.92">${escapeHtml(text)}</div>
      </div>
      <style>@keyframes spin {to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(_loadingEl);
  } else {
    const t = _loadingEl.querySelector("#__clos_loading_txt__");
    if (t) t.textContent = text;
    _loadingEl.style.display = "flex";
  }
}

export function hideLoading() {
  if (_loadingEl) _loadingEl.style.display = "none";
}

export function toast(msg, type = "info", ms = 2600) {
  const el = document.createElement("div");
  const color =
    type === "error" ? "#ff6b6b" : type === "success" ? "#4cd964" : "#b88fcf";

  el.style.cssText = `
    position: fixed; bottom: 18px; left: 18px; right: 18px;
    margin: 0 auto; max-width: 560px;
    padding: 12px 14px; border-radius: 14px;
    background: rgba(20,14,30,.92);
    border: 1px solid rgba(255,255,255,.12);
    color: #fff; z-index: 999999;
    font-family: system-ui, -apple-system, Segoe UI, Tahoma, Arial;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  `;
  el.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start">
    <div style="width:10px;height:10px;border-radius:50%;background:${color};margin-top:6px"></div>
    <div style="line-height:1.5;opacity:.95">${escapeHtml(msg)}</div>
  </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function render(html) {
  const root = getRoot();
  // لا نمسح body كله إذا عندك تصميم ثابت
  // نحاول نبدّل داخل عنصر #app إن وجد
  if (root === document.body) {
    // fallback: create container
    let box = document.getElementById("__clos_view__");
    if (!box) {
      box = document.createElement("div");
      box.id = "__clos_view__";
      document.body.appendChild(box);
    }
    box.innerHTML = html;
  } else {
    root.innerHTML = html;
  }
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch];
  });
}
