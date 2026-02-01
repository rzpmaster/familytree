# Build stage
FROM node:24-alpine as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Nginx alpine image's default entrypoint automatically runs envsubst on files in /etc/nginx/templates/
# and outputs them to /etc/nginx/conf.d/
# So we don't need a custom entrypoint script!

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
