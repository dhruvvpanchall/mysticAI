# Deploying MysticAI to Vercel

Local dev works against the same Firebase project you use in production —
the only thing that changes is where the env vars live.

## 1. Push your branch

Vercel deploys from GitHub. Make sure the branch you want to deploy is
pushed:

```sh
git push origin develop
```

## 2. Import the project on Vercel

1. https://vercel.com/new
2. Pick the `mysticAI` repo.
3. Framework: **Next.js** (autodetected).
4. Build command: `npm run build` (default).
5. Output: `.next` (default).
6. **Don't deploy yet — add env vars first.**

## 3. Environment variables

In the import screen → **Environment Variables**, add each of these for
all three environments (Production, Preview, Development). Values come
straight from your local `.env.local`:

```
GEMINI_API_KEY                          (your Groq key, gsk_...)
LLM_BASE_URL                            https://api.groq.com/openai/v1
LLM_MODEL                               llama-3.1-8b-instant

NEXT_PUBLIC_FIREBASE_API_KEY            (same as local)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        (same)
NEXT_PUBLIC_FIREBASE_PROJECT_ID         (same)
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     (same)
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID (same)
NEXT_PUBLIC_FIREBASE_APP_ID             (same)
```

The `NEXT_PUBLIC_*` vars ship in the browser bundle — that's expected
for Firebase web config. Security is enforced by Firestore rules, not
by hiding the apiKey.

## 4. Click Deploy

You'll get a URL like `mysticai-xxxx.vercel.app`. The first build takes
~2 minutes.

## 5. Firebase Console — wire up the production domain

This is the step that's easy to miss. Without it, sign-up works but
sign-in fails with `auth/unauthorized-domain`.

1. **Firebase Console → Authentication → Settings → Authorized
   domains** → **Add domain**, paste your Vercel domain
   (`mysticai-xxxx.vercel.app`). Repeat for any custom domain you add
   later, and for preview branch URLs if you want auth to work in
   preview deploys.
2. **Authentication → Sign-in method** → make sure **Email/Password**
   and **Google** are both enabled.
3. **Firestore → Rules** → paste the contents of `firestore.rules` from
   the repo, then click **Publish**. (Or run `firebase deploy --only
   firestore:rules` if you have the CLI set up.)

## 6. Post-deploy checklist

Hit the deployed URL and verify:

- `/` loads with no console errors
- `/signup` creates a new account → lands on `/chat`
- Send a message → reply streams in → reload → reply persists
- Switch language pill → Hindi translation appears
- `/settings` lets you rename, sign out, and delete account
- Open a fresh incognito window and hit `/api/chat` 25 times in a row
  → expect a 429 once you exceed 20 in the rolling window (rate
  limiter is working)

## Custom domain (optional)

In Vercel → Project → **Domains** → add your domain, follow the DNS
instructions. After the cert is issued, add the same domain to Firebase
Authorized domains (step 5.1).

## Rolling back

Vercel keeps every deploy. **Deployments → … → Promote to production**
on any previous green deploy reverts instantly.
