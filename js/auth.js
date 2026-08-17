// ============================================================
// auth.js — সাইনআপ, লগইন, লগআউট, অথ-স্টেট পরিবর্তন
// ============================================================
import { auth, googleProvider, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { showToast } from "./ui.js";

let currentUser = null;
let currentUserDoc = null;
const listeners = [];

export function onAuthReady(cb) { listeners.push(cb); }

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      currentUserDoc = snap.exists() ? snap.data() : null;
    } catch (err) {
      // Firestore rules না বসালে (permission-denied) এখানে থেমে যেত এবং
      // পুরো অ্যাপ silently আটকে থাকত — তাই ধরে ফেলে toast দেখানো হচ্ছে।
      console.error("ইউজার ডেটা আনতে সমস্যা:", err);
      currentUserDoc = null;
      showToast(
        err.code === "permission-denied"
          ? "Firestore Security Rules সেট করা নেই — README দেখুন।"
          : "প্রোফাইল ডেটা লোড করতে সমস্যা হয়েছে।",
        "error"
      );
    }
  } else {
    currentUserDoc = null;
  }
  listeners.forEach((cb) => cb(currentUser, currentUserDoc));
});

export function getCurrentUser() { return currentUser; }
export function getCurrentUserDoc() { return currentUserDoc; }
export function refreshCurrentUserDoc(data) { currentUserDoc = { ...currentUserDoc, ...data }; }

export async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    displayName,
    email,
    onboardingComplete: false,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, "users", cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: cred.user.uid,
      displayName: cred.user.displayName || "",
      email: cred.user.email,
      photoURL: cred.user.photoURL || null,
      onboardingComplete: false,
      createdAt: serverTimestamp(),
    });
  }
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে।",
    "auth/invalid-email": "ইমেইল ঠিকানাটি সঠিক নয়।",
    "auth/weak-password": "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।",
    "auth/user-not-found": "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",
    "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    "permission-denied": "Firestore Security Rules সেট করা নেই বা ভুল আছে — README-এর Rules অংশ দেখুন।",
  };
  return map[err.code] || "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}
