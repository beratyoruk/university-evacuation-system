FROM node:18-alpine

WORKDIR /app

# Install ALL deps (incl. devDependencies like typescript / ts-jest) so the
# build stage has tsc available. We prune back to production deps after build.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop devDependencies to shrink the runtime image
RUN npm prune --production

RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
