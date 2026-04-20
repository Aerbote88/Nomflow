# NômFlow frontend

Next.js 16 + React 19 + Tailwind v4. See the [root README](../README.md) for project overview, setup, and deployment.

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

The frontend expects the backend at `http://127.0.0.1:8000` by default (configurable via `BACKEND_URL`). Routes are proxied through `next.config.ts`.
