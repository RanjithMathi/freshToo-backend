# JWT Auth Backend (Express + Neon Postgres)

Simple backend with email/password registration, login, and JWT-protected routes.

## Setup

```bash
npm install
```

`.env` is already filled in with your Neon connection string. Before deploying anywhere
real, **replace `JWT_SECRET`** with a long random value, e.g.:

```bash
openssl rand -hex 64
```

Create the `users` table (run once):

```bash
node db/init.js
```

Start the server:

```bash
npm start
```

## Endpoints

### `GET /health`
Checks the server and DB connection are alive.

### `POST /auth/register`
```json
{ "email": "a@b.com", "password": "at least 8 chars" }
```
→ `201` with `{ user, token }`

### `POST /auth/login`
```json
{ "email": "a@b.com", "password": "..." }
```
→ `200` with `{ user, token }`

### `GET /user/me`  (protected)
Header: `Authorization: Bearer <token>`
→ `200` with `{ user }`

## Notes / next steps

- **Rotate your Neon password.** It was pasted into this chat, so treat it as
  exposed and generate a new one from the Neon dashboard, then update `.env`.
- Passwords are hashed with bcrypt (10 rounds) — never stored in plaintext.
- Tokens expire in 1 hour by default (`JWT_EXPIRES_IN` in `.env`). There's no
  refresh-token flow here — add one if you need long-lived sessions.
- `client.release()` pattern from your snippet is used in `db/pool.js`'s
  `query()` helper, so every request always returns its connection to the pool.
- No rate limiting on `/auth/login` or `/auth/register` — add something like
  `express-rate-limit` before going to production, to slow down brute force
  attempts.
