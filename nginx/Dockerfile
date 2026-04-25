FROM nginx:alpine

RUN apk add --no-cache gettext

RUN rm /etc/nginx/conf.d/default.conf
COPY default.conf.template /tmp/default.conf.template

# Defaults for local docker-compose
ENV PORT=80
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8080
ENV FRONTEND_HOST=frontend
ENV FRONTEND_PORT=8081

# Substitute, print config for debugging, check syntax, then start
CMD ["sh", "-c", "envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${FRONTEND_HOST} ${FRONTEND_PORT}' < /tmp/default.conf.template > /etc/nginx/conf.d/default.conf && echo '--- GENERATED NGINX CONFIG ---' && cat /etc/nginx/conf.d/default.conf && echo '--- END CONFIG ---' && nginx -t && exec nginx -g 'daemon off;'"]
