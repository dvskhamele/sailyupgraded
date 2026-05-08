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
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`GOOGLE_ID` and `GOOGLE_CLIENT_ID` are still accepted as fallback names for
existing deployments. `GOOGLE_SECRET` is only needed for the older redirect
OAuth provider and is not required by the GIS credential endpoint.

## Google Cloud Console Setup

1. Open Google Cloud Console.
2. Create or select a project.
3. Go to **APIs & Services > OAuth consent screen** and configure the app.
4. Go to **APIs & Services > Credentials**.
5. Create an **OAuth client ID** with application type **Web application**.
6. Add authorized JavaScript origins:
   `http://localhost:3000`, your preview URL, and your production URL.
7. Copy the client ID into `VITE_GOOGLE_CLIENT_ID`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/en/sign-in`.

## Common Errors

- `Google client ID is not configured.`
  Add `VITE_GOOGLE_CLIENT_ID` to `.env.local` and restart the dev server.
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
