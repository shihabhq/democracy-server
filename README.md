# Vote Kori – Democracy API Server

This package is the **backend API** for the Vote Kori project. It powers:

- Quiz questions and attempts
- Analytics and aggregated statistics
- Certificate generation and hosting (via Supabase Storage)
- Admin endpoints for internal tools

It is built with **Express**, **TypeScript**, **Prisma**, and **PostgreSQL**.

## Overview

The democracy-server exposes a REST API consumed by:

- The public **frontend** (`democracy-client`) for quiz and certificate flows.
- The internal **admin dashboard** (`democracy-admin`) for analytics and question management.

Core responsibilities:

- Serve quiz questions and accept quiz attempts.
- Calculate scores and pass/fail status.
- Generate PDF certificates and upload them to object storage (Supabase).
- Provide analytics (by district, age group, gender, question difficulty, etc.).

## Tech Stack

- **Runtime**: Node.js (ES modules)
- **Framework**: Express 5
- **Language**: TypeScript (compiled to Node-compatible JS)
- **Database**: PostgreSQL via Prisma ORM
- **Storage**: Supabase Storage for certificate PDFs
- **Auth & Security**: JSON Web Tokens (JWT), `bcrypt`, CORS, cookies
- **PDF generation**: `pdfkit` + `sharp`

## Architecture

Entry point:

- `src/index.ts` – Configures Express, CORS, JSON parsing, cookies, and registers route modules:
  - `/api/quiz` – Quiz questions and attempts
  - `/api/certificate` – Certificate generation and redirects
  - `/api/analytics` – Aggregated statistics for admin dashboards
  - `/api/admin` – Admin-related endpoints

Supporting libraries:

- `src/lib/prisma.ts` – Prisma client configuration and connection pooling.
- `src/lib/certificate.ts` – Certificate PDF generation (using templates and `pdfkit`).
- `src/lib/supabase.ts` – Supabase Storage integration for uploading certificate PDFs.

The `/api/certificate/:attemptId` endpoint:

- Looks up a quiz attempt in the database.
- Checks that the attempt exists and that it passed.
- Generates a certificate PDF in memory if one does not already exist.
- Uploads the PDF to Supabase Storage and stores the public URL in the database.
- Redirects the user to the hosted PDF URL.

## Database

The schema is defined in `prisma/schema.prisma` and managed by **Prisma**. While details may evolve, the high-level entities are:

- **QuizQuestion**, **QuizOption** – Quiz content.
- **QuizAttempt** – A user’s submission, score, and pass/fail status.
- **QuizResult/Answer** – Per-question answers, correctness, and explanations.
- **Certificate** – Links quiz attempts to generated certificate file URLs.

Use Prisma CLI to manage migrations and generate the client.

## Environment Variables

Create a `.env` file in `democracy-server` (do **not** commit it) and configure at least:

- `DATABASE_URL` – Prisma connection string for PostgreSQL.
- `SUPABASE_URL` – Supabase project URL (for Storage).
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key for uploading certificates.
- `SUPABASE_CERTIFICATES_BUCKET` – (optional) Bucket name for certificates (defaults to `"certificates"` if not set).

> Never share or commit real connection strings, API keys, or service-role keys. Use `.env.example` or deployment secret management systems instead.

## Getting Started

### Prerequisites

- Node.js **20+** (recommended)
- PostgreSQL database (local or managed)
- Optional but recommended: a Supabase project for certificate storage

### Installation

```bash
cd democracy-server
npm install
```

### Database setup

Run Prisma migrations and generate the client:

```bash
npm run migrate    # prisma migrate dev
npm run generate   # prisma generate
```

Optionally seed the database with initial quiz questions:

```bash
npm run seed
```

### Running locally

```bash
cd democracy-server
npm run dev
```

By default the server listens on `http://localhost:5000` (configurable via `PORT` in `.env`).

### Useful scripts

- `npm run dev` – Start the API server in watch mode (via `tsx`).
- `npm run build` – Generate Prisma client and compile TypeScript to `dist/`.
- `npm run start` – Run the compiled server from `dist/`.
- `npm run migrate` – Run `prisma migrate dev`.
- `npm run seed` – Seed the database with initial data.
- `npm run export-db` – Custom script to export database contents (e.g. for backups or analysis).

## CORS & Clients

`src/index.ts` configures CORS to allow:

- Public frontend domains (e.g. `https://votekori.cloud`, `https://www.votekori.com`)
- Admin domains (e.g. `https://admin.votekori.cloud`, `https://admin.votekori.com`)
- Local dev environments (`http://localhost:3000` for the client, `http://localhost:3001` for the admin)

If you deploy to new domains, update the CORS origin list accordingly.

## Relationship to Other Packages

- **democracy-client** – Uses this API for quiz flows and certificate links.
- **democracy-admin** – Uses this API for analytics, admin actions, and question management.

Together, these packages form the complete Vote Kori system.

