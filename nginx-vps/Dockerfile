FROM nginx:alpine

# Install gettext for envsubst and curl for healthchecks
RUN apk add --no-cache gettext curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create directory for SSL certificates
RUN mkdir -p /etc/nginx/ssl

# Copy template, security headers and startup script
COPY default.conf.template /tmp/default.conf.template
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Environment variables with defaults
ENV DOMAIN_NAME=localhost
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8080
ENV FRONTEND_HOST=frontend
ENV FRONTEND_PORT=8081

# Note: You MUST provide SSL certificates in /etc/nginx/ssl/ (default)
# or specify custom paths via SSL_CERT_PATH and SSL_KEY_PATH.
# These can be provided by mounting a volume or copying them in a custom build step.

# Docker healthcheck (checks port 80 /health)
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD curl -f http://localhost/health || exit 1

CMD ["/start.sh"]
