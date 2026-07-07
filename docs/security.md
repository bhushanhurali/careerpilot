# Authentication Security

This document describes the implemented Phase 1 authentication controls. It is a security model,
not a claim that the application has completed production hardening.

## Authentication Flow

1. Registration or login validates the request and verifies credentials.
2. The API returns a short-lived access token and the public user profile.
3. The API sets a longer-lived refresh token in the `careerpilot_refresh_token` HTTP-only cookie.
4. Angular keeps the access token only in memory.
5. The HTTP interceptor adds the access token as a bearer token to API requests.
6. Protected backend routes verify the JWT signature, expiry, type, user ID, and role.
7. After a browser reload, Angular calls refresh and then `/me` to restore the authenticated user.

The API never returns the refresh token in JSON. The frontend does not store either token in
`localStorage` or `sessionStorage`.

## Token Lifecycle

### Access Token

- Default lifetime: 900 seconds (15 minutes).
- Storage: Angular process memory only.
- Transport: `Authorization: Bearer <access-token>`.
- Server state: none for normal verification.
- Revocation: expires naturally; there is no access-token denylist in Phase 1.

### Refresh Token

- Default lifetime: 2,592,000 seconds (30 days).
- Client storage: HTTP-only cookie.
- Server storage: SHA-256 token hash in PostgreSQL.
- Transport: browser cookie on `/api/v1/auth` requests.
- Revocation: database record receives `revoked_at`.

Register and login create a new refresh-token family. Refresh creates a replacement token in the
same family and revokes the token that was just used. Logout revokes the presented token and
clears the browser cookie.

## Refresh Token Rotation

The refresh operation runs in a database transaction:

1. Verify the JWT signature and claims.
2. Hash the presented raw token and find its database record.
3. Reject missing, expired, or revoked records.
4. Create a new refresh token in the same family.
5. Store the new token hash.
6. Revoke the old record and link it to its replacement.
7. Set the replacement cookie and return a new access token.

Presenting an already revoked refresh token is treated as possible replay. The backend revokes the
entire token family.

The Angular store shares an in-flight refresh observable so concurrent `401` responses do not
normally rotate the same refresh token several times.

## Cookie Settings

| Setting    | Development/default value | Reason                                                      |
| ---------- | ------------------------- | ----------------------------------------------------------- |
| `HttpOnly` | `true`                    | Prevents JavaScript from reading the refresh token          |
| `Secure`   | `false` locally           | Allows local HTTP; must be `true` over production HTTPS     |
| `SameSite` | `Lax`                     | Reduces cross-site cookie sending                           |
| `Path`     | `/api/v1/auth`            | Restricts the cookie to authentication endpoints            |
| `Max-Age`  | Refresh-token TTL         | Aligns browser expiry with configured server token lifetime |

`COOKIE_SECURE` should be `true` in production. If the frontend and API are deployed cross-site,
the cookie policy and CSRF protections must be redesigned and tested together.

## Route Protection

The Angular guards improve navigation behavior and user experience, but they are not a security
boundary. A user can bypass frontend code.

The Express `authenticate` middleware is the security boundary. It requires a bearer access token
and attaches the verified user ID and role to the request. Future role checks can use the existing
`requireRole` middleware, but no admin feature is exposed in Phase 1.

## Business Data Authorization

Phase 2 adds authenticated company and contact data. Phase 3 adds authenticated job application
data. Phase 4 adds application status history.

- Every company query is scoped by both company ID and authenticated user ID.
- Cross-user company reads, updates, and deletes return `404`, not `403`, so the API does not
  reveal whether another user's record exists.
- Contact routes are nested under companies. The service first verifies the parent company belongs
  to the authenticated user, then scopes the contact query by `company_id` and contact ID.
- Applications store direct `user_id` ownership and every application query is scoped by the
  authenticated user ID.
- Application create/update validates that `companyId` belongs to the authenticated user.
- Application `contactId` is optional, but when supplied it must belong to the selected company.
- Application status history does not store `user_id`; authorization is derived by first verifying
  the parent application belongs to the authenticated user.
- Application status changes use a dedicated transition endpoint. The backend updates
  `job_applications.status` and inserts the append-only history entry in one database transaction.
- Request bodies never accept client-controlled IDs, `userId`, timestamps, or deletion fields.
- Status-transition request bodies never accept client-controlled `changedAt`; the backend
  generates it.
- Company deletion soft-deletes the owned company and its active contacts in one transaction.
- Application deletion soft-deletes the owned application. Its status history remains in the
  database but is inaccessible through normal application-scoped API routes.

Frontend route guards improve navigation only. They do not enforce ownership. The backend service
layer is the authorization boundary for companies, contacts, and applications.

## Validation and Error Handling

- Zod validates and normalizes authentication request bodies.
- Registration passwords must be 12 to 128 characters.
- Email addresses are trimmed, lowercased, and limited to 320 characters.
- Unknown request fields are rejected.
- Login returns the same `INVALID_CREDENTIALS` response for unknown users and wrong passwords.
- Unhandled errors are logged but return a generic message.
- Authorization headers, cookies, and `Set-Cookie` response headers are redacted from logs.

## Password Hashing

Passwords are hashed with bcrypt using 12 salt rounds. Only the hash is stored. Passwords and
password hashes must never be logged or returned in API responses.

bcrypt is intentionally slow to make offline guessing more expensive. Argon2id is a strong future
alternative with memory-hard properties, but bcrypt is mature, portable, and appropriate for the
current project.

## Rate Limiting

Phase 1 applies per-process, IP-based limits:

| Endpoint    | Limit                      |
| ----------- | -------------------------- |
| `/register` | 5 requests per hour        |
| `/login`    | 10 requests per 15 minutes |
| `/refresh`  | 30 requests per minute     |

Rate-limit responses use HTTP `429`. The current in-memory limiter is suitable for local
development and a single API instance. Multiple production instances require a shared store, such
as Redis, or an upstream gateway limit.

## Session Restoration

Angular begins with an `unknown` auth state. Startup attempts refresh once:

- Success stores the new access token in memory and calls `/me`.
- Successful `/me` stores the current user and marks the state authenticated.
- Failure clears memory state and marks the user anonymous.

Once startup resolves as anonymous, guards do not repeatedly call refresh. Protected navigation
redirects to `/auth/login`; guest routes remain available.

## Threats Considered

### Cross-Site Scripting (XSS)

HTTP-only storage prevents JavaScript from reading the refresh token, and memory-only access
tokens are not persisted. XSS could still act as the user within the compromised page or read the
in-memory access token. Angular template escaping, avoiding unsafe HTML APIs, dependency review,
and Content Security Policy remain important.

### Cross-Site Request Forgery (CSRF)

The bearer access token is not automatically attached by the browser, so normal protected API
requests are not directly cookie-authenticated. Refresh and logout do use cookies. `SameSite=Lax`,
the cookie path, explicit CORS origin, and JSON API requests reduce risk for the current same-site
topology. These controls are not a universal substitute for CSRF tokens in cross-site deployments.

### Token Theft

TLS, HTTP-only refresh cookies, short access-token lifetime, hashed database storage, rotation,
family revocation, and log redaction reduce the likelihood and impact of theft. Production must
use HTTPS.

### Brute Force

Password hashing and endpoint rate limits make repeated guessing more expensive. Account lockout
is intentionally not implemented yet because it can be abused for denial of service.

### Credential Stuffing

Generic login errors avoid account discovery, and rate limits slow automated attempts. Future
improvements include breached-password checks, suspicious-login monitoring, MFA, and gateway-level
rate limits.

## Remaining Production Work

- Use secrets from a managed secret store and support key rotation.
- Add HTTPS enforcement and a reviewed Content Security Policy.
- Add distributed rate limiting for multiple API instances.
- Define session cleanup for expired and revoked records.
- Add password reset, email verification, MFA, and security-event revocation.
- Perform dependency scanning, threat modeling, and an external security review.
