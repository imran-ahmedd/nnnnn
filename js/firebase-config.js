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
  apiKey: "AIzaSyDU2yT6V6d6HPGsYj9e21ybKYEce3ne5VM",
  authDomain: "just-trying1.firebaseapp.com",
  projectId: "just-trying1",
  storageBucket: "just-trying1.firebasestorage.app",
  messagingSenderId: "669327838181",
  appId: "1:669327838181:web:87c423bc6bcdf578bdbd0c",
  measurementId: "G-62T19J3ZNP"
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
