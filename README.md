# Folloze Link Builder

Generate personalized Folloze board URLs from a contact CSV and download the results as a CSV batch.

## Stack

- Next.js App Router
- Tailwind CSS
- Neon Postgres for 24 hour session storage

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Set a database connection string:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

## Environment

- `DATABASE_URL`: Postgres connection string for saved link batches

## Safety Notes

- Saved session payloads are rate limited per IP on the session APIs.
- Session create requests are validated server side for row count, payload size, URL shape, and expected CSV structure.
- Session responses are marked `Cache-Control: no-store` because they can contain customer contact data.

## Checks

```bash
npm test
npm run test:e2e
npm run test:build-css
```

## Cloudflare/OpenNext preview

This branch adds a review-only Cloudflare Worker configuration. It must not be
deployed over the Vercel production alias without the parity checks below.

- Build the Worker bundle: `npm run build:cloudflare`
- Run a local Worker preview: `npm run preview:cloudflare`
- Validate the generated Worker without deployment: `npm run check:cloudflare`
- Bind `DATABASE_URL` as a Worker secret. It is the only application secret.
- `RATE_LIMITER` is a Durable Object binding declared in `wrangler.jsonc`; it
  stores only a hashed client-and-route counter, never CSV/session content.

The session APIs fail closed with `503` if the Durable Object binding is absent.
Their successful, validation, rate-limit, and error responses remain
`Cache-Control: no-store`. Before a live cutover, run a Cloudflare Worker to
Neon create/read test using a synthetic 5 MiB CSV. Do not use customer data.
