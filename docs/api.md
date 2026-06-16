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
