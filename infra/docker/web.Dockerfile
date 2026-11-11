FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/dist /usr/share/nginx/html
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
