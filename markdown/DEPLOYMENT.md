# WireCraft Production Deployment Guide

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

This guide details best practices for deploying **WireCraft** across enterprise hosting environments, container runtimes (Docker, Kubernetes), serverless containers (Google Cloud Run, AWS App Runner), and standard Linux virtual machines.

---

## 1. Production Architecture Overview

In production, WireCraft operates as a self-contained full-stack Node.js service:
- **Frontend SPA**: React 19 application compiled into static, minified bundles (`dist/index.html`, `dist/assets/*`).
- **Backend API Server**: Node.js 22 service running `server.ts` via `tsx` or transpiled JavaScript, exposing `/api/ai/*` endpoints and serving the frontend bundle.

```
[ Internet / Clients ]
         │ HTTPS :443
         ▼
[ Reverse Proxy (Nginx / Cloudflare / Cloud Load Balancer) ]
         │ HTTP :3000
         ▼
[ Docker Container / Node.js 22 Process ]
   ├── Express HTTP Server (:3000)
   ├── Static File Middleware (serves /dist)
   ├── Health Check Endpoint (/api/health)
   └── Rate-Limited AI Endpoints (/api/ai/*)
```

---

## 2. Environment Variables Reference

Configure environment variables in your deployment pipeline or `.env` file:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3000` | Port on which the HTTP server listens. |
| `NODE_ENV` | Recommended | `production` | Enables production optimizations in Express and dependencies. |
| `GEMINI_API_KEY` | Optional | `None` | Google AI Studio API key for TAC Co-Pilot, diagnostics, and diagram synthesis. Core simulator operates fully offline if omitted. |
| `GEMINI_TEXT_MODELS` | Optional | `gemini-3.8-flash,gemini-2.5-flash` | Comma-separated list of Gemini model aliases to query in priority order. |

---

## 3. Standard Local / VM Deployment

### Step 1: Install Node.js 22+
Ensure Node.js 22.x LTS is installed on your host machine:

```bash
node -v   # Must be >= 22.0.0
```

### Step 2: Build the Application
```bash
# Install dependencies
npm ci --omit=dev  # or npm install

# Build the production bundle
npm run build
```

### Step 3: Run with Process Manager (PM2 / Systemd)
We recommend using **PM2** to manage restarts, clustering, and log rotation:

```bash
# Install PM2 globally
npm install -g pm2

# Start the WireCraft server
pm2 start server.ts --name wirecraft --interpreter ./node_modules/.bin/tsx --env PORT=3000

# Save process list for system reboot
pm2 save
pm2 startup
```

---

## 4. Containerized Deployment (Docker)

### Multi-Stage Dockerfile
Use this hardened, multi-stage `Dockerfile` to create a minimal, non-root production container image (~150MB):

```dockerfile
# ----------------------------------------------------------------------
# Stage 1: Build Frontend Assets
# ----------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ----------------------------------------------------------------------
# Stage 2: Production Runtime
# ----------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Run as unprivileged node user
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/server.ts ./server.ts
COPY --chown=node:node --from=builder /app/src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "server.ts"]
```

### Building & Running the Container
```bash
# Build the image
docker build -t wirecraft:latest .

# Run container with environment file
docker run -d \
  --name wirecraft-app \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  wirecraft:latest
```

---

## 5. Google Cloud Run Deployment

WireCraft is optimized for container execution on **Google Cloud Run**:

```bash
# 1. Build and submit container image to Google Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/wirecraft:latest

# 2. Deploy to Cloud Run
gcloud run deploy wirecraft \
  --image gcr.io/YOUR_PROJECT_ID/wirecraft:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars GEMINI_TEXT_MODELS="gemini-3.8-flash,gemini-2.5-flash" \
  --set-secrets GEMINI_API_KEY=wirecraft-gemini-key:latest
```

---

## 6. Nginx Reverse Proxy Configuration

When deploying behind an Nginx reverse proxy, use the following production server block:

```nginx
server {
    listen 80;
    server_name wirecraft.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wirecraft.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/wirecraft.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wirecraft.yourdomain.com/privkey.pem;

    # Modern TLS cipher suites
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Static Asset Caching
    location /assets/ {
        proxy_pass http://127.0.0.1:3000/assets/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Proxy root and API traffic
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for streaming AI responses
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
```

---

## 7. Healthchecks & Monitoring

The backend exposes a healthcheck endpoint at `/api/health`:

```bash
curl -i http://localhost:3000/api/health
```

**Response Format**:
```json
{
  "ok": true,
  "ai": true
}
```

- `ok`: Indicates the Express process is active and accepting requests.
- `ai`: Boolean flag indicating whether `GEMINI_API_KEY` is present and initialized.
