#!/bin/sh
# Substitute CF_ACCESS_SECRET into nginx config
export CF_ACCESS_SECRET="${CF_ACCESS_SECRET:-}"
envsubst '${CF_ACCESS_SECRET}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
