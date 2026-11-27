# Google Maps setup

The map, the place search and the place details panel use the Google Maps Platform. They need an API key from a
Google Cloud project **with billing enabled** (the Firebase project `rails-plans-israel` can be used; Google
includes a monthly free usage allowance per API, which a personal site normally stays within).

## One-time setup

1. In <https://console.cloud.google.com/> select the project, then **APIs & Services → Library** and enable:
   - **Maps JavaScript API** (the map),
   - **Places API (New)** (search, saving a place),
   - **Places UI Kit** (the Google details panel: photos, opening hours, reviews).
2. **APIs & Services → Credentials → Create credentials → API key.** Edit the key:
   - **Application restrictions → Websites**: `https://ben-sembira-1.github.io/*` (and `http://localhost:5173/*`
     only if you develop locally with this key; a separate local key is safer).
   - **API restrictions → Restrict key**: Maps JavaScript API, Places API (New) and Places UI Kit.
3. **Map ID** (needed for the markers): **Google Maps Platform → Map management → Create map ID**, type
   **JavaScript**, **Vector**. Without it the site uses Google's `DEMO_MAP_ID`, which is meant for development.
4. GitHub **Settings → Secrets and variables → Actions → Variables**: add `VITE_GOOGLE_MAPS_API_KEY` and
   `VITE_GOOGLE_MAP_ID`. Like the Firebase config, the key ends up in the page; the website and API restrictions
   are what protect it.
5. **Firestore rules**: publish the updated [`firestore.rules`](../firestore.rules) (places and comments under
   `users/{uid}/places`), as in [FIREBASE.md](FIREBASE.md) step 4.
6. Re-run the **Release and deploy** workflow (or merge any PR).

## Local development

Put the key in `.env.local` (`VITE_GOOGLE_MAPS_API_KEY=...`, see `.env.example`). Without Firebase config, places
and comments are kept in memory and lost on reload.
