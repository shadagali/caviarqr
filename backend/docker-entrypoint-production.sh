#!/bin/sh
set -eu

echo "Starting CaviarQR production safety checks..."

if [ "${NODE_ENV:-}" != "production" ]; then
  echo "ERROR: NODE_ENV must be production"
  exit 1
fi

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  echo "ERROR: STRIPE_SECRET_KEY is missing"
  exit 1
fi

case "$STRIPE_SECRET_KEY" in
  sk_live_*)
    ;;
  *)
    echo "ERROR: Production requires a Stripe sk_live_ secret key"
    exit 1
    ;;
esac

if [ -z "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  echo "ERROR: STRIPE_WEBHOOK_SECRET is missing"
  exit 1
fi

case "$STRIPE_WEBHOOK_SECRET" in
  whsec_*)
    ;;
  *)
    echo "ERROR: STRIPE_WEBHOOK_SECRET must be a whsec_ webhook signing secret"
    exit 1
    ;;
esac

if [ -z "${FRONTEND_URL:-}" ]; then
  echo "ERROR: FRONTEND_URL is missing"
  exit 1
fi

case "$FRONTEND_URL" in
  https://*)
    ;;
  *)
    echo "ERROR: Production FRONTEND_URL must use https://"
    exit 1
    ;;
esac

for var in DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_NAME; do
  eval "value=\${$var:-}"

  if [ -z "$value" ]; then
    echo "ERROR: $var is missing"
    exit 1
  fi
done

case "$DB_PORT" in
  *[!0-9]*|"")
    echo "ERROR: DB_PORT must be a positive integer"
    exit 1
    ;;
esac

if [ "$DB_PORT" -lt 1 ]; then
  echo "ERROR: DB_PORT must be a positive integer"
  exit 1
fi

case "${DB_SSL:-false}" in
  true|false)
    ;;
  *)
    echo "ERROR: DB_SSL must be true or false"
    exit 1
    ;;
esac

case "$DB_HOST" in
  localhost|127.0.0.1|::1)
    echo "ERROR: Production DB_HOST cannot point to localhost"
    exit 1
    ;;
esac

echo "CaviarQR production safety checks passed."

exec "$@"