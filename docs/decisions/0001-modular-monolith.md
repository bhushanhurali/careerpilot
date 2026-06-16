# 0001: Use A Modular Monolith

## Decision

CareerPilot will start as a modular monolith.

## Why

The application is a single product with one database and one team. A modular monolith keeps deployment simple while still allowing clean feature boundaries.

## Alternatives

- Microservices: more operational complexity without a current scaling need.
- Serverless functions: useful for specific workloads, but less direct for learning backend architecture.
