FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# Dev server is intentional for the assignment demo (HMR via nginx :8080).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
