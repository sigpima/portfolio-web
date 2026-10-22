# portfolio-web

**EN:** Bilingual (Vietnamese / English) portfolio website built with Next.js 16 (`output: "standalone"`).
Projects are registry-driven (`src/content`). The Knowledge Base and Twistfit demos run live only for visitors who opened an
invite link (`/i/<token>`) with that feature enabled; everyone else sees a replay (recorded runs, or placeholder samples for Twistfit). The server-side routes talk to the
internal `portfolio-api` service (invite links, sessions, per-link usage log, admin at `/admin`), which is the only
thing that calls the chat bot and Flux. The Gia pha demo is a simulation and is labelled as such.

**VI:** Website portfolio song ngữ (Việt / Anh) dựng bằng Next.js 16. Nội dung dự án lấy từ `src/content`.
Demo Knowledge Base và Twistfit chỉ chạy thật với người đã mở link mời (`/i/<mã>`) có bật tính năng đó; người khác xem bản phát lại (các lần chạy đã ghi, hoặc mẫu giữ chỗ với Twistfit).
Các route phía máy chủ gọi dịch vụ nội bộ `portfolio-api` (link mời, phiên, nhật ký theo link, trang quản trị `/admin`);
chỉ `portfolio-api` gọi bot chat và Flux. Demo Gia phả (mô phỏng) được gắn nhãn đúng bản chất.

## Environment / Biến môi trường

Put them in a `.env` file next to `docker-compose.yml` (`cp .env.example .env && chmod 600 .env`; it is git-ignored, never commit it).
Every compose command (`up`, `logs`, `exec`, `cp`, `stop`, `down`) needs `PORTFOLIO_API_KEY`, so keep it in `.env` rather than on the command line.

| Variable | Required | Meaning |
| --- | --- | --- |
| `PORTFOLIO_API_KEY` | yes | Shared internal key with `portfolio-api`; the SAME value in both services, >= 32 visible ASCII chars. A shorter or non-ASCII key makes every call to `portfolio-api` fail closed (invite links show "try again later", `/admin` is unavailable). |
| `SITE_URL` | yes in production | Public origin, needed at build time AND runtime (canonical URLs, invite redirects, links shown on `/admin`). |
| `PORTFOLIO_API_URL` | no | Default `http://portfolio-api:8100`. |
| `PORTFOLIO_API_NETWORK` | no (compose) | Fallback only, when `docker network ls` shows the `portfolio-api` network under a name other than `portfolio-api_default` (see `docs/RUNBOOK.md`, section 3). |
| `PORTFOLIO_PORT` | no (compose) | Host port on 127.0.0.1, default `3100`. |

Both `PORTFOLIO_API_KEY` and `SITE_URL` must be set to **real values**: `.env.example` ships both as `CHANGE_ME`, which is
deliberately invalid (the production build fails on `SITE_URL=CHANGE_ME`, and the web refuses to call `portfolio-api` with
`PORTFOLIO_API_KEY=CHANGE_ME`).

Start order: knowledge_base `chat` -> `portfolio-api` -> this web app. The web container joins only the
`portfolio-api` network and cannot reach `chat:8003` directly.

## Commands

```bash
npm install
npm run dev     # dev server at http://localhost:3000
npm test        # unit tests (vitest)
npm run build   # production build (needs internet: next/font downloads Google fonts)
```

Production build and deployment (Docker, nginx, backend, env vars such as `SITE_URL`): see
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) (in Vietnamese).

## For contributors and AI agents

This project uses a Next.js version with breaking changes compared with older releases. Read `AGENTS.md`
(and the guides in `node_modules/next/dist/docs/` it points to) before changing framework-level code.
