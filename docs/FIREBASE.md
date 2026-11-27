# Sign-in and access approval (Firebase)

GitHub Pages only serves static files, so sign-in and per-user data use Firebase (free Spark plan is enough):

- **Firebase Authentication** – Google sign-in.
- **Cloud Firestore** – `users/{uid}` (access request, approval flag, last timeline position) and
  `config/access` (the admin list). [`firestore.rules`](../firestore.rules) enforces who may read and write what.

The map data itself is part of this public repository, so the gate controls access to the site, not secrecy of the
data.

## One-time setup

1. Create a project at <https://console.firebase.google.com/> (Analytics not needed).
2. **Authentication → Sign-in method**: enable **Google**.
   **Authentication → Settings → Authorized domains**: add `ben-sembira-1.github.io`.
3. **Firestore Database**: create a database (production mode).
4. **Firestore rules**: paste [`firestore.rules`](../firestore.rules) in **Firestore → Rules** and publish, or run
   `npx firebase-tools deploy --only firestore:rules --project <project-id>`.
5. **Admins**: in **Firestore → Data**, create collection `config`, document `access`, with field
   `adminEmails` (array) containing the admin's Google email. Admins see the access-management panel on the site
   and are always allowed in.
6. **Web app**: **Project settings → Your apps → Add app (Web)**. Copy `apiKey`, `authDomain`, `projectId` and
   `appId` into GitHub **Settings → Secrets and variables → Actions → Variables** as
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
   These values are public by design (they end up in the page); the rules are what protect the data.
7. Re-run the **Release and deploy** workflow (or merge any PR).

## Approving people

A new visitor signs in and sees "request sent". The admin sees a **ניהול גישה** panel with a badge counting pending
requests at the bottom of the timeline panel, and can approve, reject (deletes the request) or revoke access.
The visitor's page opens automatically once approved.

Optional: to get an email for each new request, install the Firebase **Trigger Email** extension (needs the Blaze
plan) or a Cloud Function on `users/{uid}` creation.
