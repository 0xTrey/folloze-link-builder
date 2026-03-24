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
