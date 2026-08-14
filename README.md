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

The first administrator must be assigned the `admin` role from the Netlify Identity dashboard.

## Validation

```bash
npm run typecheck
npm run lint
```

The repository targets Node.js 22 on Netlify.
