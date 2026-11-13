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

| Name            | Default | Notes                                                           |
| --------------- | ------- | --------------------------------------------------------------- |
| `page`          | `1`     | Integer from 1 to 10000                                         |
| `pageSize`      | `20`    | Integer from 1 to 100                                           |
| `search`        | none    | Case-insensitive company-name search, 1 to 160 characters       |
| `industry`      | none    | Case-insensitive industry substring filter, 1 to 120 characters |
| `location`      | none    | Case-insensitive location substring filter, 1 to 160 characters |
| `sortBy`        | `name`  | `name`, `industry`, `location`, `createdAt`, or `updatedAt`     |
| `sortDirection` | `asc`   | `asc` or `desc`                                                 |

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

## Application Conventions

All application endpoints require a bearer access token.

Applications are exposed as top-level resources because they are the user's job-search pipeline.
They still validate their relationships:

- Every application belongs directly to the authenticated user through `userId`.
- `companyId` is required and must reference an active company owned by the authenticated user.
- `contactId` is optional. When supplied, it must reference an active contact belonging to the
  selected company.
- Cross-user application access returns `404`, the same as a nonexistent application.
- Request bodies must not include IDs, `userId`, timestamps, or deletion fields.
- Empty optional strings are stored as `null`.
- `job_applications.status` stores the denormalized current status for pipeline filters, sorting,
  and summaries.
- Application creation creates the initial status-history row in the same transaction as the
  application row.
- Status history is append-only, listed oldest-first, and scoped through the owned parent
  application. History rows do not duplicate `userId`.
- Status changes must use the status-transition endpoint. `PATCH /applications/:applicationId`
  does not accept `status`.
- Soft-deleted applications keep their history rows in the database, but normal application
  history endpoints require an active owned parent application.

Allowed status values:

```text
draft, applied, screening, interviewing, offer, rejected, withdrawn, accepted
```

Allowed priority values:

```text
low, medium, high
```

## GET `/applications`

Lists the authenticated user's active job applications.

Authentication: bearer access token required.

Query parameters:

| Name             | Default     | Notes                                                                                  |
| ---------------- | ----------- | -------------------------------------------------------------------------------------- |
| `page`           | `1`         | Integer from 1 to 10000                                                                |
| `pageSize`       | `20`        | Integer from 1 to 100                                                                  |
| `search`         | none        | Searches job title, source, location, and company name                                 |
| `status`         | none        | One allowed status value                                                               |
| `priority`       | none        | `low`, `medium`, or `high`                                                             |
| `companyId`      | none        | UUID of an owned company                                                               |
| `contactId`      | none        | UUID of a contact linked to applications                                               |
| `source`         | none        | Case-insensitive source substring filter                                               |
| `location`       | none        | Case-insensitive location substring filter                                             |
| `employmentType` | none        | Exact employment-type filter                                                           |
| `workMode`       | none        | Exact work-mode filter                                                                 |
| `sortBy`         | `updatedAt` | `jobTitle`, `status`, `priority`, `companyName`, `appliedAt`, `createdAt`, `updatedAt` |
| `sortDirection`  | `desc`      | `asc` or `desc`                                                                        |

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "1b92a414-29d6-4625-96cc-f4c036d78a0a",
        "userId": "f3641248-51a8-4fc3-a65a-e99daac7cb14",
        "companyId": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
        "contactId": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
        "jobTitle": "Senior Angular Developer",
        "jobUrl": "https://acme.example/jobs/angular",
        "source": "LinkedIn",
        "status": "applied",
        "priority": "high",
        "salaryMin": 65000,
        "salaryMax": 80000,
        "salaryCurrency": "EUR",
        "location": "Munich, Germany",
        "employmentType": "full_time",
        "workMode": "hybrid",
        "appliedAt": "2026-07-05",
        "notes": "Strong frontend role.",
        "company": {
          "id": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
          "name": "Acme GmbH"
        },
        "contact": {
          "id": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
          "firstName": "Ada",
          "lastName": "Lovelace",
          "email": "ada@example.com"
        },
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

## POST `/applications`

Creates an application for an owned company.

Authentication: bearer access token required.

Request:

```json
{
  "companyId": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
  "contactId": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
  "jobTitle": "Senior Angular Developer",
  "jobUrl": "https://acme.example/jobs/angular",
  "source": "LinkedIn",
  "status": "applied",
  "priority": "high",
  "salaryMin": 65000,
  "salaryMax": 80000,
  "salaryCurrency": "EUR",
  "location": "Munich, Germany",
  "employmentType": "full_time",
  "workMode": "hybrid",
  "appliedAt": "2026-07-05",
  "notes": "Strong frontend role."
}
```

Validation:

- `companyId`: required UUID of an active company owned by the authenticated user.
- `contactId`: optional UUID or `null`; must belong to `companyId` when supplied.
- `jobTitle`: required, trimmed, 1 to 160 characters.
- `jobUrl`: optional valid URL, maximum 2048 characters.
- `source`: optional, maximum 120 characters.
- `status`: optional; defaults to `draft`.
- `priority`: optional; defaults to `medium`.
- `salaryMin` and `salaryMax`: optional non-negative integers.
- `salaryCurrency`: required when either salary value is supplied; normalized to uppercase
  3-letter format.
- `salaryMin <= salaryMax` when both salary values are present.
- `location`: optional, maximum 160 characters.
- `employmentType` and `workMode`: optional, maximum 80 characters.
- `appliedAt`: optional `YYYY-MM-DD` date-only value.
- `notes`: optional, maximum 10000 characters.
- Additional fields are rejected.

Success: `201 Created`

Response body contains `{ "application": ... }` using the application shape from the list endpoint.
The backend also creates the initial status-history row in the same transaction, using the created
application's status and creation time.

Errors:

| Status | Code                       | Meaning                                                          |
| ------ | -------------------------- | ---------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`         | Body or query does not match the schema                          |
| `400`  | `CONTACT_COMPANY_MISMATCH` | Owned contact exists but belongs to a different selected company |
| `400`  | `INVALID_SALARY_RANGE`     | Salary rules are not satisfied                                   |
| `401`  | `AUTH_TOKEN_MISSING`       | Bearer token was not supplied                                    |
| `404`  | `COMPANY_NOT_FOUND`        | Company does not exist or belongs elsewhere                      |
| `404`  | `CONTACT_NOT_FOUND`        | Contact does not exist or belongs elsewhere                      |
| `500`  | `INTERNAL_SERVER_ERROR`    | Unexpected server failure                                        |

## GET `/applications/:applicationId`

Returns one owned active application.

Authentication: bearer access token required.

Success: `200 OK`

Response body contains `{ "application": ... }`.

Errors:

| Status | Code                    | Meaning                                         |
| ------ | ----------------------- | ----------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | `applicationId` is not a UUID                   |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                   |
| `404`  | `APPLICATION_NOT_FOUND` | Application does not exist or belongs elsewhere |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                       |

## PATCH `/applications/:applicationId`

Updates one owned active application.

Authentication: bearer access token required.

Request body: any non-empty subset of the create-application fields except `status`. If `companyId`
changes, the existing or supplied `contactId` must still belong to the resulting company. Send
`contactId: null` to clear the selected contact. Use
`POST /applications/:applicationId/status-transitions` to change status.

Success: `200 OK`

Response body contains `{ "application": ... }`.

Errors use the same codes as `POST /applications`, plus `APPLICATION_NOT_FOUND` when the target
application does not exist or belongs to another user.

## GET `/applications/:applicationId/status-history`

Lists the append-only status timeline for one owned active application.

Authentication: bearer access token required.

Success: `200 OK`

Rows are returned oldest-first by `changedAt`.

```json
{
  "success": true,
  "data": {
    "statusHistory": [
      {
        "id": "0c197b8f-b3ad-4fe1-a24b-cd0ab9f7cc31",
        "applicationId": "1b92a414-29d6-4625-96cc-f4c036d78a0a",
        "fromStatus": null,
        "toStatus": "applied",
        "changedAt": "2026-07-05T10:00:00.000Z",
        "note": null,
        "createdAt": "2026-07-05T10:00:00.000Z",
        "updatedAt": "2026-07-05T10:00:00.000Z"
      }
    ]
  },
  "error": null,
  "meta": {}
}
```

Errors:

| Status | Code                    | Meaning                                         |
| ------ | ----------------------- | ----------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | `applicationId` is not a UUID                   |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                   |
| `404`  | `APPLICATION_NOT_FOUND` | Application does not exist or belongs elsewhere |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                       |

## POST `/applications/:applicationId/status-transitions`

Changes the current status for one owned active application and appends one history row.

Authentication: bearer access token required.

Request:

```json
{
  "status": "interviewing",
  "note": "Technical interview scheduled."
}
```

Validation:

- `status`: required, one allowed application status value.
- `note`: optional, maximum 10000 characters. Empty optional values are stored as `null`.
- `changedAt` is generated by the backend and is not accepted from clients.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "application": {
      "id": "1b92a414-29d6-4625-96cc-f4c036d78a0a",
      "userId": "f3641248-51a8-4fc3-a65a-e99daac7cb14",
      "companyId": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
      "contactId": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
      "jobTitle": "Senior Angular Developer",
      "jobUrl": "https://acme.example/jobs/angular",
      "source": "LinkedIn",
      "status": "interviewing",
      "priority": "high",
      "salaryMin": 65000,
      "salaryMax": 80000,
      "salaryCurrency": "EUR",
      "location": "Munich, Germany",
      "employmentType": "full_time",
      "workMode": "hybrid",
      "appliedAt": "2026-07-05",
      "notes": "Strong frontend role.",
      "company": {
        "id": "56e1a95a-35fa-4e0e-a2f2-0268ca7f58cf",
        "name": "Acme GmbH"
      },
      "contact": {
        "id": "292f9b7e-b573-4a84-8970-f90a2eed26bd",
        "firstName": "Ada",
        "lastName": "Lovelace",
        "email": "ada@example.com"
      },
      "createdAt": "2026-07-05T10:00:00.000Z",
      "updatedAt": "2026-07-05T12:00:00.000Z"
    },
    "historyEntry": {
      "id": "9b2b40de-c48c-4e2a-877e-d1df1e7e0d4a",
      "applicationId": "1b92a414-29d6-4625-96cc-f4c036d78a0a",
      "fromStatus": "applied",
      "toStatus": "interviewing",
      "changedAt": "2026-07-05T12:00:00.000Z",
      "note": "Technical interview scheduled.",
      "createdAt": "2026-07-05T12:00:00.000Z",
      "updatedAt": "2026-07-05T12:00:00.000Z"
    }
  },
  "error": null,
  "meta": {}
}
```

The service updates `job_applications.status` and inserts the status-history row in one database
transaction. Same-status transitions are rejected so history cannot accumulate no-op entries.

Errors:

| Status | Code                    | Meaning                                         |
| ------ | ----------------------- | ----------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Params/body do not match the schema             |
| `400`  | `STATUS_UNCHANGED`      | Requested status matches current status         |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                   |
| `404`  | `APPLICATION_NOT_FOUND` | Application does not exist or belongs elsewhere |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                       |

## DELETE `/applications/:applicationId`

Soft-deletes one owned active application. Its interviews and status history are retained in the
database but are no longer available through the normal application routes.

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

Errors:

| Status | Code                    | Meaning                                         |
| ------ | ----------------------- | ----------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | `applicationId` is not a UUID                   |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                   |
| `404`  | `APPLICATION_NOT_FOUND` | Application does not exist or belongs elsewhere |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                       |

## Interview Conventions

All interview endpoints require a bearer access token and an active application and company
owned by the authenticated user. There is no top-level interviews endpoint. Item operations
additionally require the interview to be active and to belong to the selected application.

Interview types:

```text
phone_screen, recruiter_screen, technical, coding, system_design, hiring_manager, onsite, hr, final, other
```

Interview statuses:

```text
scheduled, completed, cancelled, rescheduled, no_show
```

Interview responses include `id`, `applicationId`, `type`, `status`, `scheduledAt`,
`durationMinutes`, `location`, `meetingUrl`, `notes`, `createdAt`, and `updatedAt`. Timestamps
are returned as ISO strings in UTC, and unset optional fields are `null`. IDs in the path must
be UUIDs. Interview changes do not change the application's status or its status history.

| Status | Code                    | Meaning                                                |
| ------ | ----------------------- | ------------------------------------------------------ |
| `400`  | `VALIDATION_ERROR`      | Params or body do not match the schema                 |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                          |
| `404`  | `APPLICATION_NOT_FOUND` | Parent application is missing, hidden, or not owned    |
| `404`  | `INTERVIEW_NOT_FOUND`   | Interview is missing, deleted, or under another parent |
| `500`  | `INTERNAL_SERVER_ERROR` | Unexpected server failure                              |

### GET `/applications/:applicationId/interviews`

Returns `200 OK` with `data: { interviews: [...] }` in the standard envelope. The list excludes
soft-deleted interviews and sorts by `scheduledAt` ascending, then by ID. An active application
with no interviews returns an empty array. The list is not paginated.

### POST `/applications/:applicationId/interviews`

Returns `201 Created` with `data: { interview: ... }`.

```json
{
  "type": "technical",
  "status": "scheduled",
  "scheduledAt": "2026-12-03T11:00:00+01:00",
  "durationMinutes": 45,
  "location": "Berlin",
  "meetingUrl": "https://meet.example/interview",
  "notes": "Bring portfolio examples."
}
```

- `type`, `status`, and `scheduledAt` are required. The timestamp must include `Z` or a UTC
  offset; the example is returned as `2026-12-03T10:00:00.000Z`.
- `durationMinutes` is an optional positive integer (maximum `2147483647`) or `null`.
- `location`, `meetingUrl`, and `notes` are optional. Text is trimmed and blank values are
  stored as `null`. Limits are 160, 2048, and 10,000 characters respectively. A nonblank
  `meetingUrl` must be an HTTP or HTTPS URL.
- Unknown fields are rejected. Ownership and parent IDs are not accepted in the body.

### PATCH `/applications/:applicationId/interviews/:interviewId`

Returns `200 OK` with `data: { interview: ... }`. Accepts the same fields as creation, with at
least one field required. Omitted fields are left unchanged; use `null` to clear nullable
fields. Interviews cannot be moved to another application. To reschedule, update
`scheduledAt` and set `status` to `rescheduled` if desired.

### DELETE `/applications/:applicationId/interviews/:interviewId`

Soft-deletes the interview and returns `200 OK` with `data: { deleted: true }`. Subsequent
updates or deletions of that interview return `404 INTERVIEW_NOT_FOUND` if the parent is still
accessible.

## Task Conventions

All task endpoints require a bearer access token. Tasks are visible only through an active
application and active company owned by the caller. Nested item routes also require an active
task belonging to the application in the path. Both path IDs must be UUIDs.

Task responses include `id`, `applicationId`, `title`, `notes`, `dueOn`, `priority`,
`completedAt`, `createdAt`, and `updatedAt`. Unset notes, due dates, and completion timestamps
are `null`. Timestamps are UTC ISO strings; `dueOn` is a `YYYY-MM-DD` calendar date with no
timezone conversion. An open task has `completedAt: null`.

| Status | Code                    | Meaning                                             |
| ------ | ----------------------- | --------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`      | Params, query, or body do not match the schema      |
| `401`  | `AUTH_TOKEN_MISSING`    | Bearer token was not supplied                       |
| `404`  | `APPLICATION_NOT_FOUND` | Parent application is missing, hidden, or not owned |
| `404`  | `TASK_NOT_FOUND`        | Task is missing, deleted, or under another parent   |

### GET `/tasks`

Read-only cross-application list. Returns `200 OK` with `data: { tasks: [...] }` and
`meta: { page, pageSize, total, totalPages }`. Each task includes an
`application: { id, jobTitle }` summary. Filtering and sorting run before pagination, and
tasks under inaccessible applications or companies are omitted.

| Query           | Values and behavior                                           |
| --------------- | ------------------------------------------------------------- |
| `status`        | `open` or `completed`; omitted includes both                  |
| `priority`      | `low`, `medium`, or `high`                                    |
| `due`           | `overdue`, `today`, `upcoming`, or `undated`; open tasks only |
| `today`         | Caller-local `YYYY-MM-DD`; required for relative due filters  |
| `sortBy`        | `dueOn` (default), `priority`, `createdAt`, or `completedAt`  |
| `sortDirection` | `asc` (default) or `desc`                                     |
| `page`          | 1 to 10,000; default 1                                        |
| `pageSize`      | 1 to 100; default 20                                          |

Overdue means `dueOn < today`; today is equality, upcoming means `dueOn > today`, and
undated means `dueOn` is `null`. Completed tasks are excluded from all due filters.
Priority sorts by low, medium, high in ascending order. Nulls sort last and ID ascending
breaks ties. Text search is not supported.

### GET `/applications/:applicationId/tasks`

Returns `200 OK` with `data: { tasks: [...] }` for the selected application. This list is
not paginated and sorts by due date ascending, nulls last, then ID ascending.

### POST `/applications/:applicationId/tasks`

Returns `201 Created` with `data: { task: ... }`. New tasks are open.

```json
{
  "title": "Follow up with the recruiter",
  "notes": "Ask about next steps",
  "dueOn": "2026-12-03",
  "priority": "medium"
}
```

Title is required, trimmed, nonempty, and at most 160 characters. Notes are optional and
trimmed, with a 10,000-character limit; blank notes become `null`. Due dates are optional
and must be valid calendar dates when present. Priority defaults to `medium`.

### GET `/applications/:applicationId/tasks/:taskId`

Returns `200 OK` with `data: { task: ... }`.

### PATCH `/applications/:applicationId/tasks/:taskId`

Returns `200 OK` with `data: { task: ... }`. Accepts a nonempty subset of the create fields
and an optional boolean `completed`. Omitted fields are unchanged. Use `null` to clear
`dueOn` or `notes`. Unknown fields, parent IDs, and server-managed timestamps are rejected.

`{ "completed": true }` sets the server timestamp if the task was open and preserves it
on repeated completion. `{ "completed": false }` clears it and reopens the task.

### DELETE `/applications/:applicationId/tasks/:taskId`

Soft-deletes the task and returns `200 OK` with `data: { deleted: true }`. It is omitted
from both lists; subsequent item requests return `404 TASK_NOT_FOUND` if the parent is
still accessible. Soft-deleting the application or company hides its retained tasks.

## Dashboard

### GET `/dashboard`

Requires a bearer access token. Returns a read-only snapshot in the standard `200 OK` envelope.
All sections are scoped to non-deleted applications whose non-deleted company also belongs to the
caller. Deleted interviews and tasks are excluded.

Optional query parameter `today` is the caller's local calendar date in `YYYY-MM-DD` format.
It defaults to the server's current UTC date. The earliest supported date is `0001-06-01`,
so all six trend buckets have a positive calendar year. Invalid dates and unknown query
parameters return `400 VALIDATION_ERROR`. The server independently captures the current UTC
instant as `asOf`; the supplied date does not change which interviews are upcoming.

| Data field           | Contents                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| `today`, `asOf`      | Effective calendar date and server UTC ISO timestamp                      |
| `kpis`               | Five numeric totals defined below                                         |
| `statusDistribution` | `{ status, count }` for every supported current status, including zeros   |
| `submissionTrend`    | Six `{ month, count }` entries, oldest first, with `month` as `YYYY-MM`   |
| `upcomingInterviews` | Next five scheduled interviews, ordered by `scheduledAt` then ID          |
| `overdueTasks`       | Up to five overdue tasks, ordered by `dueOn` then ID                      |
| `upcomingTasks`      | Up to five tasks due today through six days after today, ordered likewise |
| `recentApplications` | Five visible applications ordered by `updatedAt` descending, then ID      |

KPI definitions:

- `activeApplications`: current statuses other than `accepted`, `rejected`, and `withdrawn`;
  includes drafts. The status distribution also includes the terminal statuses.
- `applicationsSubmittedThisMonth`: applications with `appliedAt` between the first day of
  the effective month and `today`, inclusive. Trends use the same date field across the current
  and preceding five months. Missing and future submission dates do not count.
- `upcomingInterviews`: interviews with status `scheduled` and `scheduledAt >= asOf`.
  This total is not limited to the five preview rows.
- `offersReceived`: distinct visible applications with a recorded `offer` status-history entry,
  including initial entries and applications whose current status is no longer `offer`.
  Offer events missing from history cannot be counted.
- `overdueTasks`: incomplete tasks with `dueOn < today`, without the preview cap.
  Completed or undated tasks are excluded from both task previews. Due today is not overdue.

Interview previews contain `id`, `type`, `scheduledAt`, `applicationId`, `jobTitle`, and
`companyName`. Task previews contain `id`, `title`, `dueOn`, `priority`, and the same parent
fields. Recent applications contain `id`, `jobTitle`, `companyName`, `status`, and `updatedAt`.
Timestamps are UTC ISO strings; task due dates remain `YYYY-MM-DD` without timezone conversion.
An account with no visible data gets zero totals, zero-filled charts, and empty previews.

## Resumes

### Compare a Resume Against an Application

`POST /api/v1/applications/:applicationId/resume-match` requires authentication and a JSON
body of `{ "resumeId": "<uuid>" }`. Both records must belong to the caller and be active;
the Application's Company must also be visible. Missing or inaccessible records return `404`.

Set `jobDescription` through Application creation or PATCH, and read it from the Application
response. It accepts up to 50,000 characters after trimming. Blank strings and `null` clear
it; omitting it from PATCH preserves the current value.

The response is `200` with `data.match`: `applicationId`, `resumeId`, `status`,
`matchedSkills`, `missingSkills`, `matchedCount`, `requiredCount`, and `coveragePercentage`.
Coverage is the rounded percentage of unique recognized description skills also found in the
stored Resume text. No recognized description skills yields `no_recognized_requirements` and
null coverage; no recognized Resume skills yields `no_recognized_resume_skills` and zero
coverage when requirements exist. Otherwise the status is `compared`.

A missing description returns `422 JOB_DESCRIPTION_REQUIRED`; missing extracted Resume
text returns `422 RESUME_TEXT_UNAVAILABLE`. The comparison does not return Resume text or
storage metadata. Recognized mentions are weighted equally; coverage is not an ATS score or
hiring prediction.

All routes require a bearer token. Metadata includes `id`, `title`, `originalFilename`,
`mimeType`, `fileSizeBytes`, `createdAt`, and `updatedAt`. Extracted text and storage keys
are private and omitted. Missing, deleted, and other users' resumes return
`404 RESUME_NOT_FOUND` on item routes.

| Method and path                   | Success                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `POST /resumes`                   | `201` with `data: { resume }`                                         |
| `GET /resumes`                    | `200` with `data: { resumes }`, newest first                          |
| `GET /resumes/:resumeId`          | `200` with `data: { resume }`                                         |
| `GET /resumes/:resumeId/download` | `200` with original file bytes as a private, non-cacheable attachment |
| `DELETE /resumes/:resumeId`       | `200` with `data: { deleted: true }`                                  |

Upload uses `multipart/form-data` with one `file` and a nonblank `title` (160 characters
max). PDF and DOCX require matching extensions, MIME types, and parseable content, with a
5 MiB file limit. Invalid multipart or fields return `400`, oversized files `413`, and
unsupported types `415`. Unreadable, encrypted, textless, or overly complex documents
return `422`. Extraction does not perform OCR. DELETE hides the record and download
without permanently purging the original bytes or extracted text.
