// ============================================================
// Firebase কনফিগারেশন
// এখানে আপনার Firebase প্রজেক্টের কনফিগ বসান
// (Firebase Console > Project Settings > General > Your apps)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getMessaging, isSupported as messagingSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// অফলাইন ক্যাশ সহ Firestore (multi-tab সাপোর্ট)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);

// FCM — শুধু ব্রাউজার সাপোর্ট করলে
export let messaging = null;
messagingSupported().then((ok) => {
  if (ok) messaging = getMessaging(app);
});

// ভালনারেবল কী নয় — Firebase client config পাবলিক হওয়াই স্বাভাবিক।
// আসল সুরক্ষা আসে Firestore/Storage Security Rules থেকে (নিচে দেখুন README)।
