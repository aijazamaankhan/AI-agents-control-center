# AgentOS — production image (used by docker-compose.yml)
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Optional: `--secret id=ca,src=corp-ca.pem` for networks behind a TLS-inspecting proxy.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm ci

COPY . .
# Build needs a syntactically valid URL only; no connection is made at build time.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
