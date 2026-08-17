// ============================================================
// swipe.js — ডিসকভারি ডেক, সোয়াইপ জেসচার, লাইক/পাস, ম্যাচ ডিটেকশন
// ============================================================
import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, limit,
  doc, setDoc, getDoc, serverTimestamp, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getCurrentUser, getCurrentUserDoc } from "./auth.js";
import { $, showToast } from "./ui.js";

let deck = [];
let swipedUids = new Set();
const deckEl = () => document.getElementById("swipe-deck");

export async function loadDeck() {
  const me = getCurrentUser();
  const myDoc = getCurrentUserDoc();
  deckEl().innerHTML = `<div class="loader"></div>`;

  // ইতিমধ্যে সোয়াইপ করা ইউজারদের বাদ দেওয়ার জন্য লিস্ট বের করা
  const swipesSnap = await getDocs(collection(db, "users", me.uid, "swipes"));
  swipedUids = new Set(swipesSnap.docs.map((d) => d.id));

  const targetGender = myDoc?.lookingFor === "everyone" ? null : myDoc?.lookingFor;
  let q = targetGender
    ? query(collection(db, "users"), where("gender", "==", targetGender), where("onboardingComplete", "==", true), limit(30))
    : query(collection(db, "users"), where("onboardingComplete", "==", true), limit(30));

  const snap = await getDocs(q);
  deck = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.uid !== me.uid && !swipedUids.has(u.uid));

  renderDeck();
}

function renderDeck() {
  const el = deckEl();
  el.innerHTML = "";
  if (deck.length === 0) {
    el.innerHTML = `
      <div class="deck-empty">
        <div class="mark">🌙</div>
        <h3>আপাতত আর কেউ নেই</h3>
        <p class="mt-8">নতুন মানুষ যোগ হলে আবার দেখা যাবে। একটু পরে আবার চেষ্টা করুন।</p>
        <button class="btn btn-primary mt-16" id="btn-reload-deck">আবার লোড করুন</button>
      </div>`;
    $("#btn-reload-deck")?.addEventListener("click", loadDeck);
    return;
  }
  // পেছন থেকে সামনে — শীর্ষ কার্ড সবার উপরে
  deck.slice(0, 5).reverse().forEach((u, i) => el.appendChild(buildCard(u)));
  attachGestures();
}

function buildCard(u) {
  const card = document.createElement("div");
  card.className = "swipe-card";
  card.dataset.uid = u.uid;
  const photo = u.photos?.[0] || u.photoURL || "";
  card.innerHTML = `
    <img src="${photo}" alt="${u.displayName}">
    <div class="scrim"></div>
    <div class="badge-stamp like">পছন্দ</div>
    <div class="badge-stamp pass">বাদ</div>
    <div class="info">
      <h3>${u.displayName || ""} <span class="age">${u.age || ""}</span></h3>
      <p>${(u.interests || []).slice(0, 3).join(" · ")}</p>
    </div>`;
  return card;
}

function attachGestures() {
  const cards = [...deckEl().querySelectorAll(".swipe-card")];
  const top = cards[cards.length - 1];
  if (!top) return;

  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

  const onStart = (x, y) => { dragging = true; startX = x; startY = y; top.style.transition = "none"; };
  const onMove = (x, y) => {
    if (!dragging) return;
    dx = x - startX; dy = y - startY;
    const rot = dx / 18;
    top.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    const likeBadge = top.querySelector(".badge-stamp.like");
    const passBadge = top.querySelector(".badge-stamp.pass");
    likeBadge.style.opacity = Math.max(0, dx / 100);
    passBadge.style.opacity = Math.max(0, -dx / 100);
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    top.style.transition = "";
    if (Math.abs(dx) > 100) {
      resolveSwipe(top, dx > 0 ? "like" : "pass");
    } else {
      top.style.transform = "";
      top.querySelector(".badge-stamp.like").style.opacity = 0;
      top.querySelector(".badge-stamp.pass").style.opacity = 0;
    }
    dx = 0; dy = 0;
  };

  top.addEventListener("pointerdown", (e) => onStart(e.clientX, e.clientY));
  top.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
  top.addEventListener("pointerup", onEnd);
  top.addEventListener("pointerleave", () => { if (dragging) onEnd(); });
}

export function swipeButton(direction) {
  const top = deckEl().querySelector(".swipe-card:last-child");
  if (!top) return;
  resolveSwipe(top, direction);
}

function resolveSwipe(cardEl, direction) {
  const flyX = direction === "like" ? 600 : -600;
  cardEl.style.transform = `translate(${flyX}px, -40px) rotate(${direction === "like" ? 30 : -30}deg)`;
  cardEl.style.opacity = "0";
  const uid = cardEl.dataset.uid;
  setTimeout(() => {
    cardEl.remove();
    deck = deck.filter((u) => u.uid !== uid);
    if (deckEl().children.length < 2 && deck.length > deckEl().children.length) {
      const next = deck[deckEl().children.length + 1];
      if (next) deckEl().prepend(buildCard(next));
    }
    attachGestures();
    if (deck.length === 0) renderDeck();
  }, 300);
  recordSwipe(uid, direction);
}

async function recordSwipe(targetUid, direction) {
  const me = getCurrentUser();
  const swipeRef = doc(db, "users", me.uid, "swipes", targetUid);
  await setDoc(swipeRef, { direction, at: serverTimestamp() });

  if (direction === "pass") return;

  // পারস্পরিক লাইক আছে কিনা যাচাই — থাকলে ম্যাচ তৈরি
  const theirSwipeRef = doc(db, "users", targetUid, "swipes", me.uid);
  const theirSwipe = await getDoc(theirSwipeRef);
  if (theirSwipe.exists() && theirSwipe.data().direction === "like") {
    await createMatch(targetUid);
  }
}

async function createMatch(targetUid) {
  const me = getCurrentUser();
  const matchId = [me.uid, targetUid].sort().join("_");
  const targetSnap = await getDoc(doc(db, "users", targetUid));
  const targetData = targetSnap.data();

  await setDoc(doc(db, "matches", matchId), {
    members: [me.uid, targetUid],
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
  });

  document.dispatchEvent(new CustomEvent("new-match", { detail: { user: targetData } }));
}

export function initSwipeActions() {
  document.getElementById("btn-swipe-pass").addEventListener("click", () => swipeButton("pass"));
  document.getElementById("btn-swipe-like").addEventListener("click", () => swipeButton("like"));
  document.getElementById("btn-swipe-rewind").addEventListener("click", () => {
    showToast("রিওয়াইন্ড ফিচার শীঘ্রই আসছে");
  });
}
