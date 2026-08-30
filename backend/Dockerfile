FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx --no-install prisma generate --schema=prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Run as the non-root `node` user baked into the base image, not root. The uploads
# dir is created and chowned here so it keeps the right ownership once Docker
# initializes the named volume mounted over it from this directory's contents.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
