# Storedeck — build the TanStack Start site (prerendered pages + client-only
# editor) and serve the static output with nginx.

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
LABEL maintainer="Storedeck"
LABEL description="Store screenshot editor for App Store, Google Play, desktop and TV stores"
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
