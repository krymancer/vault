FROM oven/bun:latest AS build

WORKDIR /src
COPY dashboard/package.json dashboard/bun.lock* ./
RUN bun install --frozen-lockfile

COPY dashboard/ .
RUN bun run build

FROM nginx:alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
