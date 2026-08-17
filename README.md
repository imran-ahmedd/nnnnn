# সাথী — Dating PWA

Vanilla JS + Firebase দিয়ে তৈরি একটি সম্পূর্ণ ডেটিং PWA: প্রোফাইল/অনবোর্ডিং, swipe-based
ম্যাচিং, রিয়েলটাইম চ্যাট, এবং WebRTC ভিডিও কল (Firestore সিগন্যালিং)।

## ফাইল স্ট্রাকচার

```
dating-app/
├── index.html              সব ভিউ ধারণকারী single-page shell
├── manifest.json            PWA manifest
├── sw.js                    Service worker (app-shell cache)
├── css/
│   ├── base.css              ডিজাইন টোকেন, বাটন, লেআউট
│   ├── auth.css               লগইন/সাইনআপ
│   ├── profile.css            অনবোর্ডিং + প্রোফাইল ট্যাব
│   ├── swipe.css               ডিসকভার ডেক + ম্যাচ ওভারলে
│   ├── chat.css                ম্যাচ লিস্ট + চ্যাট থ্রেড
│   └── videocall.css           ভিডিও কল UI
└── js/
    ├── firebase-config.js     Firebase init (এখানে নিজের কনফিগ বসান)
    ├── ui.js                    টোস্ট, ভিউ-সুইচিং হেল্পার
    ├── auth.js                  সাইনআপ/লগইন/লগআউট
    ├── profile.js               অনবোর্ডিং উইজার্ড, ছবি আপলোড
    ├── swipe.js                  ডেক, জেসচার, লাইক/পাস, ম্যাচ ডিটেকশন
    ├── chat.js                   ম্যাচ লিস্ট, রিয়েলটাইম মেসেজিং
    ├── videocall.js              WebRTC + Firestore সিগন্যালিং
    └── app.js                    বুটস্ট্র্যাপ, রাউটিং, ট্যাব নেভিগেশন
```

## ১. Firebase সেটআপ

1. [Firebase Console](https://console.firebase.google.com) এ নতুন প্রজেক্ট তৈরি করুন।
2. **Authentication** চালু করুন → Email/Password + Google প্রোভাইডার enable করুন।
3. **Firestore Database** তৈরি করুন (production mode)।
4. **Storage** চালু করুন (প্রোফাইল ছবির জন্য)।
5. `js/firebase-config.js` ফাইলে আপনার প্রজেক্টের কনফিগ বসান (Project Settings → General → Your apps → Web app)।

## ২. Firestore ডেটা মডেল

```
users/{uid}
  displayName, age, bio, gender, lookingFor, interests[]
  photos[], photoURL, onboardingComplete, createdAt

users/{uid}/swipes/{targetUid}
  direction: "like" | "pass", at

matches/{matchId}          matchId = [uidA, uidB].sort().join("_")
  members: [uidA, uidB], lastMessage, lastMessageAt, createdAt

matches/{matchId}/messages/{messageId}
  text, senderId, createdAt

matches/{matchId}/call/session
  offer, answer, callerId, calleeId, status
  callerCandidates/{id}, calleeCandidates/{id}
```

## ৩. Firestore Security Rules

Firebase Console → Firestore → Rules এ বসান:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isMe(uid) { return isSignedIn() && request.auth.uid == uid; }
    function isMatchMember(matchData) {
      return isSignedIn() && request.auth.uid in matchData.members;
    }

    match /users/{uid} {
      allow read: if isSignedIn();
      allow create: if isMe(uid);
      allow update: if isMe(uid);
      allow delete: if false;

      match /swipes/{targetUid} {
        allow read, write: if isMe(uid);
      }
    }

    match /matches/{matchId} {
      allow read: if isMatchMember(resource.data);
      allow create: if isSignedIn() && request.auth.uid in request.resource.data.members;
      allow update: if isMatchMember(resource.data);

      match /messages/{messageId} {
        allow read: if isMatchMember(get(/databases/$(database)/documents/matches/$(matchId)).data);
        allow create: if isMatchMember(get(/databases/$(database)/documents/matches/$(matchId)).data)
                       && request.resource.data.senderId == request.auth.uid;
      }

      match /call/{doc=**} {
        allow read, write: if isMatchMember(get(/databases/$(database)/documents/matches/$(matchId)).data);
      }
    }
  }
}
```

## ৪. Storage Security Rules

Firebase Console → Storage → Rules এ বসান:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{uid}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## ৫. ভিডিও কল সম্পর্কে গুরুত্বপূর্ণ নোট

- বর্তমান সিগন্যালিং শুধু **STUN** সার্ভার ব্যবহার করে (Google-এর পাবলিক STUN)। এটা বেশিরভাগ
  নেটওয়ার্কে কাজ করবে, কিন্তু কড়া NAT/ফায়ারওয়ালের পেছনে থাকা ইউজারদের জন্য কল কানেক্ট নাও
  হতে পারে।
- প্রোডাকশনে রিলায়েবিলিটির জন্য একটি **TURN সার্ভার** যোগ করা জরুরি (যেমন
  [Twilio TURN](https://www.twilio.com/stun-turn) বা নিজের coturn সার্ভার)। এটা
  `js/videocall.js`-এর `ICE_SERVERS` অবজেক্টে যোগ করুন।
- কল শেষ হওয়ার পর সিগন্যালিং ডেটা (ICE candidates) স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়, কিন্তু
  `offer`/`answer` ফিল্ড `matches/{id}/call/session` ডকুমেন্টে থেকে যায় — চাইলে Cloud
  Function দিয়ে নিয়মিত ক্লিনআপ করতে পারেন।

## ৬. Deploy

- **Vercel:** রুট ফোল্ডার হিসেবে `dating-app/` কানেক্ট করুন, কোনো বিল্ড স্টেপ দরকার নেই
  (static site)।
- **GitHub:** রিপোতে পুশ করে Vercel-এর সাথে অটো-ডিপ্লয় কানেক্ট করুন।

## ৭. আইকন

`icons/` ফোল্ডারে `icon-192.png`, `icon-512.png`, ও `icon-maskable-512.png` যোগ করুন
(manifest.json-এ রেফারেন্স করা আছে)।

## এখনো বাকি (ভবিষ্যতের কাজ)

- প্রোফাইল এডিট ফ্লো (বর্তমানে placeholder)
- সোয়াইপ রিওয়াইন্ড (undo)
- FCM push notification (নতুন ম্যাচ/মেসেজ/ইনকামিং কলের জন্য) — `firebase-config.js`-এ
  `messaging` এক্সপোর্ট করা আছে, শুধু service worker-এ background handler যোগ করা বাকি
- রিপোর্ট/ব্লক ফিচার, বয়স-ভিত্তিক ফিল্টার, দূরত্ব-ভিত্তিক ম্যাচিং
