// ============================================================
// videocall.js — WebRTC ভিডিও কল, Firestore সিগন্যালিং দিয়ে
// সিগন্যালিং পাথ: matches/{matchId}/call/session
//   offer, answer, callerCandidates[], calleeCandidates[], status
// ============================================================
import { db } from "./firebase-config.js";
import {
  doc, collection, addDoc, setDoc, getDoc, updateDoc,
  onSnapshot, serverTimestamp, deleteDoc, getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";
import { $, showView, showToast } from "./ui.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // প্রোডাকশনে NAT-এর পেছনের কল রিলায়েবল করতে একটি TURN সার্ভার যোগ করুন:
    // { urls: "turn:your-turn-server:3478", username: "...", credential: "..." },
  ],
};

let pc = null;
let localStream = null;
let remoteStream = null;
let unsubSession = null;
let unsubCandidates = [];
let session = { matchId: null, sessionId: null, role: null }; // role: 'caller' | 'callee'
let callTimerInterval = null;
let callSeconds = 0;
let micOn = true, camOn = true;

function callDocRef(matchId) { return doc(db, "matches", matchId, "call", "session"); }

// ---------- কল শুরু করা (কলার) ----------
export async function startCall(otherUser, matchId) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e) {
    showToast("ক্যামেরা/মাইক্রোফোন অ্যাক্সেস দরকার", "error");
    return;
  }
  session = { matchId, role: "caller" };
  openCallUI(otherUser, "কল হচ্ছে...");

  pc = new RTCPeerConnection(ICE_SERVERS);
  registerTracks();

  const callRef = callDocRef(matchId);
  const callerCandidates = collection(callRef, "callerCandidates");
  const calleeCandidates = collection(callRef, "calleeCandidates");

  pc.onicecandidate = (e) => { if (e.candidate) addDoc(callerCandidates, e.candidate.toJSON()); };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(callRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    answer: null,
    callerId: getCurrentUser().uid,
    calleeId: otherUser.uid,
    status: "ringing",
    startedAt: serverTimestamp(),
  });

  unsubSession = onSnapshot(callRef, async (snap) => {
    const data = snap.data();
    if (!data) return;
    if (data.status === "declined") { showToast("কল রিসিভ করা হয়নি"); endCall(); return; }
    if (data.status === "ended") { endCall(false); return; }
    if (data.answer && pc && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      $("#call-status").textContent = "সংযুক্ত হয়েছে";
      startTimer();
    }
  });

  unsubCandidates.push(onSnapshot(calleeCandidates, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added" && pc) pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
    });
  }));
}

// ---------- ইনকামিং কল রিসিভ করা (কলি) ----------
export function listenForIncomingCalls(matchId, otherUser) {
  const callRef = callDocRef(matchId);
  return onSnapshot(callRef, (snap) => {
    const data = snap.data();
    if (data && data.status === "ringing" && data.calleeId === getCurrentUser().uid) {
      showIncomingCallBanner(matchId, otherUser, data);
    }
  });
}

function showIncomingCallBanner(matchId, otherUser, data) {
  const banner = document.getElementById("incoming-call-banner");
  banner.classList.remove("hidden");
  $("#incoming-caller-name", banner).textContent = otherUser.displayName || "কেউ একজন";
  $("#incoming-avatar", banner).src = otherUser.photoURL || "";
  const accept = $("#btn-accept-call", banner);
  const decline = $("#btn-decline-call", banner);
  const cleanup = () => { banner.classList.add("hidden"); accept.onclick = null; decline.onclick = null; };
  accept.onclick = async () => { cleanup(); await answerCall(matchId, otherUser, data); };
  decline.onclick = async () => { cleanup(); await updateDoc(callDocRef(matchId), { status: "declined" }); };
}

async function answerCall(matchId, otherUser, data) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e) {
    showToast("ক্যামেরা/মাইক্রোফোন অ্যাক্সেস দরকার", "error");
    return;
  }
  session = { matchId, role: "callee" };
  openCallUI(otherUser, "সংযুক্ত হচ্ছে...");

  pc = new RTCPeerConnection(ICE_SERVERS);
  registerTracks();

  const callRef = callDocRef(matchId);
  const callerCandidates = collection(callRef, "callerCandidates");
  const calleeCandidates = collection(callRef, "calleeCandidates");

  pc.onicecandidate = (e) => { if (e.candidate) addDoc(calleeCandidates, e.candidate.toJSON()); };

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    answer: { type: answer.type, sdp: answer.sdp },
    status: "connected",
  });

  $("#call-status").textContent = "সংযুক্ত হয়েছে";
  startTimer();

  unsubSession = onSnapshot(callRef, (snap) => {
    const d = snap.data();
    if (d && d.status === "ended") endCall(false);
  });

  unsubCandidates.push(onSnapshot(callerCandidates, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added" && pc) pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
    });
  }));
}

function registerTracks() {
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  remoteStream = new MediaStream();
  $("#call-remote-video").srcObject = remoteStream;
  $("#call-local-video").srcObject = localStream;
  document.querySelector(".call-waiting").style.display = "flex";
  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
    document.querySelector(".call-waiting").style.display = "none";
  };
}

function openCallUI(otherUser, statusText) {
  $("#call-peer-name").textContent = otherUser.displayName || "";
  $("#call-peer-avatar").src = otherUser.photoURL || "";
  $("#call-status").textContent = statusText;
  micOn = true; camOn = true;
  $("#btn-toggle-mic").classList.remove("active-off");
  $("#btn-toggle-cam").classList.remove("active-off");
  showView("view-call");
}

function startTimer() {
  callSeconds = 0;
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const s = String(callSeconds % 60).padStart(2, "0");
    $("#call-timer").textContent = `${m}:${s}`;
  }, 1000);
}

export function toggleMic() {
  if (!localStream) return;
  micOn = !micOn;
  localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  $("#btn-toggle-mic").classList.toggle("active-off", !micOn);
}

export function toggleCam() {
  if (!localStream) return;
  camOn = !camOn;
  localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
  $("#btn-toggle-cam").classList.toggle("active-off", !camOn);
}

export async function endCall(notifyRemote = true) {
  if (notifyRemote && session.matchId) {
    try { await updateDoc(callDocRef(session.matchId), { status: "ended" }); } catch (_) {}
  }
  clearInterval(callTimerInterval);
  if (unsubSession) unsubSession();
  unsubCandidates.forEach((u) => u());
  unsubCandidates = [];
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
  remoteStream = null;

  if (session.matchId) {
    // ক্লিনআপ: সিগন্যালিং সাব-কালেকশন মুছে ফেলা
    const callRef = callDocRef(session.matchId);
    ["callerCandidates", "calleeCandidates"].forEach(async (sub) => {
      const snap = await getDocs(collection(callRef, sub));
      snap.forEach((d) => deleteDoc(d.ref));
    });
  }
  session = { matchId: null, sessionId: null, role: null };
  showView("view-thread");
}

export function initCallControls() {
  $("#btn-toggle-mic").addEventListener("click", toggleMic);
  $("#btn-toggle-cam").addEventListener("click", toggleCam);
  $("#btn-end-call").addEventListener("click", () => endCall(true));
}
