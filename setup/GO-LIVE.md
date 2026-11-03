# Put Blocko online (free)

## 1. Create the database (Supabase, about 10 minutes)
1. Go to https://supabase.com and sign up (free).
2. Click **New project**. Name it `blocko`, choose a strong database password (save it somewhere), pick the region closest to you, then **Create**.
3. Wait about a minute while it sets up.
4. Left menu → **SQL Editor** → **New query**. Open `setup.sql` from this folder in Notepad, copy everything, paste it in, press **Run**. You should see "Success".
5. Left menu → **Authentication** → **URL Configuration** → set **Site URL** to your Netlify link (e.g. `https://sunny-baklava-5a8f61.netlify.app`) → **Save**.
   Leave **Confirm email** turned on: it stops people joining a team with someone else's email.
6. Left menu → **Project Settings** → **API**. Copy the **Project URL** and the **anon public** key. Send them to Claude, or paste them into `config.js`.

## 2. Connect and upload
`config.js` should look like this (Claude can do this part for you):
```js
window.BLOCKO_CONFIG = {
  supabaseUrl: "https://abcdxyz.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
};
```
The anon key is meant to be public; the rules in setup.sql protect your data. Never share the **service_role** key.

Then in Netlify open your project → **Deploys** → drag the new `blocko-upload.zip` onto the drop area.

## 3. Email alerts (optional, about 5 minutes)
1. Sign up free at https://resend.com → **API Keys** → **Create API key** → copy it (starts with `re_`).
2. Open `email-alerts.sql`, replace `PASTE_YOUR_RESEND_KEY_HERE` with your key and `PASTE_YOUR_APP_LINK_HERE` with your Netlify link.
3. Supabase → **SQL Editor** → **New query** → paste → **Run**.
4. In Blocko, open a page and type your email under **Email me new responses**.
Until you verify a domain in Resend, alerts can only go to the email you used to sign up to Resend.

## 4. Install it like an app
- **Android (Chrome):** open your link → menu ⋮ → **Install app**.
- **iPhone (Safari):** open your link → Share → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** click the install icon in the address bar, or **Install app** on Blocko's home screen.

## Inviting your team
Home → team icon → type their email → **Add to team**. Send them your app link; when they sign up with that email they join your workspace automatically.
