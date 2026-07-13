FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV SDOCS_ENABLE_STATEFUL_APIS=0
ENV SDOCS_REPO_URL=https://github.com/danybgoode/smalldocs

CMD ["node", "server.js"]
