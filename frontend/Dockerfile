FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# Pre-compress at build time (once, at max level) instead of nginx gzip'ing the
# same immutable, content-hashed files on every request. gzip_static in
# nginx.conf serves these .gz siblings directly when present.
RUN apk add --no-cache gzip && \
    find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' -o -name '*.html' \) \
      -exec gzip -9 -k -f {} \;

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
