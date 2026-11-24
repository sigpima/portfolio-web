# portfolio-web

**EN:** Bilingual (Vietnamese / English) portfolio website built with Next.js 16 (`output: "standalone"`).
Projects are registry-driven (`src/content`). The Knowledge Base demo (quotation figures from Postgres, and policy questions answered with RAG over Milvus, citations shown as chips) runs live only for visitors who opened an
invite link (`/i/<token>`) with that feature enabled; everyone else sees a replay. Twistfit and Gia pha currently show "demo coming soon" and link to their real websites (`website`, `demoSoon` in `src/content/projects`); their demo code is kept dormant. Replays are labelled placeholder samples until real runs are recorded (none are yet). The server-side routes talk to the
internal `portfolio-api` service (invite links, sessions, per-link usage log, admin at `/admin`), which is the only
thing that calls the chat bot and Flux.

**VI:** Website portfolio song ngữ (Việt / Anh) dựng bằng Next.js 16. Nội dung dự án lấy từ `src/content`.
Demo Knowledge Base chỉ chạy thật với người đã mở link mời (`/i/<mã>`) có bật tính năng đó; người khác xem bản phát lại. Twistfit và Gia phả hiện ghi "Demo sắp có" và dẫn tới website thật (`website`, `demoSoon` trong `src/content/projects`); code demo của hai dự án này được giữ nguyên nhưng không hiển thị. Bản phát lại là mẫu giữ chỗ (có nhãn) cho tới khi ghi được lần chạy thật (hiện chưa có lần nào).
Các route phía máy chủ gọi dịch vụ nội bộ `portfolio-api` (link mời, phiên, nhật ký theo link, trang quản trị `/admin`);
chỉ `portfolio-api` gọi bot chat và Flux.

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

**Twistfit live / Twistfit chạy thật:** each live run calls Flux (paid) from `portfolio-api` for invited visitors only; setup (Flux key, catalog images,
a first real run, cost check), the `TWISTFIT_LIVE_ENABLED` kill switch and the honesty labels are in RUNBOOK sections 7 (item 8), 8, 13 and 16. /
Mỗi lượt Twistfit chạy thật gọi Flux (tốn tiền) từ `portfolio-api`, chỉ với người có link mời; cách bật, công tắc tắt khẩn cấp và quy tắc nhãn: xem RUNBOOK phần 7 (mục 8), 8, 13 và 16.

## For contributors and AI agents

This project uses a Next.js version with breaking changes compared with older releases. Read `AGENTS.md`
(and the guides in `node_modules/next/dist/docs/` it points to) before changing framework-level code.
