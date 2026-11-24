FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=3100 ATTACHMENT_DIR=/data/attachments
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /data/attachments && chown -R node:node /data /app
USER node
EXPOSE 3100
VOLUME ["/data/attachments"]
CMD ["node", "dist/apps/api/src/server.js"]

FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
COPY deploy/compose/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
USER nginx
