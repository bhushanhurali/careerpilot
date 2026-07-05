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

## Company and Contact Conventions

All company and contact endpoints require a bearer access token.

Ownership is always enforced by the backend:

- Companies are scoped by `companyId` and authenticated `userId`.
- Contacts are scoped by the authenticated user's owned parent company and then by `contactId`.
- Cross-user access returns `404`, the same as a nonexistent resource.
- Request bodies must not include IDs, `userId`, `companyId`, timestamps, or deletion fields.

List endpoints return pagination metadata in `meta`:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 42,
  "totalPages": 3
}
```

## GET `/companies`

Lists the authenticated user's active companies.

Authentication: bearer access token required.

Query parameters:

| Name            | Default | Notes                                                       |
| --------------- | ------- | ----------------------------------------------------------- |
| `page`          | `1`     | Integer from 1 to 10000                                     |
| `pageSize`      | `20`    | Integer from 1 to 100                                       |
| `search`        | none    | Case-insensitive company-name search, 1 to 160 characters   |
| `industry`      | none    | Case-insensitive industry filter, 1 to 120 characters       |
| `location`      | none    | Case-insensitive location filter, 1 to 160 characters       |
| `sortBy`        | `name`  | `name`, `industry`, `location`, `createdAt`, or `updatedAt` |
| `sortDirection` | `asc`   | `asc` or `desc`                                             |

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "id": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
        "name": "Acme GmbH",
        "website": "https://acme.example",
        "industry": "Software",
        "location": "Berlin",
        "notes": null,
        "createdAt": "2026-07-05T10:00:00.000Z",
        "updatedAt": "2026-07-05T10:00:00.000Z"
      }
    ]
  },
  "error": null,
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## POST `/companies`

Creates a company for the authenticated user.

Authentication: bearer access token required.

Request:

```json
{
  "name": "Acme GmbH",
  "website": "https://acme.example",
  "industry": "Software",
  "location": "Berlin",
  "notes": "Interesting platform team."
}
```

Validation:

- `name`: required, trimmed, 1 to 160 characters.
- `website`: optional valid URL, maximum 2048 characters.
- `industry`: optional, maximum 120 characters.
- `location`: optional, maximum 160 characters.
- `notes`: optional, maximum 10000 characters.
- Empty optional values are stored as `null`.
- Additional fields are rejected.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "company": {
      "id": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
      "name": "Acme GmbH",
      "website": "https://acme.example",
      "industry": "Software",
      "location": "Berlin",
      "notes": "Interesting platform team.",
      "createdAt": "2026-07-05T10:00:00.000Z",
      "updatedAt": "2026-07-05T10:00:00.000Z"
    }
  },
  "error": null,
  "meta": {}
}
```

Errors:

| Status | Code                          | Meaning                                          |
| ------ | ----------------------------- | ------------------------------------------------ |
| `400`  | `VALIDATION_ERROR`            | Request body does not match the schema           |
| `401`  | `AUTH_TOKEN_MISSING/INVALID`  | Missing or invalid bearer token                  |
| `409`  | `COMPANY_NAME_ALREADY_EXISTS` | Active company name already exists for this user |
| `500`  | `INTERNAL_SERVER_ERROR`       | Unexpected server failure                        |

## GET `/companies/:companyId`

Returns one owned active company.

Authentication: bearer access token required.

Success: `200 OK`

Response body uses the same `company` shape as `POST /companies`.

Errors:

| Status | Code                    | Meaning                                     |
| ------ | ----------------------- | ------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | `companyId` is not a UUID                   |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied               |
| `404`  | `COMPANY_NOT_FOUND`     | Company does not exist or belongs elsewhere |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                   |

## PATCH `/companies/:companyId`

Updates one owned active company.

Authentication: bearer access token required.

Request body: any non-empty subset of the create-company fields.

Success: `200 OK`

Response body uses the same `company` shape as `POST /companies`.

Errors:

| Status | Code                          | Meaning                                          |
| ------ | ----------------------------- | ------------------------------------------------ |
| `400`  | `VALIDATION_ERROR`            | Params/body do not match the schema              |
| `401`  | `AUTH_TOKEN_MISSING`          | Bearer token was not supplied                    |
| `404`  | `COMPANY_NOT_FOUND`           | Company does not exist or belongs elsewhere      |
| `409`  | `COMPANY_NAME_ALREADY_EXISTS` | Active company name already exists for this user |
| `500`  | `INTERNAL_SERVER_ERROR`       | Unexpected server failure                        |

## DELETE `/companies/:companyId`

Soft-deletes one owned active company and its active contacts.

Authentication: bearer access token required.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "error": null,
  "meta": {}
}
```

Deletion runs in one Sequelize transaction:

1. Verify the active company belongs to the authenticated user.
2. Soft-delete active contacts for that company.
3. Soft-delete the company.

## GET `/companies/:companyId/contacts`

Lists active contacts for one owned active company.

Authentication: bearer access token required.

Query parameters:

| Name            | Default     | Notes                                                 |
| --------------- | ----------- | ----------------------------------------------------- |
| `page`          | `1`         | Integer from 1 to 10000                               |
| `pageSize`      | `20`        | Integer from 1 to 100                                 |
| `search`        | none        | Searches first name, last name, email, and role title |
| `sortBy`        | `createdAt` | `firstName`, `lastName`, `createdAt`, or `updatedAt`  |
| `sortDirection` | `desc`      | `asc` or `desc`                                       |

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
        "companyId": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
        "firstName": "Ada",
        "lastName": "Lovelace",
        "email": "ada@example.com",
        "phone": "+49 30 123456",
        "roleTitle": "Recruiter",
        "linkedInUrl": "https://www.linkedin.com/in/ada",
        "notes": null,
        "createdAt": "2026-07-05T10:00:00.000Z",
        "updatedAt": "2026-07-05T10:00:00.000Z"
      }
    ]
  },
  "error": null,
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## POST `/companies/:companyId/contacts`

Creates a contact under one owned active company.

Authentication: bearer access token required.

Request:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "phone": "+49 30 123456",
  "roleTitle": "Recruiter",
  "linkedInUrl": "https://www.linkedin.com/in/ada",
  "notes": "Initial screening contact."
}
```

Validation:

- `firstName`: required, trimmed, 1 to 80 characters.
- `lastName`: optional, maximum 80 characters.
- `email`: optional valid email, maximum 320 characters, lowercased.
- `phone`: optional, maximum 40 characters.
- `roleTitle`: optional, maximum 120 characters.
- `linkedInUrl`: optional valid URL, maximum 2048 characters.
- `notes`: optional, maximum 10000 characters.
- Empty optional values are stored as `null`.
- Additional fields are rejected.

Success: `201 Created`

Response body contains `{ "contact": ... }` using the contact shape from the list endpoint.

## GET `/companies/:companyId/contacts/:contactId`

Returns one active contact under one owned active company.

Authentication: bearer access token required.

Success: `200 OK`

Response body contains `{ "contact": ... }`.

Errors:

| Status | Code                    | Meaning                                               |
| ------ | ----------------------- | ----------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | `companyId` or `contactId` is not a UUID              |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                         |
| `404`  | `COMPANY_NOT_FOUND`     | Parent company does not exist or belongs elsewhere    |
| `404`  | `CONTACT_NOT_FOUND`     | Contact does not exist under the owned parent company |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                             |

## PATCH `/companies/:companyId/contacts/:contactId`

Updates one active contact under one owned active company.

Authentication: bearer access token required.

Request body: any non-empty subset of the create-contact fields.

Success: `200 OK`

Response body contains `{ "contact": ... }`.

## DELETE `/companies/:companyId/contacts/:contactId`

Soft-deletes one active contact under one owned active company.

Authentication: bearer access token required.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "error": null,
  "meta": {}
}
```
