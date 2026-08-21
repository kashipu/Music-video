FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# No VITE_API_URL needed — nginx proxies /api and /ws to backend
RUN npm run build

FROM nginx:alpine

# CAPACITY.md Techo 1: el default (1024 × 2 workers) da ~1000 usuarios efectivos
# porque cada WebSocket proxeado consume 2 conexiones (cliente + upstream).
RUN sed -i 's/worker_connections  1024/worker_connections  8192/' /etc/nginx/nginx.conf \
    && grep -q 'worker_connections  8192' /etc/nginx/nginx.conf

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
