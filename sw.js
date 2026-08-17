const CACHE_NAME = "sathi-app-shell-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/base.css",
  "/css/auth.css",
  "/css/profile.css",
  "/css/swipe.css",
  "/css/chat.css",
  "/css/videocall.css",
  "/js/app.js",
  "/js/ui.js",
  "/js/auth.js",
  "/js/profile.js",
  "/js/swipe.js",
  "/js/chat.js",
  "/js/videocall.js",
  "/js/firebase-config.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// নেটওয়ার্ক-ফার্স্ট Firebase/Firestore কলের জন্য, ক্যাশ-ফার্স্ট বাকি অ্যাপ-শেলের জন্য।
// ভিডিও কল সিগন্যালিং ও রিয়েলটাইম ডেটা কখনো ক্যাশ করা হয় না।
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes("firestore") || url.hostname.includes("googleapis") || url.hostname.includes("firebaseio")) {
    return; // এগুলো সরাসরি নেটওয়ার্কে যাক
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match("/index.html")))
  );
});
