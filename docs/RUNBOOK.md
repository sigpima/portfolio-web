# Runbook vận hành: portfolio web

Tài liệu cho chủ site. Kiến trúc: trình duyệt -> nginx trên host -> container `portfolio` (Next.js, cổng `127.0.0.1:3100`)
-> (chỉ riêng demo Knowledge Base) service `chat` của repo `knowledge_base` qua mạng Docker, cổng 8003.

## 1. Điều kiện cần

- Docker và Docker Compose v2 trên máy chạy site; nginx chạy ngoài Docker trên host (mẫu cấu hình: `deploy/nginx.conf.example`).
- **Máy build image phải có Internet**: `next/font/google` tải font Google lúc `next build`, nên `docker build` không chạy được khi offline.
- Một khoá `GEMINI_API_KEY` của bạn, chỉ cần cho backend `knowledge_base` (phần 3). Site này không bao giờ nhận hay lưu khoá.
- Repo `knowledge_base` (nhánh có service `chat`) nằm trên cùng máy.

## 2. Biến môi trường

| Biến | Ở đâu | Ý nghĩa |
| --- | --- | --- |
| `SITE_URL` | **lúc build** (và runtime) | Địa chỉ công khai của site, ví dụ `https://ten-mien-cua-ban`. **BẮT BUỘC khi lên production.** Các trang được sinh tĩnh lúc build nên URL canonical, hreflang và Open Graph bị "đóng băng" vào image; thiếu biến này chúng trỏ về `http://localhost:3000`. |
| `CHAT_BACKEND_URL` | runtime (server) | Địa chỉ service chat mà proxy `/api/chat/*` gọi. Mặc định `http://chat:8003` (compose đã đặt sẵn). |
| `KB_NETWORK` | khi chạy compose | Tên mạng Docker của stack `knowledge_base`; mặc định `knowledge_base_default`. Kiểm tra bằng `docker network ls`. |
| `PORTFOLIO_PORT` | khi chạy compose | Cổng trên host (mặc định `3100`, chỉ nghe `127.0.0.1`). |
| `REQUIRE_SITE_URL` | lúc build | Với Docker mặc định là `1`: build **thất bại** nếu `SITE_URL` trống, để không lỡ phát hành canonical sai. Ép `REQUIRE_SITE_URL=0` chỉ khi build thử trên máy. |

Với `npm run build` chạy thẳng (không qua Docker): thiếu `SITE_URL` thì chỉ in cảnh báo `[portfolio-web] WARNING: SITE_URL is not set ...`
và vẫn build được (không làm hỏng việc dựng cục bộ). Nếu thấy dòng cảnh báo này khi build cho production thì dừng lại và đặt `SITE_URL`.
Đổi `SITE_URL` đồng nghĩa phải **build lại** image.

## 3. Bật backend chat (trong repo `knowledge_base`)

```bash
cd /home/nuc/Documents/project/knowledge_base
GEMINI_API_KEY=... docker compose --profile chat up -d
curl -s localhost:8003/chat/status        # {"enabled":true}
```

`docker compose up` thường **không** khởi động `chat` (nó nằm sau profile `chat`); phải có `--profile chat`.
Service `chat` chỉ publish `127.0.0.1:8003` và gắn vào mạng `knowledge_base_default`; portfolio gọi nó bằng tên `chat:8003` qua mạng đó.

## 4. Build và chạy portfolio

```bash
cd /home/nuc/Documents/project/portfolio/web
SITE_URL=https://ten-mien-cua-ban docker compose up -d --build
```

Nếu tên mạng khác mặc định: `KB_NETWORK=<ten-mang> SITE_URL=... docker compose up -d --build`
(mạng phải tồn tại, tức là stack `knowledge_base` đã chạy ít nhất một lần, nếu không compose báo lỗi "network ... not found").
Cập nhật sau khi sửa nội dung: chạy lại đúng lệnh trên. Xem log: `docker compose logs -f portfolio`.

Sau đó dán `deploy/nginx.conf.example` vào nginx của host (đổi tên miền, đường dẫn TLS đang đánh dấu `TODO`), `nginx -t`, rồi reload.
Block `location /api/chat/stream` phải giữ `proxy_buffering off`, `proxy_http_version 1.1`, `proxy_read_timeout 120s`, nếu không các sự kiện SSE bị dồn lại và sơ đồ không sáng từng bước.

## 5. Kiểm tra nhanh

```bash
curl -s localhost:3100/api/chat/status                       # {"enabled":true}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/vi   # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/en   # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/fr   # 404 (chỉ có vi và en)
curl -N -X POST localhost:3100/api/chat/stream -H 'content-type: application/json' \
  -d '{"message":"Báo giá mới nhất giá bao nhiêu?","session_id":null}'   # các sự kiện start/tool_call/tool_result/answer/done
curl -s localhost:3100/vi | grep -o '<link rel="canonical"[^>]*>'          # phải là https://ten-mien-cua-ban/vi
```

Khi backend tắt hoặc không với tới được, `/api/chat/status` trả `{"enabled":false}` và trang demo Knowledge Base hiện bảng "demo tạm nghỉ" (phần còn lại của site vẫn chạy bình thường).

## 6. Bật/tắt demo chat

Công tắc nằm ở backend: biến `CHAT_DEMO_ENABLED` của service `chat` (trong repo `knowledge_base`). Biến này **chỉ được đọc lúc khởi động**, nên đổi xong phải tạo lại container:

```bash
cd /home/nuc/Documents/project/knowledge_base
CHAT_DEMO_ENABLED=false GEMINI_API_KEY=... docker compose --profile chat up -d   # tắt demo
GEMINI_API_KEY=... docker compose --profile chat up -d                           # bật lại (mặc định true)
```

(Nếu bạn đặt biến trong file `.env` cạnh compose của `knowledge_base` thì sửa ở đó rồi chạy lại lệnh `up -d`.)
Tắt hẳn service chat: `docker compose --profile chat down` (`docker compose down` không kèm profile sẽ để lại container `chat`).
Không cần build lại hay khởi động lại portfolio: nó hỏi `/api/chat/status` mỗi lần.

Lưu ý vận hành:

- Service `chat` giữ **một** phiên MCP cho cả tiến trình. Compose khởi động lại `chat` mỗi khi `mcp` được khởi động lại qua compose (`depends_on` với `restart: true`).
  Nhưng nếu container `mcp` **tự chết** (nó không có chính sách `restart`) thì phải bật lại cả hai: `docker compose --profile chat up -d mcp chat`
  (hoặc `docker compose --profile chat restart mcp chat`); nếu không mọi lần gọi tool của chat đều lỗi.
- Phiên chat nằm trong RAM của một tiến trình (khởi động lại là mất, không chạy nhiều bản sao). Backend **không lưu câu hỏi của người xem**.
- Người xem có thể khiến bot chạy SQL chỉ đọc tuỳ ý, kể cả đọc các view catalog của PostgreSQL. Role dùng ở đó chỉ có quyền đọc và bị
  `statement_timeout` 5 giây, và dữ liệu mẫu là bịa, nên đó là rủi ro chấp nhận được cho bản demo. **Đừng trỏ service này vào dữ liệu thật.**
- Mỗi câu hỏi tốn một lượt gọi Gemini của bạn: nên giới hạn tần suất ở nginx (gợi ý có trong `deploy/nginx.conf.example`).

## 7. Thay ảnh giữ chỗ Twistfit bằng ảnh thật

Làm theo `public/replays/twistfit/README.md` (chọn một `TryOnJob` đã `done`, đặt ảnh vào thư mục, sửa `src/content/replays/twistfit.ts`, bỏ chữ "(minh hoạ)" khi số liệu là thật).
Khi **mọi mẫu** đã có `placeholder: false`, nhãn "ảnh giữ chỗ" ở thẻ dự án, trang chi tiết và băng trong demo tự biến mất (trạng thái này tính từ chính dữ liệu mẫu, không có cờ riêng nào phải đồng bộ).
Kiểm tra bằng `npx vitest run src/content src/components/demos`, rồi build lại image.

## 8. Thêm một dự án mới

1. Tạo `src/content/projects/<slug>.ts` xuất một `Project` (kiểu ở `src/content/types.ts`; có thể chép `twistfit.ts` làm mẫu). Mọi trường chữ đều phải đủ `vi` và `en`.
   Chọn `group` (`website` hoặc `ai-agent`), `demoKind` (`live`, `replay`, `simulation`, `none`), `order`, và đặt ảnh bìa SVG vào `public/projects/<slug>.svg` (đường dẫn ghi ở `cover`).
2. Đăng ký ở `src/content/registry.ts`: thêm `import` và đưa vào mảng `projects`. Danh sách, trang chi tiết và trang `/vi`, `/en` đều lấy từ đây.
3. Nếu có demo (`demoKind` khác `none`) thì đặt `demo: { component: "<khoá>" }` trong file dự án, rồi:
   - thêm component vào `src/components/demos/registry.ts` (`demoComponents["<khoá>"]`);
   - nếu là demo phát lại hay mô phỏng: viết dữ liệu mẫu ở `src/content/replays/<slug>.ts`, đăng ký ở `src/content/replays/index.ts` (`replaysByDemoComponent["<khoá>"]`),
     và thêm một bọc component nhỏ trong `src/components/demos/replay-demos.tsx` dùng `<ReplayDemo kind="replay" | "simulation" />`.
4. Cập nhật các test đang liệt kê cứng: danh sách demo đã biết trong `src/content/registry.test.ts` và `src/components/demos/ReplayDemo.test.tsx` (test "demo registry"), cùng các test đếm dự án nếu có.
5. Chạy `npx vitest run && npm run build`, rồi build lại image.

## 9. Liệt kê mọi giá trị còn `TODO:`

```bash
grep -rn "TODO:" src/content
```

## 10. Kiểm tra thủ công tiêu chí thành công với Gemini thật

Cần backend đã bật bằng khoá Gemini thật (phần 3) và portfolio đã chạy (phần 4). Các test tự động chỉ dùng Gemini giả.

1. Mở `/vi`, vào dự án Knowledge Base, chỗ demo trực tiếp.
2. Hỏi: **"Báo giá mới nhất giá bao nhiêu?"**
3. Quan sát năm nút của sơ đồ luồng sáng lần lượt theo từng bước, và bảng chi tiết hiện tool đã gọi, tham số (args) và kết quả.
4. Đối chiếu: tool, tham số và kết quả hiện ra phải khớp với nội dung câu trả lời của bot. Nếu lệch thì đó là lỗi, đừng công bố.
5. Mở `/en`, vào cùng dự án, hỏi lại (ví dụ "What is the latest quotation price?") và kiểm tra giao diện, nhãn sơ đồ đọc được bằng tiếng Anh.
6. Thử tắt backend (phần 6) và tải lại trang: phải thấy bảng "demo tạm nghỉ" thay vì lỗi.

## 11. Quy tắc trung thực cần giữ

- **Nhãn theo loại demo**: `live` = chạy thật khi người xem hỏi; `replay` = phát lại từ một lần chạy thật đã ghi; `simulation` = mô phỏng một tính năng chưa hoàn thành.
  Đừng gắn nhãn cao hơn sự thật (ví dụ không gắn "chạy thật" cho thứ chỉ phát lại).
- **Ảnh giữ chỗ** Twistfit phải giữ nhãn "ảnh giữ chỗ" và chữ "(minh hoạ)" cho tới khi thay bằng dữ liệu thật (phần 7). Test dữ liệu sẽ báo lỗi nếu cờ `placeholder` không nhất quán với ảnh và chữ.
- **Gia phả** là mô phỏng một tính năng AI đang phát triển (chưa xây), không được trình bày như sản phẩm đã có. Việc đọc ảnh và bản quét tài liệu gia phả mới là kế hoạch.
- **Dữ liệu Knowledge Base là giả lập**; giữ cụm "dữ liệu giả lập" / "synthetic data" trong mô tả.
- Không đưa thông số Flux, prompt hay thời gian từng bước nếu bản ghi thật không có.

### Nội dung chưa được xác nhận (cần bạn điền hoặc quyết định)

- **Hosting của Flux**: chưa xác nhận Flux chạy ở đâu; không viết ra nơi chạy cho tới khi bạn xác nhận.
- **Liên kết repo**: cả ba dự án đang để `links: []` (có `TODO:` trong `src/content/projects/*.ts`); chỉ thêm khi bạn xác nhận repo được công khai.
- **Thông tin cá nhân** trong `src/content/site.ts`: tên, giới thiệu, email, GitHub đang là `TODO:`; `cv` là `null`.
