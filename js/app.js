// ============================================================
// app.js — অ্যাপ বুটস্ট্র্যাপ, রাউটিং, ট্যাব নেভিগেশন
// ============================================================
import { onAuthReady, getCurrentUser, signUp, logIn, logInWithGoogle, friendlyAuthError } from "./auth.js";
import { initProfileOnboarding, renderMyProfile, initProfileTab } from "./profile.js";
import { loadDeck, initSwipeActions } from "./swipe.js";
import { initChatTab } from "./chat.js";
import { initCallControls } from "./videocall.js";
import { showView, showToast, $, $all } from "./ui.js";

let authMode = "login"; // 'login' | 'signup'

function init() {
  initAuthForm();
  initProfileOnboarding();
  initSwipeActions();
  initChatTab();
  initProfileTab();
  initCallControls();
  initTabs();

  document.addEventListener("onboarding-complete", () => {
    enterMainApp();
  });
  document.addEventListener("new-match", (e) => showMatchOverlay(e.detail.user));
  $("#match-overlay-close").addEventListener("click", hideMatchOverlay);
  $("#match-overlay-message").addEventListener("click", () => {
    hideMatchOverlay();
    switchTab("chats");
  });

  onAuthReady((user, userDoc) => {
    if (!user) {
      showView("view-auth");
      return;
    }
    if (!userDoc || !userDoc.onboardingComplete) {
      showView("view-onboarding");
      return;
    }
    enterMainApp(userDoc);
  });
}

function enterMainApp(userDoc) {
  showView("view-main");
  switchTab("home");
  loadDeck();
  renderMyProfile(userDoc || getCurrentUser());
}

// ---------- অথ ফর্ম ----------
function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  $("#auth-name-field").classList.toggle("hidden", authMode === "login");
  $("#auth-submit").textContent = authMode === "login" ? "লগইন করুন" : "অ্যাকাউন্ট তৈরি করুন";
  $("#auth-title").textContent = authMode === "login" ? "আবার স্বাগতম" : "যাত্রা শুরু করুন";
  $("#auth-switch-text").innerHTML = authMode === "login"
    ? `নতুন এখানে? <button type="button" id="auth-switch-btn">অ্যাকাউন্ট তৈরি করুন</button>`
    : `আগে থেকেই অ্যাকাউন্ট আছে? <button type="button" id="auth-switch-btn">লগইন করুন</button>`;
  $("#auth-error").textContent = "";
  // innerHTML প্রতিস্থাপন করেছে বাটনটি — তাই আবার বাইন্ড করা দরকার
  $("#auth-switch-btn").addEventListener("click", toggleAuthMode);
}

function initAuthForm() {
  $("#auth-switch-btn").addEventListener("click", toggleAuthMode);

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#auth-error").textContent = "";
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    const name = $("#auth-name").value.trim();
    const btn = $("#auth-submit");
    btn.disabled = true;
    try {
      if (authMode === "signup") {
        if (!name) { $("#auth-error").textContent = "আপনার নাম লিখুন"; return; }
        await signUp(email, password, name);
      } else {
        await logIn(email, password);
      }
    } catch (err) {
      $("#auth-error").textContent = friendlyAuthError(err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#auth-google").addEventListener("click", async () => {
    try {
      await logInWithGoogle();
    } catch (err) {
      showToast(friendlyAuthError(err), "error");
    }
  });
}

// ---------- ম্যাচ ওভারলে ----------
function showMatchOverlay(otherUser) {
  $("#match-user-name").textContent = otherUser.displayName || "";
  $("#match-avatar-me").src = getCurrentUser().photoURL || "";
  $("#match-avatar-other").src = otherUser.photoURL || "";
  $("#match-overlay").classList.add("show");
}
function hideMatchOverlay() { $("#match-overlay").classList.remove("show"); }

// ---------- নিচের ট্যাব নেভিগেশন ----------
function initTabs() {
  $all(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}
function switchTab(name) {
  $all(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $all(".tab-view").forEach((v) => v.classList.toggle("hidden", v.dataset.tab !== name));
}

document.addEventListener("DOMContentLoaded", init);

// PWA সার্ভিস ওয়ার্কার নিবন্ধন
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
