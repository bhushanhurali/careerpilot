# ADR 0012: Private Resume Storage and Deterministic Matching

## Status

Accepted

## Decision

- Store original PDF/DOCX bytes in private storage behind `ResumeStorage`; keep metadata and
  extracted text in PostgreSQL. Resumes belong directly to users and can be reused across
  applications without storing a link.
- Extract text on upload without OCR. Compare unique recognized skills on demand using a
  curated alias vocabulary. Coverage is the rounded matched-to-required ratio, not a ranking
  of candidates or a prediction.
- Revoke access on soft deletion, clear extracted text, and retry removal of the private
  original file using persisted cleanup state. Retained backups expire separately.

## Consequences

- A database transaction cannot roll back a filesystem write. Upload failure cleanup is
  best-effort, and operators must coordinate database and volume backups.
- Local storage suits the current single-backend setup. Production must configure a persistent
  private mount; cloud storage and general upload-orphan reconciliation are not implemented.
- Vocabulary changes may change results for the same inputs. Matching is reproducible for a
  given version, but misses unrecognized skills and does not interpret context.
