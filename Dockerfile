# One image: the API serves the built web app (WEB_DIST_DIR). The build stage needs the whole
# workspace; the final stage holds only the bundle, the migrations and the web build.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/apps/web/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
