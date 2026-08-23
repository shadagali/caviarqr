# syntax=docker/dockerfile:1

# =========================
# Install dependencies
# =========================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# =========================
# Build Next.js
# =========================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL=https://api.caviarqr.com
ARG NEXT_PUBLIC_QR_BASE_URL=https://caviarqr.com
ARG NEXT_PUBLIC_STRIPE_KEY

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_QR_BASE_URL=${NEXT_PUBLIC_QR_BASE_URL}
ENV NEXT_PUBLIC_STRIPE_KEY=${NEXT_PUBLIC_STRIPE_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# -------------------------
# Production safety checks
# -------------------------

RUN test -n "$NEXT_PUBLIC_API_URL"
RUN test -n "$NEXT_PUBLIC_QR_BASE_URL"
RUN test -n "$NEXT_PUBLIC_STRIPE_KEY"

# Production frontend must use HTTPS API
RUN case "$NEXT_PUBLIC_API_URL" in \
      https://*) ;; \
      *) echo "ERROR: NEXT_PUBLIC_API_URL must use https://"; exit 1 ;; \
    esac

# Production QR base URL must use HTTPS
RUN case "$NEXT_PUBLIC_QR_BASE_URL" in \
      https://*) ;; \
      *) echo "ERROR: NEXT_PUBLIC_QR_BASE_URL must use https://"; exit 1 ;; \
    esac

# Prevent accidentally deploying Stripe test mode
RUN case "$NEXT_PUBLIC_STRIPE_KEY" in \
      pk_live_*) ;; \
      *) echo "ERROR: Production build requires a Stripe pk_live_ publishable key"; exit 1 ;; \
    esac

RUN npm run build


# =========================
# Production runtime
# =========================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 caviarqr \
    && useradd \
      --system \
      --uid 1001 \
      --gid caviarqr \
      --create-home \
      caviarqr

COPY --from=builder \
     --chown=caviarqr:caviarqr \
     /app \
     ./

RUN npm prune --omit=dev \
    && npm cache clean --force \
    && chown -R caviarqr:caviarqr /app

USER caviarqr

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]