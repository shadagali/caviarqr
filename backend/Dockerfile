# syntax=docker/dockerfile:1

# =========================
# Build stage
# =========================
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build


# =========================
# Production dependencies
# =========================
FROM node:22-bookworm-slim AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force


# =========================
# Production runtime
# =========================
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4101

RUN groupadd --system --gid 1001 caviarqr \
    && useradd \
      --system \
      --uid 1001 \
      --gid caviarqr \
      --create-home \
      caviarqr

COPY --from=prod-deps \
     --chown=caviarqr:caviarqr \
     /app/node_modules \
     ./node_modules

COPY --from=build \
     --chown=caviarqr:caviarqr \
     /app/dist \
     ./dist

COPY --from=build \
     --chown=caviarqr:caviarqr \
     /app/package.json \
     ./package.json

# Production startup safety script
COPY docker-entrypoint-production.sh /usr/local/bin/caviarqr-entrypoint

# Fix Windows CRLF line endings if necessary
RUN sed -i 's/\r$//' /usr/local/bin/caviarqr-entrypoint \
    && chmod +x /usr/local/bin/caviarqr-entrypoint

# Uploaded restaurant assets must use persistent
# storage in production.
RUN mkdir -p /app/uploads \
    && chown -R caviarqr:caviarqr /app/uploads

USER caviarqr

EXPOSE 4101

ENTRYPOINT ["/usr/local/bin/caviarqr-entrypoint"]

CMD ["node", "dist/main.js"]