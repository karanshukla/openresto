FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy template and startup script
COPY default.conf.template /tmp/default.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

# These are defaults for local development
# Railway will override these via environment variables
ENV PORT=80
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8080
ENV FRONTEND_HOST=frontend
ENV FRONTEND_PORT=8081

# Railway healthcheck requirement
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["/start.sh"]
