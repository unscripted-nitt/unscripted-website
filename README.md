# 🎤 Unscripted NITT — Website

Official public speaking & Toastmasters club website for NIT Trichy. Built as a PWA with Firebase backend.

---

## 📁 File Structure

```
unscripted/
├── index.html              ← Public landing page
├── manifest.json           ← PWA manifest (app install)
├── sw.js                   ← Service Worker (offline + push notifications)
├── vercel.json             ← Vercel deployment config
├── icons/
│   └── logo.png            ← Unscripted club logo
├── css/
│   └── style.css           ← All styles (orange + white brand)
├── js/
│   ├── firebase-config.js  ← 🔑 PUT YOUR FIREBASE KEYS HERE
│   ├── nav.js              ← Navbar scroll, hamburger, animations
│   └── public-home.js      ← Loads events + gallery on homepage
└── pages/
    ├── login.html          ← Member login (NITT webmail @nitt.edu)
    ├── dashboard.html      ← Member dashboard (progress, analysis, leaderboard, mentorship, attendance)
    ├── admin.html          ← Core team admin panel
    ├── events.html         ← Public events page (upcoming + past)
    ├── gallery.html        ← Public photo gallery with lightbox
    ├── members.html        ← Public member list with role filter
    ├── videos.html         ← Public speech videos (YouTube embeds)
    └── contact.html        ← Social links + WhatsApp + contact form
```

---

## 🔥 Firebase Setup (Step by Step)

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com
2. Create project → name it `unscripted-nitt`
3. Register a **Web App** → copy config

### 2. Add Config Keys
Paste into `js/firebase-config.js`:
```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3. Enable Authentication
Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable

### 4. Enable Firestore
Firebase Console → Firestore Database → Create database → Start in test mode

Set security rules (Rules tab):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /members/{doc}      { allow read: if true; }
    match /events/{doc}       { allow read: if true; }
    match /gallery/{doc}      { allow read: if true; }
    match /videos/{doc}       { allow read: if true; }
    match /leaderboard/{doc}  { allow read: if true; }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /meets/{doc}        { allow read: if request.auth != null; }
    match /messages/{doc}     { allow create: if true; }
    match /notifications/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 5. Enable Storage
Firebase Console → Storage → Get started

### 6. Push Notifications (Optional)
Firebase Console → Project Settings → Cloud Messaging → Generate VAPID key
Replace `YOUR_VAPID_KEY` in dashboard.html where getToken is called.

---

## 🚀 Deploy on Vercel

1. Push this folder to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Set **Root Directory** to `unscripted` (or root if it's already at root)
4. Framework preset: **Other** (it's static HTML)
5. Deploy → done!

Your site: `https://your-project.vercel.app`

---

## 👥 Adding Members (Admin Panel)

1. Make yourself an admin: In Firestore → `users/{your-uid}` → set `role: "core"`
2. Go to `/pages/admin.html`
3. Use "Add Member" form:
   - Fill name, NITT email (`rollnumber@nitt.edu`), temp password, dept, year, role, pathway
   - They log in at `/pages/login.html` with their NITT email + the temp password
4. They can change password via Firebase Auth (add forgot password flow if needed)

---

## 🗂️ Firestore Collections

| Collection | Access | Purpose |
|---|---|---|
| `users/{uid}` | Private (auth only) | Full member data, speeches, attendance, points |
| `members/{uid}` | Public | Name, dept, role for public member list |
| `events/{id}` | Public | Upcoming & past events |
| `gallery/{id}` | Public | Photo URLs + captions |
| `videos/{id}` | Public | YouTube video links + metadata |
| `leaderboard/{uid}` | Public | Points, speech count, level |
| `meets/{id}` | Auth only | Attendance records per meet |
| `notifications/{id}` | Auth only | Push notification queue |
| `messages/{id}` | Write-only public | Contact form submissions |

### User Document Structure (`users/{uid}`)
```json
{
  "name": "Ravi Kumar",
  "email": "ra123@nitt.edu",
  "dept": "CSE",
  "year": 2,
  "role": "member",        // "member" | "mentor" | "core" | "admin"
  "pathway": "L1",         // "L1" | "L2" | "L3K" | "L3H"
  "mentor": "uid-of-mentor",
  "mentees": ["uid1", "uid2"],
  "points": 25,
  "speeches": [
    { "id": "ice-breaker", "title": "Ice Breaker", "status": "done", "date": "2025-01-15", "feedback": "Great energy!" }
  ],
  "attendance": [
    { "meetId": "meet-id-1", "date": "2025-01-10", "present": true }
  ],
  "skills": {
    "delivery": 4, "structure": 3, "vocal": 4,
    "eyeContact": 5, "confidence": 3, "persuasion": 4
  }
}
```

---

## 📱 PWA / App

The site installs as a native-like app:
- **Android/Chrome**: Chrome prompts "Add to Home Screen"
- **iOS/Safari**: Share → Add to Home Screen (iOS 16.4+ for push notifications)
- **Desktop**: Install button in browser address bar

Push notifications fire when you add to `notifications` collection in Firestore.

---

## 🔔 Push Notifications Cloud Function

Deploy this to Firebase Functions to auto-trigger notifications:

```js
// functions/index.js
const admin = require('firebase-admin');
const functions = require('firebase-functions');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document('notifications/{id}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (data.sent) return;
    await admin.messaging().send({
      topic: 'all-members',
      notification: { title: data.title, body: data.body },
      webpush: {
        notification: { icon: '/icons/logo.png' },
        fcmOptions: { link: data.url || '/' }
      }
    });
    await snap.ref.update({ sent: true });
  });
```

---

## 🔑 Admin Access

To make a user admin:
1. Find their UID in Firebase Auth console
2. In Firestore → `users/{uid}` → set `role: "core"` or `"admin"`
3. They access `/pages/admin.html`

---

## 📲 WhatsApp Link

In `pages/contact.html` and `index.html`, replace:
```
https://chat.whatsapp.com/YOUR_WHATSAPP_LINK
```
with your actual WhatsApp community invite link.

---

Made with ❤️ for Unscripted NIT Trichy 🎤
