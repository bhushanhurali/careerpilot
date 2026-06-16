# 0004: Use A Standard API Response Envelope

## Decision

CareerPilot API responses will use a standard envelope for application endpoints.

## Why

One response shape simplifies Angular API handling, error display, and tests.

## Alternatives

- Raw REST resources: simpler and very common, but frontend error handling becomes more varied.
- JSON:API: standardized and powerful, but too heavy for this project phase.
