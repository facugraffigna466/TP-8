#!/bin/sh

set -e

DEFAULT_API_URL="http://localhost:3001"
API_URL="${API_URL:-$DEFAULT_API_URL}"

TEMPLATE_PATH="/usr/share/nginx/html/config.js"

if [ -f "$TEMPLATE_PATH" ]; then
  envsubst '${API_URL}' < "$TEMPLATE_PATH" > /tmp/config.js
  mv /tmp/config.js "$TEMPLATE_PATH"
fi

exec nginx -g 'daemon off;'

