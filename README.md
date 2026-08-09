# LOCI

Parcel delivery across Nigeria — senders post parcels, drivers claim them.

Built with Expo SDK 56, React Native 0.85, expo-router and TypeScript. The same
codebase targets iOS, Android and the web.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # then paste your Supabase values
npx expo start -c
```

The `-c` clears the Metro cache. Expo reads `.env*` files **only at bundler
startup**, so after changing one you must restart the dev server — a hot reload
won't pick it up.

## Environment

| Variable                        | Where to find it                              |
| ------------------------------- | --------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Project Settings → API   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same page — the **publishable / anon** key     |

Anything prefixed `EXPO_PUBLIC_` is compiled into the app bundle and is readable
by anyone who installs the app. That is correct for the anon key, which is
designed to be public — Row Level Security on your tables is what protects the
data, not the secrecy of this key.

**Never put the `service_role` / `sb_secret_` key in this project.**

`.env` and `.env.*` are git-ignored; only `.env.example` is committed.

## Supabase setup

In the Supabase dashboard:

- **Authentication → Sign In / Providers → Email** — enabled.
- **Authentication → URL Configuration → Redirect URLs** — add your dev origin
  (`http://localhost:8081`) and your deployed origin, or confirmation links will
  bounce somewhere unhelpful.
- **Authentication → Emails → SMTP Settings** — the built-in mailer only sends to
  members of your own Supabase organisation, and only **2 emails per hour across
  the whole project**. Add a provider (Resend, Postmark, SendGrid) before real
  users, or turn off "Confirm email" while developing.

## Checks

```bash
npm run typecheck   # tsc --noEmit --noUnusedLocals
npm run lint
npm run build:web   # produces dist/ — run this before pushing a deploy
```

---

## Deploying to Cloudflare Pages

Connect the GitHub repo, then use these settings:

| Setting                | Value                        |
| ---------------------- | ---------------------------- |
| Framework preset       | **None**                     |
| Build command          | `npm run build:web`          |
| Build output directory | `dist`                       |
| Node version           | `22` (also set in `.nvmrc`)  |

Add both `EXPO_PUBLIC_` variables under **Settings → Environment variables**, for
Production *and* Preview. They are not in the repo, so the build will produce an
app that reports "accounts are not configured" without them.

### Why `public/_redirects` exists

`app.json` sets `web.output: "static"`, so Expo pre-renders one HTML file per
known route. Dynamic routes can't be pre-rendered — there's no way to know every
parcel id at build time — so `/parcel/abc123` has no file and Pages would answer
404. The `_redirects` rule rewrites unmatched paths to `index.html` with a 200,
which keeps the URL intact so expo-router can read the id from it. Cloudflare
serves real files first, so the pre-rendered pages are unaffected.

### After the first deploy

Add the Pages URL to Supabase's **Redirect URLs**, or email confirmation and
password reset links will fail in production.

---

## Notes on the current state

- **Bookings are in-memory.** The parcel store is a React context seeded with
  sample data; nothing is persisted between reloads. Auth is real, the parcel
  data is not.
- **Access control is client-side.** Posting a parcel, applying to drive and
  accepting a job all require an account, but that's enforced in the UI. When
  bookings move into Supabase tables, Row Level Security is what will actually
  enforce it.
- **Uploads aren't uploaded.** Parcel photos and driver documents are local file
  URIs; no storage bucket is wired up.
- **Notifications are queued, not sent.** `store/notifications.tsx` composes the
  driver's confirmation email and SMS and records them. Delivery needs a
  server-side sender — a client cannot hold provider credentials.
- **OTP collection** is described in the hub copy but not implemented.
