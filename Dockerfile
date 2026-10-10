FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global pnpm@11.25.0 && pnpm install --prod --frozen-lockfile
COPY dist ./dist
COPY server ./server
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
