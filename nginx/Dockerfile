FROM nginx:alpine

# Install gettext for envsubst and curl for healthchecks
RUN apk add --no-cache gettext curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy template, security headers and startup script
COPY default.conf.template /tmp/default.conf.template
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# These are defaults for local development
ENV PORT=80
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8080
ENV FRONTEND_HOST=frontend
ENV FRONTEND_PORT=8081

# Docker/Railway healthcheck
# Uses curl (now installed) and respects the dynamic PORT
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["/start.sh"]
