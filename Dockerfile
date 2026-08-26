FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip unzip tar && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile --filter materialgenerate-server...

COPY server/tsconfig.json server/tsconfig.json
COPY server/requirements.txt server/requirements.txt
COPY server/src server/src
COPY assets assets
RUN pip3 install --no-cache-dir --break-system-packages -r server/requirements.txt
RUN pnpm --dir server build

ENV NODE_ENV=production
EXPOSE 8787
CMD ["pnpm", "--dir", "server", "start"]
