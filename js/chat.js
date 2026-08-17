// ============================================================
// chat.js — ম্যাচ লিস্ট, রিয়েলটাইম চ্যাট থ্রেড
// ============================================================
import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, doc, getDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";
import { $, showView, timeAgo, formatClock } from "./ui.js";
import { startCall, listenForIncomingCalls } from "./videocall.js";

let matchesUnsub = null;
let messagesUnsub = null;
let activeMatch = null; // { id, otherUser }
const otherUserCache = new Map();
const incomingCallUnsubs = new Map(); // matchId -> unsub

export function initChatTab() {
  listenToMatches();
  $("#thread-back").addEventListener("click", closeThread);
  $("#thread-send").addEventListener("click", sendMessage);
  $("#thread-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  $("#thread-call-btn").addEventListener("click", () => {
    if (activeMatch) startCall(activeMatch.otherUser, activeMatch.id);
  });
}

function listenToMatches() {
  const me = getCurrentUser();
  const q = query(collection(db, "matches"), where("members", "array-contains", me.uid), orderBy("lastMessageAt", "desc"));
  if (matchesUnsub) matchesUnsub();
  matchesUnsub = onSnapshot(q, async (snap) => {
    const rows = [];
    for (const d of snap.docs) {
      const data = d.data();
      const otherUid = data.members.find((u) => u !== me.uid);
      const other = await getOtherUser(otherUid);
      rows.push({ id: d.id, other, ...data });
    }
    renderMatchStrip(rows);
    renderChatList(rows);
    // প্রতিটি ম্যাচের জন্য ইনকামিং কল লিসেনার নিশ্চিত করা
    rows.forEach((r) => {
      if (!incomingCallUnsubs.has(r.id)) {
        incomingCallUnsubs.set(r.id, listenForIncomingCalls(r.id, r.other));
      }
    });
  });
}

async function getOtherUser(uid) {
  if (otherUserCache.has(uid)) return otherUserCache.get(uid);
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.exists() ? snap.data() : { displayName: "ব্যবহারকারী" };
  otherUserCache.set(uid, data);
  return data;
}

function renderMatchStrip(rows) {
  const el = $("#match-strip");
  if (rows.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = rows.map((r) => `
    <button class="item" data-match-id="${r.id}">
      <img src="${r.other.photoURL || ""}" alt="${r.other.displayName}">
      <span>${r.other.displayName || ""}</span>
    </button>`).join("");
  el.querySelectorAll(".item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows.find((r) => r.id === btn.dataset.matchId);
      openThread(row);
    });
  });
}

function renderChatList(rows) {
  const el = $("#chat-list");
  const withMsgs = rows.filter((r) => r.lastMessage);
  if (withMsgs.length === 0) {
    el.innerHTML = `<div class="deck-empty"><div class="mark">💬</div><h3>এখনো কোনো কথোপকথন নেই</h3><p class="mt-8">ম্যাচ হলে এখানে চ্যাট শুরু করতে পারবেন।</p></div>`;
    return;
  }
  el.innerHTML = withMsgs.map((r) => `
    <button class="chat-row" data-match-id="${r.id}">
      <img src="${r.other.photoURL || ""}" alt="">
      <div class="meta">
        <div class="top"><h4>${r.other.displayName || ""}</h4><time>${r.lastMessageAt?.toDate ? timeAgo(r.lastMessageAt.toDate()) : ""}</time></div>
        <p>${r.lastMessage || ""}</p>
      </div>
    </button>`).join("");
  el.querySelectorAll(".chat-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = withMsgs.find((r) => r.id === btn.dataset.matchId);
      openThread(row);
    });
  });
}

function openThread(row) {
  activeMatch = { id: row.id, otherUser: row.other };
  $("#thread-name").textContent = row.other.displayName || "";
  $("#thread-avatar").src = row.other.photoURL || "";
  showView("view-thread");
  listenToMessages(row.id);
}

function closeThread() {
  if (messagesUnsub) messagesUnsub();
  activeMatch = null;
  showView("view-chats");
}

function listenToMessages(matchId) {
  const q = query(collection(db, "matches", matchId, "messages"), orderBy("createdAt", "asc"));
  if (messagesUnsub) messagesUnsub();
  messagesUnsub = onSnapshot(q, (snap) => {
    const me = getCurrentUser();
    const body = $("#thread-body");
    body.innerHTML = snap.docs.map((d) => {
      const m = d.data();
      const mine = m.senderId === me.uid;
      const t = m.createdAt?.toDate ? formatClock(m.createdAt.toDate()) : "";
      return `<div class="bubble ${mine ? "me" : "them"}">${escapeHtml(m.text)}<time>${t}</time></div>`;
    }).join("");
    body.scrollTop = body.scrollHeight;
  });
}

async function sendMessage() {
  const input = $("#thread-input");
  const text = input.value.trim();
  if (!text || !activeMatch) return;
  input.value = "";
  const me = getCurrentUser();
  await addDoc(collection(db, "matches", activeMatch.id, "messages"), {
    text,
    senderId: me.uid,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "matches", activeMatch.id), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
