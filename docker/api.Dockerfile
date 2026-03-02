FROM node:20-alpine AS build

WORKDIR /app

COPY apps/api/package*.json ./apps/api/
RUN npm --prefix apps/api ci

COPY apps/api ./apps/api
COPY src/data ./src/data

RUN npm --prefix apps/api run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/api/package*.json ./apps/api/
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
COPY --from=build /app/apps/api/seeds ./apps/api/seeds
COPY --from=build /app/src/data ./src/data

EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
