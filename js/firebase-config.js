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

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDdVsM_cb0XVbBvbjxPm0qUretFhTYrfbc",
  authDomain: "imran-bro.firebaseapp.com",
  projectId: "imran-bro",
  storageBucket: "imran-bro.firebasestorage.app",
  messagingSenderId: "758518374174",
  appId: "1:758518374174:web:7897a2cc524a879ddc730f",
  measurementId: "G-WF68D7S3QG"
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
