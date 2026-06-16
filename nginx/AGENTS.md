# Nginx DOX

## Purpose

`nginx/` owns reverse-proxy configuration for routing public traffic to the frontend and backend services.

## Ownership

- `nginx.conf` owns proxy routing, headers, and TLS/server behavior.
- `certs/` is expected to contain runtime certificate material mounted into the container.

## Local Contracts

- Do not commit private keys or real production certificates.
- Keep upstream service names aligned with `docker-compose.yml`.
- Preserve WebSocket/proxy headers when changing API or frontend routing.

## Work Guidance

- Inspect `docker-compose.yml` before changing upstream names, ports, or mounted paths.
- Prefer minimal proxy changes and document any deployment assumptions in root docs if they become durable.

## Verification

- Validate syntax with `nginx -t` in an nginx container or by running the compose stack when proxy behavior changes.

## Child DOX Index

This nginx area is not split into deeper DOX children.
