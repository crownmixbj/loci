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

**Run the SQL first, in order.** Dashboard -> SQL Editor -> New query, paste,
Run:

1. `supabase/01_bookings.sql` — the bookings table and its access policies.
2. `supabase/02_driver_applications.sql` — profiles, the admin flag, driver
   applications, and the "approved drivers only" rule on bookings.

The second file extends the first, so running it alone fails with
`relation "public.bookings" does not exist`. It now checks for that and says so.

Then make yourself an admin — the review dashboard is invisible without it:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'your@email.com');
```

`is_admin` cannot be set from the app: a trigger refuses the change when the
caller is `authenticated` or `anon`, which is every request from the client. The
SQL editor runs as `postgres` and is allowed, so admin is granted out-of-band.

If you already ran an earlier version of `02_driver_applications.sql` and the
update above fails with `is_admin can only be changed by a database
administrator`, run `supabase/03_fix_admin_guard.sql` — the first version of
that trigger raised unconditionally and locked out the SQL editor too.

Then, in the dashboard:

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

- **Bookings and driver applications persist in Postgres**, with Row Level
  Security enforcing access server-side. Until you run the SQL above, the app
  falls back to in-memory seed data — a development convenience, not a feature;
  nothing persists in that mode.
- **Uploads are the weak link in the review process.** A reviewer sees the
  filenames an applicant attached but cannot open them, so nobody should be
  approved on the strength of that list alone. The dashboard says so.
- **Uploads aren't uploaded.** Parcel photos and driver documents are local file
  URIs; no storage bucket is wired up. Parcel photos are dropped on insert
  rather than stored as a dead `file://` path.
- **Driver applications hold sensitive personal data** — NINs, bank account
  numbers and addresses, for the applicant and their guarantor. Access is
  limited to the applicant and admins, but you need a retention policy for
  rejected applications before real applicants use this.
- **Notifications are queued, not sent.** `store/notifications.tsx` composes the
  driver's confirmation email and SMS and records them. Delivery needs a
  server-side sender — a client cannot hold provider credentials.
- **OTP collection** is described in the hub copy but not implemented.
