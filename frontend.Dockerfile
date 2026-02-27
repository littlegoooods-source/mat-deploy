# Stage 1: Build React app
FROM node:20-alpine AS build

RUN apk add --no-cache git

WORKDIR /app
RUN git clone https://github.com/littlegoooods-source/mat-frontend.git .

# Replace hardcoded Render.com URL with relative /api path for nginx proxy
RUN sed -i "s|https://mat-backend-r9iw.onrender.com/api|/api|g" src/services/api.js

RUN npm ci
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
