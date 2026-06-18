# 0005: Use Short-Lived JWT Access Tokens and Rotating Refresh Tokens

## Status

Accepted

## Context

CareerPilot needs authenticated browser sessions without storing long-lived credentials in
JavaScript-accessible browser storage. The API must remain stateless for normal authorized
requests while retaining the ability to revoke sessions.

## Decision

CareerPilot uses two tokens with different responsibilities:

- A short-lived JWT access token authorizes API requests.
- A longer-lived JWT refresh token restores and renews a session.

The access token is returned in the response body after registration, login, or refresh. The
Angular application stores it only in memory and sends it in the `Authorization: Bearer <token>`
header. It is lost when the page reloads.

The refresh token is sent only as an HTTP-only cookie. JavaScript cannot read the cookie. The
backend stores a SHA-256 hash of each refresh token in PostgreSQL and rotates the token whenever
it is used.

## Why JWT Access Tokens

JWT access tokens allow the API to verify the user identity and role without querying a session
table on every protected request. They are signed, short-lived, and carry only the minimum claims:
user ID, role, and token type.

The tradeoff is that an issued access token cannot currently be revoked immediately. A disabled
user may retain access until the token expires. The short default lifetime of 15 minutes limits
that window.

## Why Refresh Tokens

A short access-token lifetime is safer but would otherwise force frequent logins. A refresh token
provides session continuity while remaining independently revocable in PostgreSQL.

Refresh tokens are longer-lived credentials and therefore require stronger storage, rotation, and
revocation controls than access tokens.

## Why Access Tokens Are Memory-Only

Keeping the access token in an Angular signal means it disappears when the tab reloads or closes.
This reduces the persistence of a stolen token and avoids exposing it through browser storage.

The cost is that the frontend must restore a session at startup by using the refresh cookie and
then loading the current user. Multiple tabs also maintain independent access tokens.

## Why Refresh Tokens Use HTTP-Only Cookies

An HTTP-only cookie cannot be read through browser JavaScript, which reduces token theft after an
XSS vulnerability. `Secure` prevents transmission over plain HTTP in production, `SameSite=Lax`
limits many cross-site requests, and the cookie path restricts it to `/api/v1/auth`.

Cookies are attached by the browser, so cookie-based credentials require CSRF analysis. The
current same-site deployment, `SameSite=Lax`, strict CORS origin, JSON requests, and narrow cookie
path reduce exposure. A cross-site deployment would require revisiting `SameSite`, `Secure`, and
adding an explicit CSRF token or equivalent origin verification.

## Why Browser Storage Is Avoided

`localStorage` and `sessionStorage` are directly readable by JavaScript. An XSS payload could copy
a stored bearer token and use it from another device. `sessionStorage` has a shorter lifetime than
`localStorage`, but it has the same JavaScript accessibility problem.

No access or refresh token is intentionally written to either storage mechanism.

## Why PostgreSQL Stores Refresh Token Hashes

The raw refresh token is a bearer credential. Storing only a deterministic SHA-256 hash means a
database leak does not directly reveal usable refresh tokens. The server hashes the presented
cookie and looks up the matching record.

This differs from password hashing: refresh tokens are high-entropy random signed values, so a
fast cryptographic hash is appropriate. User passwords have lower entropy and use bcrypt with a
work factor instead.

PostgreSQL records also support expiry, revocation, token-family tracking, and replacement links.
Reusing a revoked token revokes its token family.

## Why Redis Is Not Used Yet

PostgreSQL is already the system of record and is sufficient for the expected Phase 1 load. Using
it for refresh sessions keeps local development, transactions, backups, and operations simple.

Redis could reduce session lookup latency and support distributed rate limiting, but it would add
another stateful service and consistency decisions before the application needs them.

## Alternatives Considered

### Server-Side Opaque Sessions

Opaque session IDs in HTTP-only cookies provide immediate server-side revocation and a simple
browser model. They require a database or cache lookup for every authenticated request. This is a
strong alternative and may be preferable for many browser-only applications.

### Both Tokens in HTTP-Only Cookies

This prevents JavaScript from reading either token, but every authenticated request becomes
cookie-authenticated and requires comprehensive CSRF protection. The chosen design keeps normal
API authorization explicit in the bearer header.

### Tokens in localStorage or sessionStorage

This simplifies persistence and request interception but increases the impact of XSS. It was
rejected.

### Refresh Tokens Stored in Plaintext

Plaintext makes lookup easy but turns a database leak into active sessions. It was rejected.

## Consequences

- Page reload triggers a refresh request and then `GET /auth/me`.
- Protected requests remain stateless until an access token expires.
- Refresh and logout operations require PostgreSQL.
- Logout revokes the current refresh token and clears its cookie, but an already issued access
  token remains valid until expiry.
- Parallel refresh attempts must be coordinated by the frontend. CareerPilot shares one in-flight
  refresh observable.

## Future Evolution

- Add explicit CSRF protection if frontend and API become cross-site.
- Add a user-facing session/device management screen.
- Revoke all token families after password changes or security events.
- Add Redis for distributed rate limits or high-volume session workloads when measurements
  justify it.
- Add key rotation using JWT key IDs and asymmetric signing.
- Add email verification, password reset, and optional OAuth as separate decisions.
