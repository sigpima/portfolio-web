# Runbook vận hành: portfolio web

Tài liệu cho chủ site.

## 0. Kiến trúc

```
trình duyệt -> nginx (host) -> web: container `portfolio` (Next.js, 127.0.0.1:3100)
                                 -> portfolio-api (FastAPI + SQLite, mạng Docker, cổng 8100; 127.0.0.1:8100 trên host)
                                      -> chat (repo knowledge_base, mạng Docker, cổng 8003) -> Gemini
```

- Trình duyệt **chỉ** nói chuyện với web. Web gọi `portfolio-api` từ phía máy chủ, kèm khoá nội bộ `PORTFOLIO_API_KEY`.
- `portfolio-api` (repo `/home/nuc/Documents/project/portfolio/api`, xem `README.md` ở đó) giữ **link mời**, **phiên** người xem, **nhật ký sử dụng theo từng link**
  và mật khẩu quản trị; nó là thứ **duy nhất** gọi service `chat`. Người không có phiên hợp lệ (từ một link mời) không bao giờ làm phát sinh lời gọi Gemini.
- Container web chỉ gắn vào mạng mặc định của stack `portfolio-api`, **không** gắn vào mạng `knowledge_base_default`: từ web không với tới được `chat:8003` để lách cổng.
  `portfolio-api` gắn vào cả hai mạng.
- Không có link: demo Knowledge Base hiện **bản phát lại** (replay) của các lần chạy thật đã ghi (phần 12). Có link (mở `/i/<mã>`): demo chạy thật.
- Chỉ web được đưa ra internet qua nginx. **Không bao giờ** proxy `portfolio-api` (8100) hay `chat` (8003) ra ngoài.

## 1. Điều kiện cần

- Docker và Docker Compose v2 trên máy chạy site; nginx chạy ngoài Docker trên host (mẫu cấu hình: `deploy/nginx.conf.example`).
- **Máy build image phải có Internet**: `next/font/google` tải font Google lúc `next build`, nên `docker build` không chạy được khi offline.
- Một khoá `GEMINI_API_KEY` của bạn, chỉ cần cho backend `knowledge_base` (phần 4). Web và `portfolio-api` không bao giờ nhận hay lưu khoá này.
- Repo `knowledge_base` (nhánh có service `chat`) và repo `portfolio/api` nằm trên cùng máy.

## 2. Biến môi trường

### Web (`portfolio`, file `docker-compose.yml` của repo này)

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `PORTFOLIO_API_KEY` | **có** | Khoá nội bộ web <-> `portfolio-api` (header `X-Internal-Key`). **Phải giống hệt** giá trị đặt cho `portfolio-api`; >= 32 ký tự ASCII nhìn thấy được, không khoảng trắng. Compose từ chối chạy nếu thiếu. Khoá cũng dùng để băm IP người xem thành khoá giới hạn tần suất. |
| `SITE_URL` | **có (production)** | Địa chỉ công khai, ví dụ `https://ten-mien-cua-ban`. Cần cả **lúc build** và **lúc chạy** (xem dưới). |
| `PORTFOLIO_API_URL` | không | Mặc định `http://portfolio-api:8100` (tên service trong mạng Docker). |
| `PORTFOLIO_API_NETWORK` | không | Tên mạng Docker của stack `portfolio-api`; mặc định `portfolio-api_default`. Kiểm tra bằng `docker network ls`. |
| `PORTFOLIO_PORT` | không | Cổng trên host (mặc định `3100`, chỉ nghe `127.0.0.1`). |
| `REQUIRE_SITE_URL` | không | Lúc build; với Docker mặc định `1`: build **thất bại** nếu `SITE_URL` trống. Ép `0` chỉ khi build thử trên máy. |
| `NODE_ENV` | (đặt sẵn) | Image đặt `production`: cookie `pf_session`/`pf_admin` có cờ `Secure` (chỉ gửi qua HTTPS). |

**`SITE_URL` lúc build:** các trang được sinh tĩnh nên URL canonical, hreflang và Open Graph bị "đóng băng" vào image; thiếu biến này chúng trỏ về `http://localhost:3000`.
**`SITE_URL` lúc chạy:** đích chuyển hướng của `/i/<mã>` (về `SITE_URL/`) và đường link đầy đủ hiển thị trên `/admin` lấy từ biến runtime. Compose đặt cả hai từ cùng một biến;
đổi `SITE_URL` đồng nghĩa phải **build lại** image (`docker compose up -d --build`).
Với `npm run build` chạy thẳng (không qua Docker): thiếu `SITE_URL` chỉ in cảnh báo `[portfolio-web] WARNING: SITE_URL is not set ...` và vẫn build được.
Nếu thấy dòng cảnh báo này khi build cho production thì dừng lại và đặt `SITE_URL`.

Web không biết địa chỉ của `chat`: địa chỉ đó chỉ cấu hình ở `portfolio-api`.

### `portfolio-api` (repo `portfolio/api`, chi tiết trong `README.md` của repo đó)

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `PORTFOLIO_API_KEY` | **có** | Cùng giá trị với web. Yếu hơn 32 ký tự ASCII nhìn thấy được thì dịch vụ không khởi động. |
| `ADMIN_PASSWORD` | **có** | Mật khẩu trang `/admin`, 12..1024 ký tự. |
| `CHAT_BACKEND_URL` | không | Mặc định `http://chat:8003`. |
| `KB_NETWORK` | không | Mạng của stack `knowledge_base`, mặc định `knowledge_base_default`. |
| `PORTFOLIO_API_PORT` | không | Cổng trên `127.0.0.1` của host, mặc định `8100`. |
| `SESSION_TTL_DAYS`, `ADMIN_SESSION_TTL_MINUTES` | không | Phiên người xem (30 ngày), phiên quản trị trượt (120 phút không hoạt động). |

### `chat` (repo `knowledge_base`)

`GEMINI_API_KEY` (bắt buộc), `CHAT_DEMO_ENABLED` (công tắc mềm, phần 8) và các biến `CHAT_*` khác: xem mục "API chat cho web" trong README của `knowledge_base`.

### Khoá mạnh

Sinh mỗi khoá/mật khẩu bằng:

```bash
python3 -c "import secrets;print(secrets.token_urlsafe(32))"
```

- Dùng **cùng một** giá trị `PORTFOLIO_API_KEY` cho web và `portfolio-api` (sai lệch thì web in một lần
  `portfolio-api rejected the internal key: PORTFOLIO_API_KEY does not match.` và mọi tính năng mời/quản trị báo "tạm nghỉ").
- `ADMIN_PASSWORD` dài ít nhất 12 ký tự; nên dùng luôn một chuỗi sinh như trên và cất trong trình quản lý mật khẩu.
- Đặt các biến trong file `.env` cạnh `docker-compose.yml` của từng repo (đã nằm trong `.gitignore`, xem `.env.example`) hoặc trong môi trường của lệnh. **Không commit** file `.env`.

## 3. Thứ tự bật

1. `chat` (knowledge_base), phần 4.
2. `portfolio-api` (nó gắn vào mạng `knowledge_base_default`, nên mạng đó phải tồn tại trước).
3. web (nó gắn vào mạng `portfolio-api_default`, nên `portfolio-api` phải chạy trước).

Kiểm tra tên các mạng:

```bash
docker network ls    # phải thấy knowledge_base_default và portfolio-api_default
```

Tên mạng mặc định của một stack là `<tên project>_default`, và tên project mặc định là **tên thư mục**. Repo `portfolio-api` nằm ở thư mục `portfolio/api`,
nên nếu chạy `docker compose up` trần ở đó, project tên là `api` và mạng là **`api_default`**, không phải `portfolio-api_default` mà web mặc định tìm. Chọn MỘT trong hai cách:

- (khuyến nghị) đặt tên project cho `portfolio-api` bằng dòng `COMPOSE_PROJECT_NAME=portfolio-api` trong file `.env` cạnh `docker-compose.yml` của `portfolio/api`
  (mọi lệnh `docker compose ...` trong thư mục đó, kể cả sao lưu và `up -d`, sẽ dùng tên này). Làm việc này **trước lần chạy đầu**: đổi tên project sau khi đã có dữ liệu
  thì compose tạo volume mới (`portfolio-api_portfolio_data`) và dữ liệu cũ nằm lại ở `api_portfolio_data`;
- hoặc giữ tên `api` và đặt `PORTFOLIO_API_NETWORK=api_default` cho web.

Nếu mạng của knowledge_base khác `knowledge_base_default`, đặt `KB_NETWORK=<tên-thật>` cho `portfolio-api`.
Thiếu mạng thì compose báo `network ... not found` và không chạy.

## 4. Bật backend chat (trong repo `knowledge_base`)

```bash
cd /home/nuc/Documents/project/knowledge_base
GEMINI_API_KEY=... docker compose --profile chat up -d
curl -s localhost:8003/chat/status        # {"enabled":true}
```

`docker compose up` thường **không** khởi động `chat` (nó nằm sau profile `chat`); phải có `--profile chat`.
Service `chat` chỉ publish `127.0.0.1:8003` và gắn vào mạng `knowledge_base_default`; `portfolio-api` gọi nó bằng tên `chat:8003` qua mạng đó.

## 5. Bật `portfolio-api`

```bash
cd /home/nuc/Documents/project/portfolio/api
PORTFOLIO_API_KEY=... ADMIN_PASSWORD=... docker compose up -d --build
curl -s localhost:8100/healthz           # {"status":"ok"}
```

- Dữ liệu (link, phiên người xem, nhật ký) nằm trong file SQLite ở volume `portfolio_data` (`/data/portfolio.sqlite`).
- **Chỉ chạy MỘT worker** (đúng như `CMD` của Dockerfile). Không bao giờ thêm `--workers` > 1 hay nhân bản service: phiên quản trị, bộ giới hạn tần suất và trần luồng chat
  nằm trong bộ nhớ của tiến trình; nhiều worker làm phiên quản trị "biến mất" ngẫu nhiên và nhân các trần lên.
- **Đổi mật khẩu quản trị hay bất kỳ biến nào**: sửa giá trị (trong `.env` hoặc môi trường lệnh) rồi chạy `docker compose up -d` trong thư mục `portfolio/api`.
  **Không** dùng `docker compose restart`: lệnh đó khởi động lại với môi trường CŨ. `up -d` tạo lại container với giá trị mới; việc này cũng xoá mọi phiên quản trị
  (phải đăng nhập lại) và đặt lại các bộ giới hạn. Link, phiên người xem và nhật ký trong SQLite được giữ nguyên.
  Đổi `PORTFOLIO_API_KEY` thì phải đổi ở **cả hai** service rồi `up -d` cả hai.

## 6. Build và chạy web

```bash
cd /home/nuc/Documents/project/portfolio/web
SITE_URL=https://ten-mien-cua-ban PORTFOLIO_API_KEY=... docker compose up -d --build
```

Nếu tên mạng của `portfolio-api` khác mặc định: thêm `PORTFOLIO_API_NETWORK=<ten-mang>`.
Cập nhật sau khi sửa nội dung: chạy lại đúng lệnh trên. Xem log: `docker compose logs -f portfolio`.

Sau đó dán `deploy/nginx.conf.example` vào nginx của host (đổi tên miền, đường dẫn TLS đang đánh dấu `TODO`), `nginx -t`, rồi reload. Những điểm bắt buộc trong mẫu đó:

- `location /api/chat/stream` giữ `proxy_buffering off`, `proxy_http_version 1.1`, `proxy_set_header Connection ""`, `proxy_read_timeout 120s`,
  nếu không các sự kiện SSE bị dồn lại và sơ đồ không sáng từng bước.
- **`location /i/` có `access_log off`**: mã link nằm trên đường dẫn `/i/<mã>`, access log của nginx sẽ lưu nguyên mã nếu không tắt.
  Ứng dụng tự nó không ghi đường dẫn này; hãy kiểm tra mọi proxy, CDN hay công cụ phân tích khác đứng trước nginx cũng không ghi.
- Mọi `location` proxy đặt `X-Real-IP $remote_addr` và `X-Forwarded-For $remote_addr` (không dùng `$proxy_add_x_forwarded_for`, client tự khai được chuỗi đó).
  Web băm IP này thành khoá giới hạn tần suất; thiếu `X-Real-IP` thì log web in `X-Real-IP header is missing` và mọi người xem dùng chung một khoá.
- **Sau CDN** (Cloudflare, ...): bật `set_real_ip_from <dải IP của CDN>` + `real_ip_header` (ghi chú trong mẫu), nếu không `$remote_addr` là IP của CDN
  và mọi người xem dùng chung một khoá giới hạn (cả ở nginx lẫn ở `portfolio-api`).
- Giới hạn tần suất của nginx (theo IP): `/api/chat/stream` 6 yêu cầu/phút (burst 4), `/i/` 30/phút (burst 10), `/api/admin/login` 10/phút (burst 5), quá thì 429;
  `client_max_body_size 64k`.
- **Khuyến nghị mạnh:** bỏ chú thích `allow <IP CỦA BẠN>; deny all;` ở `/admin`, `/api/admin/login` và `/api/admin/`. Đó là biện pháp chính để trang quản trị
  không lộ ra ngoài và để người lạ dò mật khẩu không làm bạn bị khoá (xem phần 9).

## 7. Việc phải làm lần đầu (trước khi gửi link cho ai)

1. Sinh `PORTFOLIO_API_KEY` và `ADMIN_PASSWORD` mạnh (phần 2), đặt vào `.env` của `portfolio/api` và (khoá) của `web`;
   thêm `COMPOSE_PROJECT_NAME=portfolio-api` vào `.env` của `portfolio/api` (phần 3) rồi kiểm tra `docker network ls` có `portfolio-api_default`.
2. Bật theo thứ tự `chat` -> `portfolio-api` -> web (phần 3-6), với `SITE_URL` là địa chỉ thật (build lại nếu trước đó build thiếu).
3. Cấu hình nginx theo mẫu: `access_log off` cho `/i/`, `limit_req`, `X-Real-IP`, giới hạn IP cho `/admin` và `/api/admin/`; `nginx -t` rồi reload.
4. Chạy các kiểm tra ở phần 10 (đặc biệt: `POST /api/chat/stream` không cookie phải trả 401; `docker compose logs` không chứa mã link).
5. Mở `https://ten-mien-cua-ban/admin`, đăng nhập, tạo một link thử, mở nó trong cửa sổ ẩn danh, hỏi bot một câu, xem nhật ký của link, rồi thu hồi link đó.
6. Ghi các mẫu phát lại thật cho Knowledge Base (phần 12) để người không có link thấy dữ liệu thật thay vì mẫu giữ chỗ.
7. Điền hoặc xác nhận các nội dung chưa được xác nhận (phần 16).

## 8. Bật/tắt demo chat, tắt khẩn cấp

**Tắt khẩn cấp (làm việc này TRƯỚC, nếu còn nghi ngờ thì cứ dừng):**

```bash
cd /home/nuc/Documents/project/knowledge_base
docker compose --profile chat stop chat
```

Dừng container `chat` là cách tắt chắc chắn nhất: không còn lời gọi Gemini nào, bất kể ai đang có link. `portfolio-api` báo `{"enabled":false}`; người xem có link thấy
bảng "demo tạm nghỉ", người không có link vẫn thấy bản phát lại như thường. Không cần build lại hay khởi động lại web hoặc `portfolio-api`.
Nếu nghi một link bị lộ hay bị lạm dụng: **thu hồi** link đó trên `/admin` (có hiệu lực ngay, kể cả với phiên đang mở); thu hồi mọi link nếu cần.
Bật lại: `GEMINI_API_KEY=... docker compose --profile chat up -d`.

**Công tắc mềm `CHAT_DEMO_ENABLED`** (service `chat` vẫn chạy nhưng báo `enabled: false`). Biến này **chỉ được đọc lúc khởi động**, nên phải tạo lại container:

```bash
cd /home/nuc/Documents/project/knowledge_base
CHAT_DEMO_ENABLED=false GEMINI_API_KEY=... docker compose --profile chat up -d   # tắt demo (tạo lại container)
GEMINI_API_KEY=... docker compose --profile chat up -d                           # bật lại: chạy lại KHÔNG kèm biến (mặc định true)
```

Yêu cầu: cách này chỉ hoạt động khi backend đã có commit "pass the CHAT_* operator switches into the chat container" (nhánh `feat/chat-stream-api` của `knowledge_base`), vì trước đó compose của `chat` không chuyển `CHAT_DEMO_ENABLED` vào container (file `.env` cũng không giúp được, compose chỉ dùng nó để thay biến trong file compose).
Cho tới khi commit đó được merge và triển khai, hãy dùng lệnh `stop` ở trên.

**Kiểm tra công tắc đã có tác dụng** (đừng tin lệnh chạy xong là đủ):

```bash
curl -s localhost:8003/chat/status      # trên máy chủ, phải in {"enabled":false}
curl -s localhost:3100/api/chat/status  # qua web -> portfolio-api, cũng phải in {"enabled":false}
```

Nếu `localhost:8003` vẫn in `{"enabled":true}` thì công tắc chưa tới được container: dùng `docker compose --profile chat stop chat`.
Sau khi tắt cứng bằng `stop`, chỉ kiểm tra dòng `localhost:3100/api/chat/status` (phải in `{"enabled":false}`); `localhost:8003` lúc đó từ chối kết nối, đó là đúng.
Tắt hẳn và xoá service chat: `docker compose --profile chat down` (`docker compose down` không kèm profile sẽ để lại container `chat`).

Lưu ý vận hành của `chat`:

- Service `chat` giữ **một** phiên MCP cho cả tiến trình. Compose khởi động lại `chat` mỗi khi `mcp` được khởi động lại qua compose (`depends_on` với `restart: true`).
  Nhưng nếu container `mcp` **tự chết** (nó không có chính sách `restart`) thì phải bật lại cả hai: `docker compose --profile chat up -d mcp chat`
  (hoặc `docker compose --profile chat restart mcp chat`); nếu không mọi lần gọi tool của chat đều lỗi.
- Phiên chat nằm trong RAM của một tiến trình (khởi động lại là mất, không chạy nhiều bản sao). Backend `chat` không lưu câu hỏi của người xem.
- Người xem có link có thể khiến bot chạy SQL chỉ đọc tuỳ ý, kể cả đọc các view catalog của PostgreSQL. Role dùng ở đó chỉ có quyền đọc và bị
  `statement_timeout` 5 giây, và dữ liệu mẫu là bịa, nên đó là rủi ro chấp nhận được cho bản demo. **Đừng trỏ service này vào dữ liệu thật.**
- Mỗi câu hỏi tốn một lượt gọi Gemini của bạn. Chỉ người có link mới hỏi được; `portfolio-api` giới hạn 2 luồng đồng thời mỗi link và 40 luồng toàn hệ thống,
  nginx giới hạn tần suất theo IP (phần 6).

## 9. Trang quản trị `/admin` và link mời

Trang `/admin` chỉ có tiếng Việt và không được lập chỉ mục (`noindex`).

1. **Đăng nhập** bằng `ADMIN_PASSWORD`. Phiên quản trị hết hạn sau 120 phút không hoạt động, và mất khi `portfolio-api` được tạo lại/khởi động lại.
   Sai mật khẩu nhiều lần bị chặn tạm (429): 5 lần/15 phút cho mỗi IP và 60 lần/15 phút cho cả hệ thống (mọi lần thử đều tính, kể cả lần đúng).
   **Nếu bị khoá** (kể cả do người khác dò mật khẩu): chờ hết cửa sổ 15 phút, hoặc chạy `docker compose up -d` trong thư mục `portfolio/api` để xoá bộ giới hạn
   (link và nhật ký giữ nguyên). Cách phòng chính là giới hạn IP ở nginx (phần 6).
2. **Tạo link**: nhập tên gợi nhớ (ví dụ tên công ty/người nhận; 1..80 ký tự), tuỳ chọn ngày hết hạn. Link đầy đủ `SITE_URL/i/<mã>` **chỉ hiện đúng một lần**:
   sao chép ngay rồi gửi cho người nhận. Hệ thống chỉ lưu băm của mã nên không ai (kể cả bạn) xem lại được; lỡ mất thì thu hồi và tạo link mới.
3. **Bảng link**: tên, trạng thái (`active` đang dùng, `unused` chưa ai mở, `revoked` đã thu hồi, `expired` hết hạn), thời điểm tạo/hết hạn/lần dùng cuối, số lần dùng thành công.
4. **Nhật ký từng link**: mở một link để xem các sự kiện mới nhất trước.
5. **Thu hồi**: có hiệu lực **ngay** với mọi phiên đã mở từ link đó (câu hỏi kế tiếp bị từ chối, demo quay về bản phát lại). Không hoàn tác được; cần thì tạo link mới.

Người nhận mở link: trình duyệt nhận cookie `pf_session` (HttpOnly, 30 ngày hoặc tới khi link bị thu hồi/hết hạn) và được chuyển về trang chủ; mã sai,
đã thu hồi hay hết hạn đều chuyển về `/?invite=invalid` (không lộ lý do).

### Nhật ký chứa gì

- **Có**: link nào, thời điểm (UTC), tính năng (`open` mở link, `chat` hỏi bot), kết quả (`success`, `error`, `blocked`) và chi tiết kỹ thuật ngắn do hệ thống đặt (ví dụ mã lỗi).
- **Không bao giờ có**: nội dung câu hỏi hay câu trả lời, ảnh, địa chỉ IP, chuỗi trình duyệt (user agent), mã link gốc hay mã phiên (CSDL chỉ lưu băm SHA-256).
- Log tiến trình (`docker compose logs`) của web và `portfolio-api` cũng không ghi mã link, phiên, mật khẩu hay nội dung câu hỏi.

## 10. Kiểm tra nhanh (sau mỗi lần triển khai)

```bash
curl -s localhost:3100/api/chat/status                        # {"enabled":true} khi chat chạy
curl -s localhost:3100/api/session                            # {"invited":false,"features":{...}}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/vi    # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/en    # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3100/fr    # 404 (chỉ có vi và en)
curl -s -w ' %{http_code}\n' -X POST localhost:3100/api/chat/stream -H 'content-type: application/json' \
  -d '{"message":"x","session_id":null}'                       # {"code":"invite_required"} 401
curl -s -i localhost:3100/i/khong-phai-ma-that | grep -i -E '^(HTTP|location|set-cookie)'   # 307, location .../?invite=invalid, không set-cookie
curl -s localhost:3100/vi | grep -o '<link rel="canonical"[^>]*>'   # phải là https://ten-mien-cua-ban/vi
```

Qua nginx (từ ngoài), lặp lại dòng `POST /api/chat/stream` với `https://ten-mien-cua-ban`: phải là 401.

Kiểm tra log không chứa mã link: sau khi tạo và mở một link thử, tìm một đoạn của mã trong log của cả hai service (không được thấy gì):

```bash
cd /home/nuc/Documents/project/portfolio/web && docker compose logs portfolio | grep -c '<đoạn-mã>'      # 0
cd /home/nuc/Documents/project/portfolio/api && docker compose logs portfolio-api | grep -c '<đoạn-mã>' # 0
```

Khi `chat` tắt hoặc không với tới được, `/api/chat/status` trả `{"enabled":false}`: người có link thấy bảng "demo tạm nghỉ", người không có link vẫn thấy bản phát lại.
Khi `portfolio-api` tắt: mọi người đều thấy bản phát lại, `/i/<mã>` chuyển về `/?invite=invalid`, phần còn lại của site vẫn chạy.

## 11. Sao lưu và khôi phục SQLite

Toàn bộ dữ liệu của `portfolio-api` là một file SQLite trong volume `portfolio_data`. Lệnh sao lưu nóng (nhất quán, trong container) và khôi phục nằm ở mục
"Sao lưu SQLite" và "Khôi phục từ bản sao lưu" của `README.md` trong repo `portfolio/api`. Tóm tắt:

```bash
cd /home/nuc/Documents/project/portfolio/api
docker compose exec portfolio-api python -c "import sqlite3;s=sqlite3.connect('/data/portfolio.sqlite');d=sqlite3.connect('/data/backup.sqlite');s.backup(d)"
docker compose cp portfolio-api:/data/backup.sqlite ./backup.sqlite && chmod 600 ./backup.sqlite
docker compose exec portfolio-api rm -f /data/backup.sqlite
```

Khôi phục: dừng `portfolio-api`, chép bản sao lưu đè lên `/data/portfolio.sqlite`, xoá các file `-wal`/`-shm` cũ, rồi `docker compose up -d` (chi tiết và lệnh `chown` khi cần: README của api).
File sao lưu chứa băm mã link và nhật ký sử dụng: **giữ riêng tư** (`chmod 600`), không commit, không để trong thư mục chia sẻ hay đồng bộ công khai.

## 12. Ghi mẫu phát lại thật cho Knowledge Base

Người xem không có link thấy bản phát lại. Cho tới khi bạn ghi mẫu thật, đó là **một mẫu giữ chỗ** có nhãn "giữ chỗ" và chữ "(minh hoạ)".

1. Bật `chat` bằng khoá Gemini thật (phần 4); kiểm tra `curl -s localhost:8003/chat/status` in `{"enabled":true}`.
2. Trong repo web:

   ```bash
   npm run record:kb                                   # mặc định gọi thẳng http://127.0.0.1:8003
   npm run record:kb -- --url http://<may>:8003         # nếu chat ở chỗ khác
   ```

   Script gọi **thẳng** service `chat` (không qua `portfolio-api`, không cần link), hỏi từng câu trong `scripts/kb-replay-questions.json` ở một cuộc hội thoại mới,
   rồi ghi đè `src/content/replays/knowledge-base.recorded.ts` với thời gian, chi tiết tool và câu trả lời thật. Nếu một câu lỗi hoặc `chat` không chạy, nó không ghi gì.
3. Đọc lại câu trả lời trong file (đối chiếu như phần 14), chạy `npx vitest run src/content`, rồi **commit** `src/content/replays/knowledge-base.recorded.ts` và build lại image.

Khi file có ít nhất một mẫu, mẫu giữ chỗ và nhãn "giữ chỗ" của Knowledge Base **tự biến mất** (không có cờ nào phải sửa tay).

## 13. Thay ảnh giữ chỗ Twistfit bằng ảnh thật

Làm theo `public/replays/twistfit/README.md` (chọn một `TryOnJob` đã `done`, đặt ảnh vào thư mục, sửa `src/content/replays/twistfit.ts`, bỏ chữ "(minh hoạ)" khi số liệu là thật).
Khi **mọi mẫu** đã có `placeholder: false`, nhãn "ảnh giữ chỗ" ở thẻ dự án, trang chi tiết và băng trong demo tự biến mất (trạng thái này tính từ chính dữ liệu mẫu, không có cờ riêng nào phải đồng bộ).
Kiểm tra bằng `npx vitest run src/content src/components/demos`, rồi build lại image.

## 14. Kiểm tra thủ công tiêu chí thành công với Gemini thật

Cần `chat` đã bật bằng khoá Gemini thật, `portfolio-api` và web đã chạy, và một link mời đã mở trong trình duyệt (phần 9). Các test tự động chỉ dùng Gemini giả.

1. Mở link mời, rồi `/vi`, vào dự án Knowledge Base, chỗ demo trực tiếp.
2. Hỏi: **"Báo giá mới nhất giá bao nhiêu?"**
3. Quan sát năm nút của sơ đồ luồng sáng lần lượt theo từng bước, và bảng chi tiết hiện tool đã gọi, tham số (args) và kết quả.
4. Đối chiếu: tool, tham số và kết quả hiện ra phải khớp với nội dung câu trả lời của bot. Nếu lệch thì đó là lỗi, đừng công bố.
5. Bấm câu gợi ý thứ hai: **"Vì sao đơn giá chống thấm sân thượng ở Biệt thự Sen Vàng cao hơn Biệt thự Lúa Non?"**. Bot phải tìm được cả hai công trình
   (thường gọi `run_readonly_sql` rồi `compare_work_item_detail`) và nêu nguyên nhân là vật tư (PU đàn hồi so với gốc xi măng polymer), khớp ví dụ 3 trong README của `knowledge_base`.
6. Mở `/en`, vào cùng dự án, hỏi bằng tiếng Anh (ví dụ "What percentage of the largest quotation is labour?"): bot phải trả lời bằng tiếng Anh, nhãn sơ đồ đọc được bằng tiếng Anh.
7. Kiểm tra cách hiển thị câu trả lời có markdown: demo hiện chữ thuần, nên nếu Gemini trả `**đậm**`, danh sách hay bảng thì ký tự markdown sẽ hiện nguyên. Ghi lại nếu khó đọc.
8. Trên `/admin`, nhật ký của link phải có `open` và các sự kiện `chat` vừa rồi (không có nội dung câu hỏi).
9. Thử tắt `chat` (phần 8) và tải lại trang: phải thấy bảng "demo tạm nghỉ" thay vì lỗi. Trong cửa sổ ẩn danh (không có link): phải thấy bản phát lại.

## 15. Thêm một dự án mới

1. Tạo `src/content/projects/<slug>.ts` xuất một `Project` (kiểu ở `src/content/types.ts`; có thể chép `twistfit.ts` làm mẫu). Mọi trường chữ đều phải đủ `vi` và `en`.
   Chọn `group` (`website` hoặc `ai-agent`), `demoKind` (`live`, `replay`, `simulation`, `none`), `order`, và đặt ảnh bìa SVG vào `public/projects/<slug>.svg` (đường dẫn ghi ở `cover`).
2. Đăng ký ở `src/content/registry.ts`: thêm `import` và đưa vào mảng `projects`. Trang danh sách, trang chi tiết và trang chủ `/vi`, `/en` đều lấy từ đây:
   trang chủ hiện mọi dự án có `featured: true` ở mục nổi bật (xếp theo `order`, dự án nổi bật đầu tiên là đích của nút demo ở phần mở đầu),
   và mọi dự án còn lại (mọi nhóm) dưới dạng thẻ ở mục "Các dự án khác", xếp theo `order`. Dải công nghệ là hợp của `tech` mọi dự án.
3. Nếu có demo (`demoKind` khác `none`) thì đặt `demo: { component: "<khoá>" }` trong file dự án, rồi:
   - thêm component vào `src/components/demos/registry.ts` (`demoComponents["<khoá>"]`);
   - nếu là demo phát lại hay mô phỏng: viết dữ liệu mẫu ở `src/content/replays/<slug>.ts`, đăng ký ở `src/content/replays/index.ts` (`replaysByDemoComponent["<khoá>"]`),
     và thêm một bọc component trong `src/components/demos/replay-demos.tsx` bằng cách sao chép bọc có sẵn (`TwistfitReplayDemo` hoặc `GiaPhaSimulationDemo`): component nhận `{ locale }`
     và truyền `definition` (dữ liệu mẫu của bạn), `kind` (`"replay"` hoặc `"simulation"`) và `locale` cho `<ReplayDemo>`; đăng ký bọc đó trong `replayDemoComponents` cùng file (không cần sửa `registry.ts`).
4. Các test có ghi tên slug hay khoá demo cụ thể (không có test nào đếm tổng số dự án):
   - `src/content/registry.test.ts`: danh sách khoá demo truyền cho `validateProjects` (thêm khoá mới của bạn vào đó); các test khác chỉ kiểm tra ba slug hiện có (`knowledge-base`, `twistfit`, `gia-pha`) vẫn có mặt và Knowledge Base đứng đầu.
   - `src/components/demos/ReplayDemo.test.tsx` (test "demo registry"): liệt kê đúng các khoá trong `demoComponents`; thêm khoá mới vào.
   - `src/components/demos/registry.test.ts`: tự kiểm tra khoá trong `replaysByDemoComponent` và `replayDemoComponents` (`replay-demos.tsx`) trùng nhau; đăng ký thiếu một bên là test hỏng.
   - `src/content/replays/placeholder.test.ts` và `src/components/ProjectCard.test.tsx` ghi tên `twistfit`, `knowledge-base`, `gia-pha` để kiểm tra nhãn giữ chỗ; không cần sửa khi thêm dự án.
5. Chạy `npx vitest run && npm run build`, rồi build lại image.

Liệt kê mọi giá trị còn `TODO:`:

```bash
grep -rn "TODO:" src/content
```

## 16. Quy tắc trung thực cần giữ

- **Nhãn theo loại demo**: `live` = chạy thật khi người xem hỏi (với Knowledge Base: chỉ khi có link mời); `replay` = phát lại từ một lần chạy thật đã ghi;
  `simulation` = mô phỏng một tính năng chưa hoàn thành. Đừng gắn nhãn cao hơn sự thật (ví dụ không gắn "chạy thật" cho thứ chỉ phát lại).
- **Ảnh giữ chỗ** Twistfit và mẫu giữ chỗ Knowledge Base phải giữ nhãn "giữ chỗ" và chữ "(minh hoạ)" cho tới khi thay bằng dữ liệu thật (phần 12, 13).
  Test dữ liệu sẽ báo lỗi nếu cờ `placeholder` không nhất quán với ảnh và chữ.
- **Gia phả** là mô phỏng một tính năng AI đang phát triển (chưa xây), không được trình bày như sản phẩm đã có. Việc đọc ảnh và bản quét tài liệu gia phả mới là kế hoạch.
- **Dữ liệu Knowledge Base là giả lập**; giữ cụm "dữ liệu giả lập" / "synthetic data" trong mô tả.
- **Quyền riêng tư**: nội dung câu hỏi không bao giờ được lưu; nhật ký chỉ ghi link, tính năng, thời điểm và kết quả (phần 9). Đừng viết trên trang rằng "không ghi lại gì cả".
- Không đưa thông số Flux, prompt hay thời gian từng bước nếu bản ghi thật không có.

### Nội dung chưa được xác nhận (cần bạn điền hoặc quyết định)

- **Hosting của Flux**: chưa xác nhận Flux chạy ở đâu; không viết ra nơi chạy cho tới khi bạn xác nhận.
- **Liên kết repo**: cả ba dự án đang để `links: []` (có `TODO:` trong `src/content/projects/*.ts`); chỉ thêm khi bạn xác nhận repo được công khai.
- **Thông tin cá nhân** trong `src/content/site.ts`: tên, giới thiệu, email, GitHub đang là `TODO:`; `cv` là `null`.
- **Câu định vị ở phần mở đầu trang chủ** (`home.hero.headline` trong `messages/vi.json` và `messages/en.json`: "Tôi xây hệ thống LLM và agent, cùng các sản phẩm web xung quanh chúng." / "I build LLM and agent systems, and the web products around them."):
  do người dựng site viết thay bạn; hãy xác nhận hoặc viết lại.

### Việc cần làm tiếp

- **Plan B: Twistfit chạy thật qua link mời** (tính năng `twistfit`, trần `twistfit_max` mỗi link) **chưa làm**: hiện Twistfit vẫn là bản phát lại và `portfolio-api`
  luôn báo `twistfit: false`, `gia_pha: false`.
- **Markdown trong câu trả lời của bot**: Gemini hay trả lời bằng markdown, còn demo hiển thị chữ thuần (an toàn, không chèn HTML). Chọn một trong hai: yêu cầu backend (system prompt) trả lời bằng chữ thuần, hoặc sau này hiển thị một tập con markdown an toàn ở frontend.
