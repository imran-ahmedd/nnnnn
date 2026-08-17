// ============================================================
// ui.js — টোস্ট, ভিউ সুইচিং-এর ছোট হেল্পার
// ============================================================

export function showToast(message, type = "default") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

export function $(sel, ctx = document) { return ctx.querySelector(sel); }
export function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

export function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "এখনই";
  if (s < 3600) return `${Math.floor(s / 60)} মিনিট আগে`;
  if (s < 86400) return `${Math.floor(s / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(s / 86400)} দিন আগে`;
}

export function formatClock(date) {
  return date.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}
