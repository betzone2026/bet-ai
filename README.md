# SportAlpha AI

SportAlpha AI is a Netlify-hosted Next.js application for sports probability analysis. It combines a labelled demo fixture catalogue, a server-side Monte Carlo engine, subscription controls, persistent history and an AI explanation layer.

The application reports probabilities and uncertainty for informational purposes. It does not guarantee outcomes or provide staking advice.

## Architecture

- **Next.js 16 App Router** serves the interface and same-origin API routes.
- **Netlify Identity** handles registration, login, recovery and server-controlled admin roles.
- **Netlify Database** stores profiles, subscriptions, daily usage counters and simulation history.
- **Drizzle ORM** defines the schema in `db/schema.ts`; deploy migrations live in `netlify/database/migrations/`.
- **Stripe** creates subscriptions and updates entitlements through a signed webhook.
- **AI Analyst** explains the quantitative context and falls back to a deterministic response when no provider key is configured.

## Local development

Install dependencies and start Netlify Dev so Identity, API routes and Database use the Netlify runtime:

```bash
npm install
/opt/buildhome/node-deps/node_modules/.bin/netlify dev --port 8889
```

Copy `.env.example` to `.env.local` and configure the optional Stripe and AI variables. Netlify Database does not require a connection string.

## Database changes

Update `db/schema.ts`, then generate a deploy migration:

```bash
npx drizzle-kit generate --name describe_the_change
```

Netlify applies production migrations during deploy.

## Authentication and authorization

Identity user metadata stores editable profile fields such as the display name. Subscription plans are stored only in Netlify Database and are updated by the verified Stripe webhook. Administrative access uses the server-controlled `admin` Identity role and the redirect rules in `netlify.toml`.

### Callback flow

Identity delivers confirmation, recovery, invite and OAuth tokens in the **URL fragment**, which browsers never send to the server. Redemption therefore has to happen in the browser, and it has to happen somewhere predictable:

```
signup → Identity sends email → user clicks link
       → lands on the Identity "Site URL" with #confirmation_token=…
       → root layout forwards the fragment to /auth/callback
       → handleAuthCallback() redeems the token and writes the nf_jwt cookie
       → full navigation to /dashboard (server render sees the cookie)
```

`src/components/auth/identity-callback.tsx` is mounted in the root layout purely to forward the fragment, so the flow completes no matter which page the email link points at. `/auth/callback` owns the rest and routes by callback type: confirmation, OAuth and email change go to `/dashboard`, recovery goes to `/update-password`, invites go to `/accept-invite`.

Only `handleAuthCallback()` both redeems the token *and* writes the `nf_jwt` cookie the server reads. The standalone `confirmEmail()` helper redeems without writing that cookie, which would leave the user signed in on the client and anonymous on every server render — so tokens arriving in the query string are promoted into the fragment rather than redeemed directly.

### Route protection

`src/proxy.ts` is the first gate: it checks only for the presence of the `nf_jwt` cookie, cheaply, at the edge, and redirects anonymous requests to `/login?next=…`. It is deliberately optimistic. The app layout and the route handlers resolve the real user through `getUser()` and are the authoritative gate, so a forged or expired cookie is rejected there.

### Settings that must be configured in the Netlify UI

These cannot be set from the repository:

1. **Identity → Registration** — `Open`, so signups are accepted. `Invite only` returns HTTP 403 on signup.
2. **Identity → Autoconfirm** — leave **off** in production so addresses are verified. Turning it on skips the confirmation email entirely, which is useful while developing.
3. **Identity → Site URL** — must be the app's public origin. Identity builds every confirmation, recovery and invite link from this value; if it points anywhere else, the link leaves the app. This is the setting to check first if a confirmation link lands on the wrong page.
4. **First administrator** — invite the address from Identity → *Invite users*, accept the invitation, then add `admin` to the user's **Roles**. Roles live in server-controlled `app_metadata` and cannot be set by the user.

`NEXT_PUBLIC_SITE_URL` is optional: the build derives the origin from the deploy context (`URL` in production, `DEPLOY_PRIME_URL` for previews), so production cannot silently fall back to localhost. Set it explicitly only to pin a custom domain.

Note that the `nf_jwt` cookie is written with the `Secure` attribute, so browsers drop it over plain HTTP. Local sessions need HTTPS or the autoconfirm shortcut.

## Validation

```bash
npm run typecheck
npm run lint
npm test
```

The repository targets Node.js 22 on Netlify.
