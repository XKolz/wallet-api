# Wallet API (NestJS + Postgres + TypeORM + Paystack)

A complete REST API for a mock wallet system with:
- JWT auth (`USER`, `ADMIN`)
- Multi-wallet support (unique currency per user)
- Wallet credit via Paystack initialize/verify flow
- Internal wallet transfers with admin approval for high-value NGN transfers
- Admin monthly payment reports
- Swagger docs
- Unit tests (Jest)
- Docker Compose for API + Postgres

## Tech Stack
- NestJS (TypeScript)
- PostgreSQL
- TypeORM + migrations
- Paystack (initialize + verify)
- Jest
- Swagger (`/docs`)

## Project Structure
- `src/auth` authentication, JWT strategy, guards, roles decorator
- `src/users` user entity + repository service
- `src/wallets` wallet endpoints + Paystack credit logic
- `src/transfers` transfer logic + approval threshold rules
- `src/admin` admin approval + reporting endpoints
- `src/transactions` transaction querying
- `src/paystack` Paystack client abstraction/service + entity
- `src/database/migrations` schema migration
- `src/database/seeds` seed script (admin + sample user)

## Prerequisites
- Node.js 20+
- npm 10+
- Docker + Docker Compose (for containerized run)
- Paystack secret key

## Environment Setup
1. Copy env file:
```bash
cp .env.example .env
```
2. Update values in `.env`.

## Run Locally (without Docker)
1. Install dependencies:
```bash
npm install
```
2. Start Postgres (local or Docker), then run migration:
```bash
npm run migration:run
```
3. Seed admin + sample user:
```bash
npm run seed:admin
```
4. Start API:
```bash
npm run start:dev
```

API base URL: `http://localhost:3000/api`

## Run with Docker Compose
```bash
docker compose up --build
```

This starts:
- Postgres on `localhost:5433`
- API on `localhost:3000`

Container startup runs:
- migrations (`npm run migration:run`)
- seed script (`npm run seed:admin`)
- API start

## Swagger
- URL: `http://localhost:3000/docs`
- Bearer auth is configured for protected endpoints.
## Postman
- URL for published documentation: `https://documenter.getpostman.com/view/23652017/2sBXcDHMSX`


## Scripts
- `npm run start:dev` start in watch mode
- `npm run build` build production
- `npm run start:prod` run compiled app
- `npm run test` run unit tests
- `npm run test:e2e` run e2e integration tests (in-memory Postgres via pg-mem)
- `npm run test:cov` run coverage
- `npm run migration:run` apply migrations
- `npm run migration:revert` revert last migration
- `npm run migration:generate` generate migration
- `npm run seed:admin` seed admin + sample user

## API Endpoints
All routes are prefixed with `/api`.

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Wallets
- `POST /wallets`
- `GET /wallets`
- `GET /wallets/:id`
- `POST /wallets/:walletId/credit/initialize`
- `POST /wallets/credit/verify`

### Transfers
- `POST /transfers`
- `GET /transfers` (paginated user transactions)

### Admin
- `GET /admin/transfers/pending`
- `POST /admin/transfers/:id/approve`
- `POST /admin/transfers/:id/reject`
- `GET /admin/reports/monthly?year=YYYY&month=MM`

## Core Business Rules Implemented
- Unique phone number per user.
- Wallet uniqueness by `(userId, currency)`.
- Credit flow:
  - initialize payment (stores `PaystackPayment` + pending `Transaction`)
  - verify payment idempotently; repeated verify does not double-credit.
- Transfers:
  - same currency required.
  - sufficient funds required.
  - if `NGN` and amount `> 1,000,000`, transfer is `REQUIRES_APPROVAL`.
- Admin approval:
  - approve performs actual debit/credit atomically at approval time.
  - reject marks transfer rejected without balance movement.
- Monthly report:
  - aggregates successful credits + successful transfers.

## Sample cURL Flow

### 1) Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2348012345678","password":"StrongPass123"}'
```

### 2) Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2348012345678","password":"StrongPass123"}'
```

### 3) Create wallet
```bash
curl -X POST http://localhost:3000/api/wallets \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"NGN"}'
```

### 4) Initialize credit
```bash
curl -X POST http://localhost:3000/api/wallets/<WALLET_ID>/credit/initialize \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"amount":5000}'
```

### 5) Verify credit
```bash
curl -X POST http://localhost:3000/api/wallets/credit/verify \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reference":"credit_xxx"}'
```

### 6) Transfer
```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fromWalletId":"<FROM_WALLET_ID>","toWalletId":"<TO_WALLET_ID>","amount":1200}'
```

### 7) Admin approve pending transfer
```bash
curl -X POST http://localhost:3000/api/admin/transfers/<TRANSACTION_ID>/approve \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"
```

## Testing
Run all unit tests:
```bash
npm run test
```

Included tests:
- `src/auth/auth.service.spec.ts`
- `src/wallets/wallets.service.spec.ts`
- `src/transfers/transfers.service.spec.ts`
- `test/app.e2e-spec.ts` (full HTTP flow: register/login, wallet create, credit initialize/verify, pending transfer, admin approve, monthly report)

## Notes
- Amounts are stored as `numeric(18,2)`.
- Balance changes are done in DB transactions with pessimistic row locking.
- Response/error shapes are globally standardized via interceptor + exception filter.
