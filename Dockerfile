# One image: the API serves the built web app (WEB_DIST_DIR). The build stage needs the whole
# workspace; the final stage holds only the bundle, the migrations and the web build.
FROM node:26.11.1-slim@sha256:193fe51b64e77981119c98c2002c9e32a70e2f006fb4d25068ce0558998917f0 AS build
WORKDIR /app
RUN corepack enable
# The slim image has no root certificates, so the upload of the source maps could not reach Sentry (TLS).
# This stage is not part of the final image, so the package lists need no cleanup.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates
# The commit names the build in Sentry. The DSN of the browser is not a secret (everyone who opens the
# page can read it), so it is a build value; the DSN of the server is read from server.env at run time.
ARG GIT_SHA=unknown
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_RELEASE=$GIT_SHA
COPY . .
# The token for the upload of source maps is a build secret: it is neither in the image nor in a layer.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    pnpm install --frozen-lockfile && pnpm build

FROM node:26.11.1-slim@sha256:193fe51b64e77981119c98c2002c9e32a70e2f006fb4d25068ce0558998917f0
WORKDIR /app
ARG GIT_SHA=unknown
ENV NODE_ENV=production
ENV SENTRY_RELEASE=$GIT_SHA
ENV WEB_DIST_DIR=/app/apps/web/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
