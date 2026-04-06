# Deployment Guide

## Requirements

The engine has specific runtime requirements that affect hosting choices:

| Requirement | Why |
|-------------|-----|
| **Persistent filesystem** | All artifacts (JSON, DOCX, PDF) are read from and written to local directories (`uploads/`, `output/`, `reports/`). Serverless platforms with ephemeral filesystems will lose data between invocations. |
| **Chromium binary** | Puppeteer requires a Chromium installation for PDF generation. Puppeteer downloads one during `npm install`, but serverless environments may need `@sparticuz/chromium` or a Lambda layer. |
| **Long-running requests** | Pipeline stages (especially segmentation) can take 30–120+ seconds per transcript. Platforms with short request timeouts (e.g. Vercel's 10s hobby limit) will fail. |
| **Node.js >= 18** | Required by Next.js 16. |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |

Set this in the host's environment configuration. No other environment variables are required.

## Recommended Hosting

| Platform | Suitability | Notes |
|----------|-------------|-------|
| **VPS** (DigitalOcean, Linode, Hetzner) | Best | Full control over filesystem, Chromium, and request timeouts |
| **Docker container** | Best | Package Chromium in the image, mount volumes for data directories |
| **AWS EC2 / GCP Compute** | Good | Persistent disk, configurable timeouts |
| **Railway / Render** | Good | Persistent disk options, configurable timeouts, managed Node.js |
| **Vercel** | Poor | Ephemeral filesystem, 10s/60s timeout limits, Puppeteer complications |
| **AWS Lambda** | Poor | Ephemeral filesystem, 15-minute max timeout, Chromium packaging needed |

## Docker Deployment

No Dockerfile is included in the repository. Here is a reference configuration:

```dockerfile
FROM node:20-slim

# Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t uts-engine .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your_key_here \
  -v ./uploads:/app/uploads \
  -v ./output:/app/output \
  -v ./reports:/app/reports \
  uts-engine
```

Mount `uploads/`, `output/`, and `reports/` as volumes to persist data across container restarts.

## Production Build

```bash
npm run build
npm start
```

The production server runs on port 3000 by default. Use the `PORT` environment variable to change it.

## Security Considerations

### No Authentication

The application has **no built-in authentication**. All API routes are publicly accessible. Before exposing to the internet:

- Add authentication middleware (NextAuth, Clerk, or a custom solution)
- Or place the app behind a reverse proxy with auth (nginx + OAuth2 Proxy, Cloudflare Access, etc.)
- Or restrict network access to trusted IPs

### API Key Protection

The `GEMINI_API_KEY` is only used server-side and never exposed to the client. Ensure:

- The key is set via environment variables, not hardcoded
- `.env*` files are in `.gitignore` (they already are)
- The key has appropriate quota limits set in Google Cloud Console

### Filesystem Access

API routes accept user-configurable directory paths (`uploadDir`, `outputDir`). In a production environment, consider:

- Validating and sanitizing directory paths
- Restricting access to a specific base directory
- Running the process with minimal filesystem permissions

## Monitoring

The application logs Gemini API interactions to the console:

- Rate limit retries with wait times
- Server error retries with backoff
- Connection reset warnings (common with large documents)
- Moment counts and filtering statistics

Redirect `stdout`/`stderr` to your logging infrastructure (e.g. Docker log driver, systemd journal, CloudWatch).

## Scaling Considerations

- **Single-instance design** — The filesystem-backed architecture assumes a single server instance. Horizontal scaling requires shared storage (NFS, S3 + adapter, etc.).
- **Gemini rate limits** — The retry logic handles 429 responses with 10-second waits, but high concurrency may exhaust API quotas. Configure Gemini API quotas in Google Cloud Console.
- **Memory** — Puppeteer launches a full Chromium instance for each PDF render. Allow at least 1 GB of memory headroom for PDF generation.
- **Disk** — Each transcript produces JSON artifacts (typically 100 KB–1 MB per file). Reports add DOCX and PDF files. Plan storage accordingly for large corpus sizes.
