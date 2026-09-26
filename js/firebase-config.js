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
  apiKey: "AIzaSyCJyClYm7m4IFSJtuyjvNHhY4iHnCXJhKQ",
  authDomain: "tvexam.firebaseapp.com",
  projectId: "tvexam",
  storageBucket: "tvexam.firebasestorage.app",
  messagingSenderId: "568880836905",
  appId: "1:568880836905:web:3bac39c8d6c113c6d3c738",
  measurementId: "G-JZY90RTTE0"
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
