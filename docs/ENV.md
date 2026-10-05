# Environment Variables

Copy `.env.example` → `.env` (never commit `.env*` files except the example).
Variables are validated at startup in `src/config/env.ts`.

| Variable                                                                                               | Required      | Phase | Description                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------- | ----- | ---------------------------------------------------------------- |
| `NODE_ENV`                                                                                             | yes           | 1     | `development` / `test` / `production`                            |
| `NEXT_PUBLIC_APP_URL`                                                                                  | yes           | 1     | Public base URL (used for links/origin checks)                   |
| `DATABASE_URL`                                                                                         | yes           | 1     | PostgreSQL connection string                                     |
| `TEST_DATABASE_URL`                                                                                    | tests         | 1     | Disposable DB for integration/E2E tests (**reset on every run**) |
| `AUTH_SECRET`                                                                                          | Phase 2       | 2     | ≥32 chars; signing for invitation tokens (validated if set)      |
| `ENCRYPTION_KEY`                                                                                       | yes (Phase 3) | 3     | 32-byte key, base64, for AES-256-GCM credential encryption       |
| `REDIS_URL`                                                                                            | Phase 4       | 4     | Queues + distributed rate limiting                               |
| `INTERNAL_API_SECRET`                                                                                  | Phase 4       | 4     | Auth for internal job endpoints                                  |
| `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM`                                                                | Phase 2/9     |       | Invitations, alerts                                              |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | later         |       | Exports                                                          |
| `WEBHOOK_SIGNING_SECRET`                                                                               | Phase 4       | 4     | HMAC signing for outgoing/incoming webhooks                      |

Generate secrets with `openssl rand -base64 32`.
