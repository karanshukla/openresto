FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY default.conf.template /tmp/default.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Defaults for local docker-compose
ENV PORT=80
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8080
ENV FRONTEND_HOST=frontend
ENV FRONTEND_PORT=8081

CMD ["/start.sh"]
