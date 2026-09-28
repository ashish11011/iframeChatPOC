FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client ./client
COPY vite.config.js ./
RUN npm run build
RUN npm prune --omit=dev
FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
