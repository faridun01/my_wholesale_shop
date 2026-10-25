FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx --no-install prisma generate --schema=prisma/schema.prisma
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# The uploads volume needs write access; application code and dependencies are read-only.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
