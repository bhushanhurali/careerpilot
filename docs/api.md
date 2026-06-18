# API Guidelines

The API base path is:

```text
/api/v1
```

All API responses should use this envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

Errors should use:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": []
  },
  "meta": {}
}
```

## Decisions

- Use one response format to simplify frontend error handling.
- Version the API from the start with `/api/v1`.
- Keep controllers thin and move business behavior into services during feature phases.
- Keep `/health` minimal for infrastructure checks and `/api/v1/health` enveloped for API consistency.

## Authentication Conventions

- Access tokens are returned in JSON and sent as `Authorization: Bearer <token>`.
- Refresh tokens are never returned in JSON. They are set as HTTP-only cookies.
- Browser clients must use credentials for register, login, refresh, and logout requests.
- Authenticated endpoints return `401` for a missing, expired, or invalid access token.

The examples below omit changing IDs and token values. The real API returns UUIDs and signed JWTs.

## POST `/auth/register`

Creates a user, starts a refresh session, and returns an access token.

Authentication: none.

Request:

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery-staple",
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

Validation:

- `email`: valid email, maximum 320 characters; trimmed and lowercased.
- `password`: 12 to 128 characters.
- `firstName` and `lastName`: 1 to 80 characters after trimming.
- Additional fields are rejected.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "f3641248-51a8-4fc3-a65a-e99daac7cb14",
      "email": "ada@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "role": "user"
    },
    "accessToken": "<jwt>"
  },
  "error": null,
  "meta": {}
}
```

The response also sets the refresh cookie.

Errors:

| Status | Code                    | Meaning                                    |
| ------ | ----------------------- | ------------------------------------------ |
| `400`  | `VALIDATION_ERROR`      | Request body does not match the schema     |
| `409`  | `EMAIL_ALREADY_EXISTS`  | The normalized email is already registered |
| `429`  | `RATE_LIMIT_EXCEEDED`   | Registration rate limit has been exceeded  |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                  |

## POST `/auth/login`

Verifies credentials and creates a new refresh session.

Authentication: none.

Request:

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery-staple"
}
```

Success: `200 OK`

The response body has the same `user` and `accessToken` shape as registration and sets the refresh
cookie.

Errors:

| Status | Code                    | Meaning                                     |
| ------ | ----------------------- | ------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Request body does not match the schema      |
| `401`  | `INVALID_CREDENTIALS`   | Email/password is wrong or user is inactive |
| `429`  | `RATE_LIMIT_EXCEEDED`   | Login rate limit has been exceeded          |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                   |

The API deliberately does not reveal whether the email exists.

## POST `/auth/refresh`

Rotates the refresh token and returns a new access token.

Authentication: valid `careerpilot_refresh_token` HTTP-only cookie. No bearer token is required.

Request body:

```json
{}
```

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "<new-jwt>"
  },
  "error": null,
  "meta": {}
}
```

The response replaces the refresh cookie. The previous refresh-token record is revoked.

Errors:

| Status | Code                    | Meaning                                         |
| ------ | ----------------------- | ----------------------------------------------- |
| `401`  | `REFRESH_TOKEN_INVALID` | Cookie is missing, invalid, unknown, or expired |
| `401`  | `REFRESH_TOKEN_REVOKED` | A revoked token was reused; family is revoked   |
| `429`  | `RATE_LIMIT_EXCEEDED`   | Refresh rate limit has been exceeded            |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                       |

On refresh failure, the API clears the refresh cookie.

## POST `/auth/logout`

Revokes the current refresh token and clears its cookie. Logout is idempotent when no refresh
cookie is present.

Authentication: refresh cookie when available. No bearer token is required.

Request body:

```json
{}
```

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  },
  "error": null,
  "meta": {}
}
```

Errors:

| Status | Code                    | Meaning                    |
| ------ | ----------------------- | -------------------------- |
| `400`  | `VALIDATION_ERROR`      | Body contains extra fields |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure  |

Logout cannot invalidate an already issued access token. The Angular client clears it from memory,
and any copied token expires according to `ACCESS_TOKEN_TTL_SECONDS`.

## GET `/auth/me`

Returns the current public user profile.

Authentication: bearer access token required.

Request body: none.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "f3641248-51a8-4fc3-a65a-e99daac7cb14",
      "email": "ada@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "role": "user"
    }
  },
  "error": null,
  "meta": {}
}
```

Errors:

| Status | Code                    | Meaning                               |
| ------ | ----------------------- | ------------------------------------- |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied         |
| `401`  | `AUTH_TOKEN_EXPIRED`    | Access token has expired              |
| `401`  | `AUTH_TOKEN_INVALID`    | Token signature or claims are invalid |
| `401`  | `AUTH_USER_NOT_FOUND`   | User was removed or deactivated       |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure             |
