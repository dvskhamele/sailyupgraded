# Google Login for Existing Users Only

This project uses Google Identity Services on the sign-in page and a custom
Next.js API route at `POST /api/auth/google-login`.

The flow intentionally does not create users:

1. User clicks **Continue with Google**.
2. Google returns an ID credential to the browser.
3. The browser posts `{ "credential": "google_jwt_token" }` to
   `/api/auth/google-login`.
4. The API verifies the credential with Google and validates the audience
   against `VITE_GOOGLE_CLIENT_ID`.
5. The API looks up `Users.email`.
6. If the email exists, the API creates a Better Auth compatible session in the
   existing `session` table and sets the HTTP-only session cookie.
7. If the email does not exist, the API returns `401` with:
   `Your account is not registered. Please contact administrator or register first.`

## Required Environment Variables

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# VITE_GOOGLE_CLIENT_ID is still accepted for older installs.
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`VITE_GOOGLE_CLIENT_ID`, `GOOGLE_ID`, and `GOOGLE_CLIENT_ID` are still accepted
as fallback names for existing deployments, but the value must be the full web
client ID ending in `.apps.googleusercontent.com`. `GOOGLE_SECRET` is only
needed for redirect OAuth and is not required by the GIS credential endpoint.

## Google Cloud Console Setup

1. Open Google Cloud Console.
2. Create or select a project.
3. Go to **APIs & Services > OAuth consent screen** and configure the app.
4. Go to **APIs & Services > Credentials**.
5. Create an **OAuth client ID** with application type **Web application**.
6. Add **Authorized JavaScript origins**. These are origins only; do not add
   paths:
   - `http://localhost:3000`
   - your preview origin, for example `https://your-preview.vercel.app`
   - your production origin, for example `https://your-domain.com`
7. If you also use Better Auth redirect OAuth, add **Authorized redirect URIs**.
   These include the callback path:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-preview.vercel.app/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`
8. Copy the client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/en/sign-in`.

## Common Errors

- `Google client ID is not configured.`
  Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to `.env.local` and restart the dev server.
- `Invalid Google credential.`
  The credential audience does not match your configured client ID, the token is
  expired, or the Google email is not verified.
- `Your account is not registered...`
  The Google email is valid, but there is no matching row in `Users.email`.
- Cookie is not set in production.
  Make sure `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` use the same HTTPS
  origin as the deployed app.

## Security Notes

- Users are never auto-registered by Google login.
- The Google ID token is verified server-side before any session is created.
- The session token is stored in an HTTP-only, SameSite=Lax cookie.
- The database session expires after seven days, matching the existing Better
  Auth session policy.
- The route updates `lastLoginAt` and links the Google account provider record
  without storing Google access tokens.
