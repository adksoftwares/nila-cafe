# Build Stage (Node 22 LTS)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Web Server Stage (Nginx Alpine)
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Clean default nginx files and copy compiled static assets
RUN rm -rf ./*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Production Health Check Probe
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
