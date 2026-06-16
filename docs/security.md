# Security Baseline

Phase 0 adds only baseline security infrastructure.

## Decisions

- Use `helmet` for common HTTP security headers.
- Configure CORS explicitly through environment variables.
- Limit JSON request bodies to 1 MB by default.
- Redact authorization and cookie headers from logs.
- Keep secrets out of source control and commit only `.env.example`.

## Later Phases

- Phase 1 adds authentication security.
- Phase 8 adds file upload validation.
- Phase 9 adds rate limiting, audit logging, and production hardening.
