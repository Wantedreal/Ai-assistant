# Battery Pack Designer — Engineering Roadmap

**Project:** Battery Pack Pre-Design Assistant  
**Status:** Active development  
**Last updated:** 2026-04-27

---

## Phase F — Mobile & Cross-Platform (Android / iOS)

**Goal:** Make the app installable and usable on Android and iOS devices.  
**Effort:** ~2–4 weeks total across four sub-phases  
**Prerequisite:** Phase F1 (hosted backend) blocks everything else

> **Why mobile is non-trivial:** The Python backend (FastAPI + CadQuery/OCC) is 200+ MB of native C++ binaries — it cannot run on-device. The backend must become a hosted server before any mobile distribution is possible. The React frontend (Three.js, forms, results) already works in mobile WebViews with no changes.

---

### Phase F1 — Host the Backend (hard prerequisite)

**Effort:** 1–2 days | **Cost:** ~$5–20/month (VPS or managed platform)

Deploy the FastAPI backend to a cloud server so it is accessible over the internet instead of `localhost`.

**Steps:**

1. Choose a hosting platform:
   - **Railway / Render** — zero-config Python deploys, free tier available, simplest option
   - **VPS (Hetzner, DigitalOcean)** — full control, $5–10/month, requires manual setup
   - **Fly.io** — Docker-based, generous free tier

2. Create `backend/Dockerfile`:
   ```dockerfile
   FROM python:3.12-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY app/ app/
   COPY data/ data/
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```
   Note: CadQuery/OCC requires a full Linux build — use `python:3.12` not `slim` if STEP export is needed on the server.

3. Create `backend/requirements.txt` from the venv (replaces manual install steps).

4. Update CORS in `backend/app/main.py`:
   ```python
   allow_origins=["https://your-app-domain.com", "capacitor://localhost", "http://localhost:5173"]
   ```

5. Update `frontend/src/services/api.js`:
   ```js
   baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'
   ```
   Add `VITE_API_URL=https://api.your-domain.com/api/v1` to a `.env.production` file.

6. Database: SQLite stays as-is on the server (single-user tool — no concurrency issue). The master Excel is imported once via the Import button after deploy. For multi-user use, migrate to PostgreSQL later.

**Deliverables:**
- `backend/Dockerfile`
- `backend/requirements.txt`
- `.env.production` in frontend
- Deployed backend URL

---

### Phase F2 — Progressive Web App (fastest mobile path, no app stores)

**Effort:** 1 day | **Prerequisite:** Phase F1

Convert the Vite app into an installable PWA. Users on Android Chrome get an automatic "Add to Home Screen" prompt. iOS Safari supports install via the Share menu.

**Steps:**

1. Install plugin:
   ```bash
   cd frontend
   npm install -D vite-plugin-pwa
   ```

2. Update `vite.config.js`:
   ```js
   import { VitePWA } from 'vite-plugin-pwa'
   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         manifest: {
           name: 'Battery Pack Designer',
           short_name: 'BatteryDsgn',
           theme_color: '#0a0c14',
           background_color: '#0a0c14',
           display: 'standalone',
           icons: [
             { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
             { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
           ],
         },
         workbox: {
           globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}'],
           runtimeCaching: [{
             urlPattern: /^https:\/\/api\.your-domain\.com\/api\/v1\/cells$/,
             handler: 'StaleWhileRevalidate',
             options: { cacheName: 'cells-cache' },
           }],
         },
       }),
     ],
   })
   ```

3. Generate 192×192 and 512×512 PNG icons from the existing `icon.png` (Pillow one-liner).

4. Deploy the built `frontend/dist/` to a static host (Vercel, Netlify, Cloudflare Pages — all free).

**Result:** Engineers go to `https://your-app.vercel.app` on any phone, get prompted to install, and use the app from the home screen. No App Store. No review. Updates deploy instantly.

**Deliverables:**
- `vite-plugin-pwa` config in `vite.config.js`
- `public/icon-192.png`, `public/icon-512.png`
- `.env.production` with hosted API URL
- Deployed static frontend

---

### Phase F3 — Capacitor Native Wrapper (App Store distribution)

**Effort:** 1 week (implementation) + 1–4 weeks (store review)  
**Prerequisite:** Phase F2 (the web app must be working and hosted)  
**Cost:** Apple Developer Program $99/yr, Google Play $25 one-time

Capacitor wraps the existing React web app in a native shell. The app appears in the App Store and Google Play Store, with access to native device APIs.

**Steps:**

1. Install Capacitor:
   ```bash
   cd frontend
   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
   npx cap init "Battery Pack Designer" "com.yourcompany.batterydesigner"
   npx cap add android
   npx cap add ios   # Mac only — requires Xcode
   ```

2. Configure `capacitor.config.ts`:
   ```ts
   import { CapacitorConfig } from '@capacitor/cli'
   const config: CapacitorConfig = {
     appId: 'com.yourcompany.batterydesigner',
     appName: 'Battery Pack Designer',
     webDir: 'dist',
     server: { androidScheme: 'https' },
   }
   export default config
   ```

3. Update CORS in backend to include `capacitor://localhost`.

4. Replace `<a download>` export pattern with Capacitor Filesystem plugin (needed on iOS — Safari blocks programmatic downloads):
   ```bash
   npm install @capacitor/filesystem @capacitor/share
   ```
   `triggerDownload()` in `App.jsx` gets a native path on iOS, uses `Share.share()` to open the share sheet.

5. Build and sync:
   ```bash
   npm run build
   npx cap sync
   npx cap open android   # opens Android Studio
   npx cap open ios       # opens Xcode (Mac only)
   ```

6. App Store submission: screenshots, privacy policy, metadata. Android is 2–3 days review. iOS is 1–4 weeks.

**What stays the same:** All calculation logic, 3D viewer, PDF/STEP/GLB export, cell catalogue — everything goes through the hosted API, no re-implementation.

**Deliverables:**
- `capacitor.config.ts`
- Updated `triggerDownload()` with Capacitor Filesystem fallback
- `android/` and `ios/` project directories (generated, not hand-written)
- App Store and Google Play store listings

---

### Phase F4 — Mobile UI Polish (recommended before store submission)

**Effort:** 3–5 days | **Prerequisite:** Phase F3

The bento grid is designed for 1200px+ desktop screens. Mobile needs a different layout.

**Changes:**

1. **Tab-based navigation on small screens** (< 768px):
   Replace the bento grid with 4 tabs: Cell · Configure · Results · 3D View.
   Each tab shows one card full-screen. The Calculate button is always accessible.

2. **Touch controls for 3D viewer:**
   `OrbitControls` already supports touch events — enable them explicitly:
   ```js
   controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
   ```
   Add a "Fullscreen" button that goes full-viewport (not Electron fullscreen).

3. **Form layout:** Stack `ConstraintsForm` fields single-column below 480px — already partially true due to CSS grid, just needs a max-width guard removed.

4. **Export file sharing:** On iOS, files must be shared via the native Share sheet (no `<a download>`). Capacitor `Share.share({ url: fileUri })` handles this — already wired in Phase F3.

5. **Responsive typography and spacing:** Reduce heading sizes, increase tap target sizes to 44px minimum (WCAG mobile guideline).

**Deliverables:**
- Mobile tab layout in `App.jsx` (media-query driven, no new routing needed)
- Touch controls enabled in `PackViewer3D.jsx`
- CSS updates in `styles.css` for < 768px

---

## Implementation Order

```
Phase F1 — Host backend           ~2 days    Required before F2/F3/F4
Phase F2 — PWA                    ~1 day     No app store needed
Phase F3 — Capacitor (stores)     ~1 week    +1–4 weeks store review
Phase F4 — Mobile UI polish       ~4 days    Before store submission
```

**Total estimated effort:** ~2 weeks

---

## Dependency Map

```
F1  →  blocks F2, F3, F4
F2  →  standalone (PWA, no stores)
F3  →  requires F2 working, requires Mac for iOS build
F4  →  polish pass, should ship with F3
```

---

## Libraries needed

```bash
# Phase F2 (PWA)
npm install -D vite-plugin-pwa

# Phase F3 (Capacitor)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm install @capacitor/filesystem @capacitor/share
```
