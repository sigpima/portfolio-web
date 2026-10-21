# portfolio-web

**EN:** Bilingual (Vietnamese / English) portfolio website built with Next.js 16 (`output: "standalone"`).
Projects are registry-driven (`src/content`). The Knowledge Base project has a live demo that streams a real
tool-using chat bot through same-origin proxy routes (`/api/chat/stream`, `/api/chat/status`) to a separate backend;
the Twistfit and Gia pha demos are a replay and a simulation and are labelled as such.

**VI:** Website portfolio song ngữ (Việt / Anh) dựng bằng Next.js 16. Nội dung dự án lấy từ `src/content`.
Dự án Knowledge Base có demo trực tiếp gọi một bot chat thật qua các route proxy cùng origin; demo Twistfit
(phát lại) và Gia phả (mô phỏng) được gắn nhãn đúng bản chất.

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
