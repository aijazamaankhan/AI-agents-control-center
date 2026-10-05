# Environment Variables

Copy `.env.example` → `.env` (never commit `.env*` files except the example).
Variables are validated at startup in `src/config/env.ts`.

| Variable                                                                                               | Required      | Phase | Description                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                             | yes           | 1     | `development` / `test` / `production`                                                                                              |
| `NEXT_PUBLIC_APP_URL`                                                                                  | yes           | 1     | Public base URL (used for links/origin checks)                                                                                     |
| `DATABASE_URL`                                                                                         | yes           | 1     | PostgreSQL connection string                                                                                                       |
| `TEST_DATABASE_URL`                                                                                    | tests         | 1     | Disposable DB for integration/E2E tests (**reset on every run**)                                                                   |
| `AUTH_SECRET`                                                                                          | Phase 2       | 2     | ≥32 chars; signing for invitation tokens (validated if set)                                                                        |
| `ENCRYPTION_KEY`                                                                                       | yes (Phase 3) | 3     | 32-byte key, base64, for AES-256-GCM credential encryption                                                                         |
| `REDIS_URL`                                                                                            | Phase 4       | 4     | Queues + distributed rate limiting                                                                                                 |
| `INTERNAL_API_SECRET`                                                                                  | Phase 4       | 4     | Auth for internal job endpoints                                                                                                    |
| `EMAIL_PROVIDER_API_KEY`                                                                               | for email     | 2.5   | [Resend](https://resend.com) API key. Without it, enquiries/demo requests are still saved in the `inquiries` table but not emailed |
| `EMAIL_FROM`                                                                                           | no            | 2.5   | Sender, e.g. `AgentOS <onboarding@resend.dev>` (Resend test sender) or an address on your verified domain                          |
| `INQUIRY_TO_EMAIL`                                                                                     | no            | 2.5   | Inbox for website enquiries and demo requests (default `velorexdesign@gmail.com`)                                                  |
| `ALLOW_PRIVATE_AGENT_ENDPOINTS`                                                                        | no            | 3     | `true` lets "Test connection" reach localhost/private IPs (local development only)                                                 |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | later         |       | Exports                                                                                                                            |
| `WEBHOOK_SIGNING_SECRET`                                                                               | Phase 4       | 4     | HMAC signing for outgoing/incoming webhooks                                                                                        |

Generate secrets with `openssl rand -base64 32`, or run `npm run setup`, which fills
`AUTH_SECRET` and `ENCRYPTION_KEY` automatically. The Docker image generates and persists
them in its `/data` volume when unset.

### Sending enquiry emails to velorexdesign@gmail.com

1. Create a free account at resend.com **with velorexdesign@gmail.com** (Resend's test
   sender can deliver to the account owner's address without a domain).
2. Create an API key → set `EMAIL_PROVIDER_API_KEY=re_…` in `.env`.
3. Leave `EMAIL_FROM` empty (uses `onboarding@resend.dev`) or verify your own domain.
4. Restart the app. Every request is also stored in the `inquiries` table
   (`npx prisma studio` to browse), including whether email delivery succeeded.
