# Security

## Safety posture

The system is private and single-administrator, but every server boundary still requires authentication and authorization. Hiding UI controls is never authorization.

## Secrets

- Keep credentials only in the runtime secret manager or an ignored local `.env` file.
- Commit only the root `.env.example` with fictitious placeholders.
- Never log environment values, authorization headers, destinations, message bodies, cookies, or database URLs.
- Rotate a credential immediately if it enters source control, logs, screenshots, or chat.
- Stored integration credentials use AES-256-GCM with server-only `APP_ENCRYPTION_KEY`. An empty edit field preserves the previous ciphertext, and browser responses expose only whether configuration exists.
- WhatsApp session data lives under ignored `WHATSAPP_SESSION_DIR`. Only the exact `WHATSAPP_ALLOWED_GROUP_ID` ending in `@g.us` is accepted; contacts and unregistered groups are rejected.

## Live-delivery interlock

Mock delivery is the default. Live adapters require both:

```text
SEND_LIVE=true
MOCK_PROVIDERS=false
```

Missing, malformed, or different values must select mock behavior or fail closed. Automated tests must force mock mode and block outbound network access.

## Input and output handling

- Validate user input in the browser for usability and again on the server for security.
- Normalize URLs and reject unsupported protocols.
- Validate file type by content, enforce size limits, and store uploads outside executable paths.
- Escape content according to each provider's formatting mode.
- Queue clearing changes only pending items to a terminal state and never deletes delivery history.
- The exact message and media URL used for each attempt are stored on `Delivery`; publications with successful deliveries become immutable.
- Global pause and queue pause are checked before claiming work and again between channel deliveries.
- Return stable error codes and safe Portuguese messages; keep internal causes redacted.
- URL imports allow only HTTP(S), validate every redirect, block local/private addresses and cap time, redirects and response size. DNS rebinding remains a residual risk until outbound traffic is forced through a network proxy that blocks private ranges after connection.
- The Shopee API adapter accepts only the official HTTPS GraphQL host. Its application secret is used solely to sign requests on the server; credentials, signatures and authorization headers are never logged or returned to the browser. Provider failures are converted into stable, sanitized error codes.
- Uploads are checked by byte signature and decoded with Sharp before being converted to owned WebP files. Production must replace ephemeral local disk with private durable object storage and signed delivery URLs.
- React escaping and a restrictive CSP reduce XSS exposure. Templates are interpreted by a fixed variable/conditional renderer and never evaluated as code.
- State-changing routes verify same-origin requests. Production requests without a valid `Origin` are rejected; HTTP-only `SameSite=Lax` session cookies add a second CSRF boundary.

## Authentication

- Only normalized `ADMIN_EMAIL` may log in; public registration and recovery do not exist.
- Passwords use Node.js `scrypt` with a random 16-byte salt and timing-safe comparison. The administrator script reads the initial password from a hidden terminal prompt or a transient environment variable.
- Sessions use random opaque tokens; only SHA-256 hashes are persisted. Cookies are HTTP-only, `Secure` in production and `SameSite=Lax`.
- Login responses are intentionally generic. Database-backed throttling limits attempts, though production should also enforce an edge/IP rate limit because forwarded-IP trust and highly concurrent attempts are deployment concerns.
- Every private page and API handler performs server-side session/role validation; UI visibility is not authorization.

## Health and worker protection

- Web and worker health endpoints require distinct high-entropy bearer tokens and fail closed when a token is absent.
- Keep the worker health listener private; expose it only through an authenticated monitor or private network.
- `DEMO_MODE=true`, `SEND_LIVE=false` and `MOCK_PROVIDERS=true` guarantee mock routing. Never treat a configured provider token as authorization to send.

## Data protection

- Minimize stored recipient identifiers and avoid personal message contents in logs.
- Encrypt transport with TLS and use encrypted managed storage.
- Back up PostgreSQL before migrations and test restoration regularly.
- Use least-privilege database and provider credentials.

## Queue and provider risks

- A unique idempotency key is mandatory for every publication.
- Job claiming must be atomic to prevent duplicate delivery.
- Retries must be bounded and must reuse the same idempotency key.
- Apply per-provider rate limits, timeouts, and circuit breakers.
- Store a redacted provider response; never persist tokens or authorization headers.

## Incident response

Set `SEND_LIVE=false`, stop the worker, preserve logs, identify affected idempotency keys, rotate exposed credentials, and reconcile provider delivery history before resuming.
