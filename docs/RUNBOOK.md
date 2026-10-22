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
- Không có link: demo Knowledge Base hiện **bản phát lại** (replay) của các lần chạy thật đã ghi (phần 12), còn Twistfit hiện bản phát lại bằng **ảnh giữ chỗ** (phần 13). Có link (mở `/i/<mã>`): demo chạy thật.
  Twistfit chạy thật gọi Flux (Black Forest Labs, tốn tiền mỗi lượt) từ `portfolio-api`; ảnh người mẫu và món đồ nằm ở `portfolio/api/twistfit-assets/` (phần 7, mục 8).
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
| `PORTFOLIO_API_KEY` | **có** | Khoá nội bộ web <-> `portfolio-api` (header `X-Internal-Key`). **Phải giống hệt** giá trị đặt cho `portfolio-api`; >= 32 ký tự ASCII nhìn thấy được, không khoảng trắng. Compose từ chối chạy nếu thiếu; khoá ngắn hơn hay có ký tự lạ (kể cả `CHANGE_ME`) thì web **không gọi** `portfolio-api` (mở link báo "thử lại sau", `/admin` báo tạm nghỉ). Khoá cũng dùng để băm IP người xem thành khoá giới hạn tần suất. |
| `SITE_URL` | **có (production)** | Địa chỉ công khai, ví dụ `https://ten-mien-cua-ban`. Cần cả **lúc build** và **lúc chạy** (xem dưới). Giá trị `CHANGE_ME` của `.env.example` làm build thất bại ngay. |
| `PORTFOLIO_API_URL` | không | Mặc định `http://portfolio-api:8100` (tên service trong mạng Docker). |
| `PORTFOLIO_API_NETWORK` | không | Dự phòng: tên mạng của stack `portfolio-api` khi nó khác `portfolio-api_default` (xem phần 3). |
| `PORTFOLIO_PORT` | không | Cổng trên host (mặc định `3100`, chỉ nghe `127.0.0.1`). |
| `REQUIRE_SITE_URL` | không | Lúc build; với Docker mặc định `1`: build **thất bại** nếu `SITE_URL` trống. Ép `0` chỉ khi build thử trên máy. |
| `NODE_ENV` | (đặt sẵn) | Image đặt `production`: cookie `pf_session`/`pf_admin` có cờ `Secure` (chỉ gửi qua HTTPS). |

**`SITE_URL` lúc build:** các trang được sinh tĩnh nên URL canonical, hreflang và Open Graph bị "đóng băng" vào image; thiếu biến này chúng trỏ về `http://localhost:3000`.
**`SITE_URL` lúc chạy:** đích chuyển hướng của `/i/<mã>` (về `SITE_URL/`) và đường link đầy đủ hiển thị trên `/admin` lấy từ biến runtime. Compose đặt cả hai từ cùng một biến;
đổi `SITE_URL` đồng nghĩa phải **build lại** image (`docker compose up -d --build`).
Với `npm run build` chạy thẳng (không qua Docker): thiếu `SITE_URL` chỉ in cảnh báo `[portfolio-web] WARNING: SITE_URL is not set ...` và vẫn build được.
Nếu thấy dòng cảnh báo này khi build cho production thì dừng lại và đặt `SITE_URL`. Một giá trị không phải URL tuyệt đối (như `CHANGE_ME`) luôn làm build thất bại
(`SITE_URL is not a valid absolute URL`); lúc chạy, giá trị như vậy bị bỏ qua (chuyển hướng của `/i/<mã>` dùng địa chỉ của chính yêu cầu, `/admin` hiện cảnh báo "SITE_URL chưa được đặt").

**Cả `PORTFOLIO_API_KEY` lẫn `SITE_URL` phải là giá trị thật**: `.env.example` để cả hai là `CHANGE_ME` (cố ý không hợp lệ) để một bản chép chưa sửa hỏng ngay, thấy rõ.

Web không biết địa chỉ của `chat`: địa chỉ đó chỉ cấu hình ở `portfolio-api`.

### `portfolio-api` (repo `portfolio/api`, chi tiết trong `README.md` của repo đó)

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `PORTFOLIO_API_KEY` | **có** | Cùng giá trị với web. Yếu hơn 32 ký tự ASCII nhìn thấy được thì dịch vụ không khởi động. |
| `ADMIN_PASSWORD` | **có** | Mật khẩu trang `/admin`, 12..1024 ký tự. |
| `CHAT_BACKEND_URL` | không | Mặc định `http://chat:8003`. |
| `KB_NETWORK` | không | Mạng của stack `knowledge_base`, mặc định `knowledge_base_default`. |
| `PORTFOLIO_API_PORT` | không | Cổng trên `127.0.0.1` của host, mặc định `8100`. |
| `FLUX_API_KEY` | không | Khoá Black Forest Labs cho Twistfit chạy thật. Trống = tắt Twistfit chạy thật (người xem thấy bản phát lại). Chỉ đặt ở `.env` của `portfolio-api`, **không bao giờ** ở web. |
| `TWISTFIT_LIVE_ENABLED` | không | Mặc định `true`; `false` tắt Twistfit chạy thật dù đã có khoá (công tắc khẩn cấp, phần 8). |
| `FLUX_API_BASE_URL` | không | Mặc định `https://api.bfl.ai`. Chỉ đổi khi thử với `scripts/fake_flux.py` (xem `README.md` của `portfolio/api`); nhớ trả về mặc định. |
| `SESSION_TTL_DAYS`, `ADMIN_SESSION_TTL_MINUTES` | không | Phiên người xem (30 ngày), phiên quản trị trượt (120 phút không hoạt động) **phía `portfolio-api`**. Cookie `pf_admin` của web luôn trượt cố định 7200 giây (hằng số `ADMIN_MAX_AGE` trong mã web, không đọc biến này): giữ `ADMIN_SESSION_TTL_MINUTES=120` cho khớp (xem phần 9). |

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
- Đặt các biến trong file `.env` (mục ngay dưới).

### File `.env`: cách đặt biến chính

Mỗi stack có một file `.env` cạnh `docker-compose.yml` của nó (web: `portfolio/web/.env`; `portfolio-api`: `portfolio/api/.env`), chép từ `.env.example` cùng thư mục:

```bash
cp .env.example .env && chmod 600 .env    # rồi sửa các giá trị CHANGE_ME / chỗ giữ
```

- `.env` đã nằm trong `.gitignore` của cả hai repo. **Không bao giờ commit nó.** Các giá trị `CHANGE_ME` trong `.env.example` cố ý không hợp lệ
  (`portfolio-api` từ chối khởi động; web từ chối gọi `portfolio-api` với khoá đó và build thất bại với `SITE_URL=CHANGE_ME`), để một bản chép chưa sửa hỏng ngay thay vì chạy với khoá yếu.
- docker compose tự đọc `.env` cho **mọi** lệnh chạy trong thư mục đó. Điều này quan trọng: không chỉ `up` mà cả `logs`, `exec`, `cp`, `stop`, `down`, `run`
  đều cần các biến bắt buộc (`PORTFOLIO_API_KEY` ở web; `PORTFOLIO_API_KEY` và `ADMIN_PASSWORD` ở `portfolio-api`). Thiếu thì lệnh dừng ngay với lỗi
  `required variable ... is missing a value` (đã thấy với `logs`, `ps` ở cả hai stack và `exec` ở `portfolio-api`; vài lệnh khác tuỳ phiên bản compose
  có thể chạy được, đừng dựa vào đó). Mọi lệnh compose trong tài liệu này giả định `.env` đã có.
- Dạng `VAR=... docker compose up` (đặt biến ngay trên dòng lệnh) chỉ dùng cho **một lần chạy thử**; khi đó mọi lệnh compose khác cũng phải kèm đủ các biến đó.

## 3. Thứ tự bật

1. `chat` (knowledge_base), phần 4.
2. `portfolio-api` (nó gắn vào mạng `knowledge_base_default`, nên mạng đó phải tồn tại trước).
3. web (nó gắn vào mạng `portfolio-api_default`, nên `portfolio-api` phải chạy trước).

Kiểm tra tên các mạng:

```bash
docker network ls    # phải thấy knowledge_base_default và portfolio-api_default
```

**Tên mạng của `portfolio-api` (mục duy nhất về chuyện này; các chỗ khác trỏ về đây):** mạng mặc định của một stack compose là `<tên project>_default`.
Compose của `portfolio-api` đặt `name: portfolio-api`, nên mạng là `portfolio-api_default` (và volume là `portfolio-api_portfolio_data`); biến `COMPOSE_PROJECT_NAME`
hay cờ `-p` ghi đè `name:` nếu bạn đặt chúng. Web mặc định tìm đúng `portfolio-api_default`.
`PORTFOLIO_API_NETWORK` (trong `.env` của web) chỉ là **phương án dự phòng**: chỉ đặt khi `docker network ls` cho thấy mạng của `portfolio-api` có tên khác.
Một triển khai cũ từng chạy `portfolio-api` dưới tên project khác sẽ có mạng và volume mang tên khác: kiểm tra bằng `docker network ls` và `docker volume ls`
(dữ liệu cũ nằm trong volume của tên project cũ).

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
cp .env.example .env && chmod 600 .env    # lần đầu: điền PORTFOLIO_API_KEY, ADMIN_PASSWORD (phần 2)
docker compose up -d --build
curl -s localhost:8100/healthz           # {"status":"ok"}
```

Các lệnh compose khác trong thư mục này (`logs`, `exec`, `cp`, `stop`, `down`, sao lưu ở phần 11) cũng đọc `.env`; không có nó thì chúng hỏng (phần 2).

- Dữ liệu (link, phiên người xem, nhật ký) nằm trong file SQLite ở volume `portfolio-api_portfolio_data` (`/data/portfolio.sqlite` trong container).
- **Chỉ chạy MỘT worker** (đúng như `CMD` của Dockerfile). Không bao giờ thêm `--workers` > 1 hay nhân bản service: phiên quản trị, bộ giới hạn tần suất và trần luồng chat
  nằm trong bộ nhớ của tiến trình; nhiều worker làm phiên quản trị "biến mất" ngẫu nhiên và nhân các trần lên.
- **Đổi mật khẩu quản trị hay bất kỳ biến nào**: sửa giá trị trong `.env` rồi chạy `docker compose up -d` trong thư mục `portfolio/api`.
  **Không** dùng `docker compose restart`: lệnh đó khởi động lại với môi trường CŨ. `up -d` tạo lại container với giá trị mới (chỉ khi có giá trị đã đổi; không đổi gì thì nó không làm gì, xem phần 9 để xoá bộ giới hạn); việc tạo lại cũng xoá mọi phiên quản trị
  (phải đăng nhập lại) và đặt lại các bộ giới hạn. Link, phiên người xem và nhật ký trong SQLite được giữ nguyên.
  Đổi `PORTFOLIO_API_KEY` thì phải đổi ở **cả hai** service rồi `up -d` cả hai.

## 6. Build và chạy web

```bash
cd /home/nuc/Documents/project/portfolio/web
cp .env.example .env && chmod 600 .env    # lần đầu: điền PORTFOLIO_API_KEY (giống portfolio-api) và SITE_URL (phần 2)
docker compose up -d --build
```

Tên mạng của `portfolio-api`: xem phần 3 (chỉ khi khác mặc định mới thêm `PORTFOLIO_API_NETWORK` vào `.env`).
Cập nhật sau khi sửa nội dung: chạy lại `docker compose up -d --build`. Xem log: `docker compose logs -f portfolio` (cũng cần `.env`, phần 2).

Sau đó dán `deploy/nginx.conf.example` vào nginx của host (đổi tên miền, đường dẫn TLS đang đánh dấu `TODO`), `nginx -t`, rồi reload. Những điểm bắt buộc trong mẫu đó:

- `location /api/chat/stream` giữ `proxy_buffering off`, `proxy_http_version 1.1`, `proxy_set_header Connection ""`, `proxy_read_timeout 120s`,
  nếu không các sự kiện SSE bị dồn lại và sơ đồ không sáng từng bước.
- **`location /i/` có `access_log off` VÀ `error_log /dev/null crit`**: mã link nằm trên đường dẫn `/i/<mã>`. Access log lưu nguyên đường dẫn nếu không tắt;
  error log cũng ghi `request: "GET /i/<mã> HTTP/1.1"` khi limit_req từ chối một yêu cầu hay khi upstream lỗi (`connect() failed`, 502 lúc web đang khởi động lại).
  Với mẫu này, các lần `/i/` bị giới hạn tần suất hay lỗi upstream **không được ghi ở đâu cả** (đổi lại bạn không thấy chúng trong log).
  Đừng thêm nơi nhận `error_log` nào khác (syslog, file mức `debug`, ...) ghi được đường dẫn này. Ứng dụng tự nó không ghi đường dẫn này;
  hãy kiểm tra mọi proxy, CDN hay công cụ phân tích khác đứng trước nginx cũng không ghi.
- Mọi `location` proxy đặt `X-Real-IP $remote_addr` và `X-Forwarded-For $remote_addr` (không dùng `$proxy_add_x_forwarded_for`, client tự khai được chuỗi đó).
  Ở production web **chỉ** tin `X-Real-IP` và băm nó thành khoá giới hạn tần suất (không dùng `X-Forwarded-For`: khi thiếu, Next tự điền địa chỉ kết nối, tức gateway
  của Docker). Yêu cầu nào thiếu `X-Real-IP` đều rơi vào một khoá chung `unknown`, và log web in một lần `X-Real-IP header is missing`: thấy dòng này khi đi qua nginx
  nghĩa là cấu hình nginx thiếu header, mọi người xem đang chung một bộ giới hạn.
- **Sau CDN** (Cloudflare, ...): bật `set_real_ip_from <dải IP của CDN>` + `real_ip_header` (ghi chú trong mẫu), nếu không `$remote_addr` là IP của CDN
  và mọi người xem dùng chung một khoá giới hạn (cả ở nginx lẫn ở `portfolio-api`).
- Giới hạn tần suất của nginx (theo IP): `/api/chat/stream` 6 yêu cầu/phút (burst 4), `/api/chat/status` 30/phút (burst 20), `/i/` 30/phút (burst 10),
  `/api/admin/login` 10/phút (burst 5), quá thì 429; với các tuyến `/api/` thân 429 là JSON `{"code":"rate_limited"}` (qua `error_page 429 = @rate_limited`) để trang hiện đúng thông báo; `client_max_body_size 64k`.
  `$binary_remote_addr` tính riêng từng địa chỉ IPv6 (/128) còn ứng dụng gộp theo /64, nên một máy có cả dải /64 né được giới hạn của nginx;
  trần luồng chat đồng thời của `portfolio-api` (2 mỗi link, 40 toàn hệ thống) vẫn chặn.
- **Bắt buộc (nằm trong danh sách phần 7):** giới hạn IP cho `/admin`, `/api/admin/login` và `/api/admin/`. Mẫu đã có sẵn `allow 192.0.2.1; deny all;`
  (192.0.2.1 là địa chỉ dành cho tài liệu, không ai có): thay bằng IP của bạn. Để nguyên thì chính bạn cũng bị 403, cố ý để cấu hình chưa sửa thì đóng chứ không mở.
  Đó là biện pháp chính để trang quản trị không lộ ra ngoài và để người lạ dò mật khẩu không làm bạn bị khoá (xem phần 9).
- Web tự gửi `X-Frame-Options: DENY` và `Content-Security-Policy: frame-ancestors 'none'` cho `/admin` và `/api/admin/*` (không trang nào khác nhúng được trang quản trị).

**Khi IP của bạn đổi (bị chính danh sách `allow` chặn, nhận 403):**

1. Trên máy chủ (qua SSH), sửa các dòng `allow` ở **cả ba** location `/admin`, `= /api/admin/login`, `/api/admin/`; thêm cả địa chỉ IPv6 nếu mạng của bạn có IPv6
   (ví dụ `allow 2001:db8:1234:5678::/64;`), vì trình duyệt có thể đi bằng IPv6.
2. `sudo nginx -t` rồi `sudo systemctl reload nginx` (hoặc `sudo nginx -s reload`).

Cách khác, không sửa nginx: mở đường hầm SSH tới cổng của web rồi vào thẳng `http://localhost:3100/admin` (không qua nginx):

```bash
ssh -L 3100:127.0.0.1:3100 <user>@<may-chu>
```

Cookie `pf_admin` có cờ `Secure`, nhưng các trình duyệt hiện đại coi `http://localhost` là ngữ cảnh an toàn nên vẫn nhận nó. **Cách đường hầm này chưa được kiểm tra thực tế.**
Đi đường hầm thì không có `X-Real-IP` (không qua nginx): ở production web không dùng `X-Forwarded-For` thay thế, nên mọi lần đăng nhập qua đó chung khoá giới hạn `unknown`
và log web in một lần `X-Real-IP header is missing` (lúc này là bình thường). Chấp nhận được cho một người dùng.

## 7. Việc phải làm lần đầu (trước khi gửi link cho ai)

Mọi mục dưới đây là **bắt buộc**.

1. Sinh `PORTFOLIO_API_KEY` và `ADMIN_PASSWORD` mạnh (phần 2), đặt vào `.env` (`chmod 600`) của `portfolio/api` và (khoá, `SITE_URL`) của `web`.
   Không để sót giá trị `CHANGE_ME` nào: cả `PORTFOLIO_API_KEY` lẫn `SITE_URL` phải là giá trị thật.
   Sau khi bật `portfolio-api`, chạy `docker network ls`: nếu không có `portfolio-api_default`, làm theo phần 3 (đặt `PORTFOLIO_API_NETWORK` cho web).
2. Bật theo thứ tự `chat` -> `portfolio-api` -> web (phần 3-6), với `SITE_URL` là địa chỉ thật (build lại nếu trước đó build thiếu).
3. Cấu hình nginx theo mẫu: `access_log off` và `error_log /dev/null crit` cho `/i/`, `limit_req`, `X-Real-IP`; `nginx -t` rồi reload.
4. **Giới hạn IP cho `/admin` và `/api/admin/`** (cả ba location `/admin`, `= /api/admin/login`, `/api/admin/`): thay `192.0.2.1` trong mẫu bằng IP của bạn
   (thêm IPv6 nếu có), `nginx -t`, reload. Kiểm tra: từ một mạng khác (ví dụ 4G điện thoại) `https://ten-mien-cua-ban/admin` phải trả 403; từ máy bạn thì vào được.
5. Chạy các kiểm tra ở phần 10 (đặc biệt: `POST /api/chat/stream` không cookie phải trả 401; `docker compose logs` và log nginx không chứa mã link).
6. Mở `https://ten-mien-cua-ban/admin`, đăng nhập, tạo một link thử, mở nó trong cửa sổ ẩn danh: phải thấy thông báo "Link mời đã được kích hoạt...".
   Hỏi bot một câu, xem nhật ký của link, rồi thu hồi link đó.
7. **Kiểm tra trường hợp trình duyệt chặn cookie**: tạo một link thử khác, chặn cookie cho tên miền (ví dụ Chrome: Cài đặt > Quyền riêng tư > Cookie của bên thứ nhất
   bị chặn cho trang này, hoặc Safari với "Chặn mọi cookie"), mở link: phải thấy cảnh báo "Link mời hợp lệ nhưng trình duyệt chưa lưu được phiên..." chứ không phải
   thông báo thành công. Nếu được, thử cả trong trình duyệt nhúng của Zalo/Messenger. Thu hồi link thử.
8. **Twistfit chạy thật (chỉ khi bạn muốn bật; bỏ qua thì người xem chỉ thấy bản phát lại).** Mỗi lượt chạy gọi Flux thật và **tốn tiền**:
   1. Cấp `FLUX_API_KEY` (khoá BFL) và điền vào `.env` của `portfolio/api` (không bao giờ vào web).
   2. Chuẩn bị 1-6 ảnh người mẫu, 1-12 ảnh món đồ (bạn phải có quyền dùng ảnh; ảnh người thật cần sự đồng ý của họ) và `catalog.json` trong `portfolio/api/twistfit-assets/`,
      theo `twistfit-assets/README.md` và `catalog.example.json` ở đó. Thư mục phải đọc được với uid 10001 của container (`chmod a+rx twistfit-assets && chmod a+r twistfit-assets/*`).
   3. Tạo lại container để nạp khoá và ảnh: `cd /home/nuc/Documents/project/portfolio/api && docker compose up -d --force-recreate portfolio-api`.
      Kiểm tra `docker compose logs portfolio-api` không có dòng warning về danh mục; `/v1/session` của một phiên hợp lệ phải báo `twistfit: true`.
   4. Trên `/admin` tạo một link thử **có đặt "Tối đa lượt Twistfit"** (ví dụ 2), mở nó trong cửa sổ ẩn danh, đi hết 3 bước (chọn đồ, chọn người mẫu, tạo ảnh) và chạy **MỘT lượt thật**.
      Lượt này cũng xác minh giả định về miền URL polling của BFL (xem `README.md` của `portfolio/api`); nếu sai thì lượt báo "lỗi", không có khoá nào bị lộ.
   5. Mở nhật ký của link trên `/admin`: phải có một sự kiện `twistfit` / thành công với chi tiết `Đồ đã chọn: ... · Người mẫu: ...` (chỉ tên, không có ảnh).
   6. Xem **chi phí** của lượt đó trên bảng điều khiển BFL và ghi lại để đặt `twistfit_max` hợp lý cho các link thật. Thu hồi link thử.
9. Ghi các mẫu phát lại thật cho Knowledge Base (phần 12) để người không có link thấy dữ liệu thật thay vì mẫu giữ chỗ.
10. Điền hoặc xác nhận các nội dung chưa được xác nhận (phần 16), kể cả mục về Google Gemini và nơi Flux chạy.

## 8. Bật/tắt demo chat và Twistfit, tắt khẩn cấp

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

**Tắt Twistfit chạy thật (công tắc `TWISTFIT_LIVE_ENABLED`, ở `portfolio-api`).** Đây là cách chặn tiền Flux ngay: đặt `TWISTFIT_LIVE_ENABLED=false` trong `.env` của `portfolio/api` rồi tạo lại container
(biến chỉ được đọc lúc khởi động, nên **không** dùng `restart`):

```bash
cd /home/nuc/Documents/project/portfolio/api
# sửa .env: TWISTFIT_LIVE_ENABLED=false
docker compose up -d --force-recreate portfolio-api
curl -s localhost:3100/api/session     # (kèm cookie của một phiên mời) features.twistfit phải là false
```

Khi tắt, `/v1/session` báo `twistfit:false`, các tuyến Twistfit trả 503 `demo_disabled`, và người xem (kể cả người có link) thấy bản phát lại. Các tính năng khác (chat, link, nhật ký) không bị ảnh hưởng.
Gỡ `FLUX_API_KEY` khỏi `.env` rồi tạo lại container cũng tắt được. Tạo lại container làm mất job Twistfit đang chạy (chấp nhận được). Bật lại: đặt `TWISTFIT_LIVE_ENABLED=true` (hoặc xoá dòng đó) và tạo lại container.
Nếu nghi một link bị lạm dụng: thu hồi link trên `/admin` (có hiệu lực ngay cho lời gọi kế tiếp; job đang chạy vẫn xong vì tiền Flux đã tiêu).

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
   Hai đồng hồ: phía `portfolio-api` là `ADMIN_SESSION_TTL_MINUTES` (mặc định 120); cookie `pf_admin` của web trượt cố định 7200 giây mỗi lần thao tác thành công
   (hằng số trong mã web, biến kia không đổi được nó). Giữ `ADMIN_SESSION_TTL_MINUTES=120` để hai bên khớp; đặt khác thì phiên thực tế theo bên nào hết trước.
   Sai mật khẩu nhiều lần bị chặn tạm (429): 5 lần/15 phút cho mỗi IP và 60 lần/15 phút cho cả hệ thống (mọi lần thử đều tính, kể cả lần đúng).
   **Nếu bị khoá** (kể cả do người khác dò mật khẩu): chờ hết cửa sổ 15 phút, hoặc xoá bộ giới hạn (nằm trong bộ nhớ) bằng cách tạo lại container,
   trong thư mục `portfolio/api`:

   ```bash
   docker compose up -d --force-recreate portfolio-api
   ```

   `docker compose up -d` trơn **không làm gì** khi cấu hình không đổi (container cũ vẫn chạy, bộ giới hạn còn nguyên). Khi `.env` không đổi,
   `docker compose restart portfolio-api` cũng xoá được bộ giới hạn (nhưng `restart` không nạp giá trị mới nếu bạn vừa sửa `.env`; khi đó dùng lệnh trên).
   Cả hai cách đều xoá mọi phiên quản trị; link, phiên người xem và nhật ký giữ nguyên. Cách phòng chính là giới hạn IP ở nginx (phần 6, bắt buộc theo phần 7);
   nếu chính bạn bị danh sách `allow` chặn vì IP đổi, xem "Khi IP của bạn đổi" ở phần 6.
2. **Tạo link**: nhập tên gợi nhớ (ví dụ tên công ty/người nhận; 1..80 ký tự), tuỳ chọn ngày hết hạn. Link đầy đủ `SITE_URL/i/<mã>` **chỉ hiện đúng một lần**:
   sao chép ngay rồi gửi cho người nhận. Hệ thống chỉ lưu băm của mã nên không ai (kể cả bạn) xem lại được; lỡ mất thì thu hồi và tạo link mới.
3. **Bảng link**: tên, trạng thái (`active` đang dùng, `unused` chưa ai mở, `revoked` đã thu hồi, `expired` hết hạn), thời điểm tạo/hết hạn/lần dùng cuối, số lần dùng thành công.
4. **Nhật ký từng link**: mở một link để xem các sự kiện mới nhất trước.
5. **Thu hồi**: có hiệu lực **ngay** với mọi phiên đã mở từ link đó (câu hỏi kế tiếp bị từ chối, demo quay về bản phát lại). Không hoàn tác được; cần thì tạo link mới.

Người nhận mở link: trình duyệt nhận cookie `pf_session` (HttpOnly, 30 ngày hoặc tới khi link bị thu hồi/hết hạn) và được chuyển về `/?invite=ok`; trang chủ
hiện "Link mời đã được kích hoạt...", hoặc cảnh báo bật cookie / mở bằng trình duyệt chính nếu trình duyệt không giữ phiên. Mã sai, sai dạng, đã thu hồi hay hết hạn
đều chuyển về `/?invite=invalid` (không lộ lý do). Khi không mở được vì sự cố (`portfolio-api` tắt hay quá tải, bị giới hạn tần suất, sai khoá nội bộ) thì chuyển
về `/?invite=unavailable`: "Không mở được link lúc này. Hãy thử lại sau ít phút." (không nói gì về mã).

**Công cụ xem trước link**: khi link được dán vào Slack, Zalo, Messenger, LinkedIn, iMessage, ... các công cụ đó tự tải link để tạo bản xem trước. Web nhận ra
các công cụ quen biết qua User-Agent (danh sách `PREVIEW_BOT_PATTERNS` trong `src/lib/server/preview-bots.ts`, cần cập nhật dần) và cả yêu cầu `HEAD`: chúng
chỉ nhận một trang trung tính, **không** đổi mã, không ghi `open`, không gọi `portfolio-api`. Giới hạn: công cụ quét email hay cổng bảo mật giả làm trình duyệt
thường (ví dụ Outlook Safe Links, vài trình quét link trong Gmail) vẫn có thể được tính là một lần "Mở link" (và tạo một phiên không ai dùng).
Trang `/admin` có ghi chú này dưới nhật ký.

### Nhật ký chứa gì

- **Có**: link nào, thời điểm (UTC), tính năng (`open` mở link, `chat` hỏi bot, `twistfit` ghép đồ), kết quả (`success`, `error`, `blocked`) và chi tiết kỹ thuật ngắn do hệ thống đặt (ví dụ mã lỗi).
  Một `open` có thể do công cụ quét email/xem trước link giả làm trình duyệt gây ra (xem trên).
- **Twistfit trong nhật ký**: lượt thành công hiện `Đồ đã chọn: <tên các món> · Người mẫu: <tên>` (tên tiếng Việt lấy từ `catalog.json`); lượt lỗi hay bị chặn hiện nhãn tiếng Việt của mã lỗi
  (`flux_timeout` "Flux quá thời gian chờ", `flux_failed` "Flux báo lỗi", `flux_moderated` "Flux từ chối nội dung", `flux_unavailable` "Không gọi được Flux",
  `twistfit_limit` "Hết lượt Twistfit của link", `concurrent_limit`/`global_concurrent_limit`/`busy` "Đang bận", `cancelled` "Bị huỷ khi dịch vụ tắt"); mã lạ hiện nguyên văn.
  Mỗi lượt chạy đúng một sự kiện. Lượt lỗi sau khi Flux đã được gọi vẫn có thể bị BFL tính phí nhưng không tính vào `twistfit_max`.
- **Không bao giờ có**: nội dung câu hỏi hay câu trả lời, ảnh (kể cả ảnh người mẫu, món đồ và ảnh kết quả của Twistfit), địa chỉ IP, chuỗi trình duyệt (user agent), mã link gốc hay mã phiên (CSDL chỉ lưu băm SHA-256).
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
curl -s -w ' %{http_code}\n' localhost:3100/api/twistfit/catalog                             # {"code":"invite_required"} 401 (không cookie: không lộ danh mục, không chạm Flux)
curl -s -i -A 'Mozilla/5.0' localhost:3100/i/khong-phai-ma-that | grep -i -E '^(HTTP|location|set-cookie)'   # 307, location .../?invite=invalid, không set-cookie
curl -s -i localhost:3100/i/khong-phai-ma-that | grep -i -E '^(HTTP|location|set-cookie|x-robots)'          # curl là "công cụ xem trước": 200, x-robots-tag: noindex, không location/set-cookie
curl -s -I localhost:3100/admin | grep -i -E '^(x-frame-options|content-security-policy)'                 # DENY và frame-ancestors 'none'
curl -s localhost:3100/vi | grep -o '<link rel="canonical"[^>]*>'   # phải là https://ten-mien-cua-ban/vi
```

Qua nginx (từ ngoài), lặp lại dòng `POST /api/chat/stream` và dòng `GET /api/twistfit/catalog` với `https://ten-mien-cua-ban`: phải là 401.

Kiểm tra log không chứa mã link: sau khi tạo và mở (qua nginx) một link thử, tìm mã đó trong log của cả hai service **và** trong access log lẫn error log của nginx
trên host (không được thấy gì; các lệnh compose cần `.env`, phần 2):

```bash
cd /home/nuc/Documents/project/portfolio/web && docker compose logs portfolio | grep -c '<mã>'       # 0
cd /home/nuc/Documents/project/portfolio/api && docker compose logs portfolio-api | grep -c '<mã>'  # 0
sudo grep -r '<mã>' /var/log/nginx/                                                                  # không in gì (cả access.log lẫn error.log)
```

Nếu cấu hình nginx ghi log ở nơi khác (`access_log`/`error_log` trỏ tới file khác, syslog, journald), tìm cả ở đó. Thu hồi link thử sau khi kiểm tra.

Khi `chat` tắt hoặc không với tới được, `/api/chat/status` trả `{"enabled":false}`: người có link thấy bảng "demo tạm nghỉ", người không có link vẫn thấy bản phát lại.
Khi `portfolio-api` tắt: mọi người đều thấy bản phát lại, `/i/<mã>` chuyển về `/?invite=unavailable` ("thử lại sau ít phút", không phải "link không còn hiệu lực"),
phần còn lại của site vẫn chạy.

## 11. Sao lưu và khôi phục SQLite

Toàn bộ dữ liệu của `portfolio-api` là một file SQLite trong volume `portfolio-api_portfolio_data`. Các lệnh dưới chạy trong `portfolio/api` và cần `.env` (phần 2). Lệnh sao lưu nóng (nhất quán, trong container) và khôi phục nằm ở mục
"Sao lưu SQLite" và "Khôi phục từ bản sao lưu" của `README.md` trong repo `portfolio/api`. Tóm tắt:

```bash
cd /home/nuc/Documents/project/portfolio/api
docker compose exec portfolio-api python -c "import sqlite3;s=sqlite3.connect('/data/portfolio.sqlite');d=sqlite3.connect('/data/backup.sqlite');s.backup(d)"
docker compose cp portfolio-api:/data/backup.sqlite ./backup.sqlite && chmod 600 ./backup.sqlite
docker compose exec portfolio-api rm -f /data/backup.sqlite
```

Khôi phục: dừng dịch vụ, chép bản sao lưu đè lên file CSDL, **luôn** trả quyền sở hữu file cho uid 10001 (người dùng của container; file chép bằng
`docker compose cp` không tự thuộc uid đó), xoá các file `-wal`/`-shm` cũ, rồi khởi động lại:

```bash
cd /home/nuc/Documents/project/portfolio/api
docker compose stop portfolio-api
docker compose cp ./backup.sqlite portfolio-api:/data/portfolio.sqlite
docker compose run --rm --no-deps -u 0 --entrypoint chown portfolio-api 10001:10001 /data/portfolio.sqlite
docker compose run --rm --no-deps --entrypoint sh portfolio-api -c "rm -f /data/portfolio.sqlite-wal /data/portfolio.sqlite-shm"
docker compose up -d
```

`docker compose cp` hoạt động cả khi container đã dừng. Mọi phiên quản trị bị xoá khi khởi động lại; link, phiên người xem và nhật ký lấy theo bản sao lưu.
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

Twistfit có **hai** bộ ảnh khác nhau, đừng nhầm:

- **Bản chạy thật** (người có link mời) dùng ảnh người mẫu và món đồ trong `portfolio/api/twistfit-assets/` (kèm `catalog.json`; phần 7, mục 8). Ảnh này nằm ngoài git và chỉ `portfolio-api` đọc.
- **Bản phát lại** (người không có link) **vẫn dùng ảnh giữ chỗ** trong `public/replays/twistfit/` cho tới khi bạn thay bằng ảnh thật của một lần chạy. Hiện chưa có script lưu một lượt chạy thật thành mẫu phát lại; thay bằng tay:

Làm theo `public/replays/twistfit/README.md` (chọn một `TryOnJob` đã `done`, đặt ảnh vào thư mục, sửa `src/content/replays/twistfit.ts`, bỏ chữ "(minh hoạ)" khi số liệu là thật).
Khi **mọi mẫu** đã có `placeholder: false`, băng "ảnh giữ chỗ" và chữ "(minh hoạ)" trong demo phát lại (phần người không có link thấy) tự biến mất (trạng thái này tính từ chính dữ liệu mẫu, không có cờ riêng nào phải đồng bộ).
Thẻ dự án và dòng nhãn (eyebrow) đầu trang chi tiết của Twistfit **không** mang nhãn "giữ chỗ": chúng luôn mang nhãn "Chạy thật · cần link mời" (vì demo là chạy thật khi có link); chỉ phần phát lại bên trong demo mới có nhãn giữ chỗ.
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
     và thêm một bọc component trong `src/components/demos/replay-demos.tsx` bằng cách sao chép bọc có sẵn (`GiaPhaSimulationDemo`): component nhận `{ locale }`
     và truyền `definition` (dữ liệu mẫu của bạn), `kind` (`"replay"` hoặc `"simulation"`) và `locale` cho `<ReplayDemo>`; đăng ký bọc đó trong `replayDemoComponents` cùng file (không cần sửa `registry.ts`).
4. Các test có ghi tên slug hay khoá demo cụ thể (không có test nào đếm tổng số dự án):
   - `src/content/registry.test.ts`: danh sách khoá demo truyền cho `validateProjects` (thêm khoá mới của bạn vào đó); các test khác chỉ kiểm tra ba slug hiện có (`knowledge-base`, `twistfit`, `gia-pha`) vẫn có mặt và Knowledge Base đứng đầu.
   - `src/components/demos/ReplayDemo.test.tsx` (test "demo registry"): liệt kê đúng các khoá trong `demoComponents`; thêm khoá mới vào.
   - `src/components/demos/registry.test.ts`: tự kiểm tra khoá trong `replaysByDemoComponent` và `replayDemoComponents` (`replay-demos.tsx`) trùng nhau; đăng ký thiếu một bên là test hỏng.
   - `src/content/replays/placeholder.test.ts` ghi tên `twistfit`, `knowledge-base`, `gia-pha` để kiểm tra nhãn giữ chỗ của dữ liệu phát lại; `src/components/ProjectCard.test.tsx` kiểm tra nhãn trên thẻ
     (Twistfit mang "Chạy thật · cần link mời" và **không** có chip giữ chỗ trên thẻ; Gia phả và Knowledge Base cũng không có). Không cần sửa khi thêm dự án.
5. Chạy `npx vitest run && npm run build`, rồi build lại image.

Liệt kê mọi giá trị còn `TODO:`:

```bash
grep -rn "TODO:" src/content
```

## 16. Quy tắc trung thực cần giữ

- **Nhãn theo loại demo**: `live` = chạy thật khi người xem hỏi (với Knowledge Base và Twistfit: chỉ khi có link mời có bật tính năng; người khác thấy bản phát lại); `replay` = phát lại từ một lần chạy thật đã ghi;
  `simulation` = mô phỏng một tính năng chưa hoàn thành. Đừng gắn nhãn cao hơn sự thật (ví dụ không gắn "chạy thật" cho thứ chỉ phát lại).
- **Twistfit nay là "chạy thật · cần link mời"** (`demoKind: "live"`): thẻ và trang chi tiết mang nhãn đó, và chỉ người có link mời có `twistfit: true` mới thấy bản chạy thật (gọi Flux thật, mỗi lượt đúng một lệnh gọi). Người không có link thấy **bản phát lại**,
  nhãn nêu rõ đó là ảnh giữ chỗ chứ không phải kết quả thật. Đừng gỡ nhãn "cần link mời" và đừng nói Twistfit chạy thật với mọi người xem.
- **Ảnh giữ chỗ** của bản phát lại Twistfit và mẫu giữ chỗ Knowledge Base phải giữ nhãn "giữ chỗ" và chữ "(minh hoạ)" trong phần phát lại cho tới khi thay bằng dữ liệu thật (phần 12, 13).
  Test dữ liệu sẽ báo lỗi nếu cờ `placeholder` không nhất quán với ảnh và chữ.
- **Gia phả** là mô phỏng một tính năng AI đang phát triển (chưa xây), không được trình bày như sản phẩm đã có. Việc đọc ảnh và bản quét tài liệu gia phả mới là kế hoạch.
- **Dữ liệu Knowledge Base là giả lập**; giữ cụm "dữ liệu giả lập" / "synthetic data" trong mô tả.
- **Quyền riêng tư**: nội dung câu hỏi không bao giờ được lưu; nhật ký chỉ ghi link, tính năng, thời điểm và kết quả (phần 9). Đừng viết trên trang rằng "không ghi lại gì cả".
  Câu hỏi được gửi tới **Google Gemini** để tạo câu trả lời, và ghi chú trên demo nói rõ điều đó ("Câu hỏi được gửi tới Google Gemini để tạo câu trả lời.").
- Không đưa thông số Flux, prompt hay thời gian từng bước nếu bản ghi thật không có.

### Nội dung chưa được xác nhận (cần bạn điền hoặc quyết định)

- **Hosting của Flux**: vẫn chưa xác nhận Flux chạy ở đâu (BFL API hay chỗ khác); không viết ra nơi chạy lên site cho tới khi bạn xác nhận. Ghi chú quyền riêng tư của Twistfit chỉ nói điều đã biết: ảnh người mẫu và món đồ của chủ trang được gửi tới dịch vụ ghép ảnh; người xem không tải gì lên.
- **Quyền dùng ảnh Twistfit**: ảnh người mẫu và món đồ trong `twistfit-assets/` phải là ảnh bạn có quyền dùng (ảnh người thật cần sự đồng ý của họ), vì chúng được gửi tới Flux và kết quả hiện cho người có link.
- **Google Gemini lưu câu hỏi bao lâu, có dùng để huấn luyện không**: tuỳ tài khoản Google và gói (miễn phí hay trả phí) của khoá `GEMINI_API_KEY`. Hãy kiểm tra điều khoản
  của gói bạn dùng và xác nhận; nếu gói đó cho Google giữ hay dùng dữ liệu, cân nhắc ghi thêm điều đó vào ghi chú quyền riêng tư (`kb.notes.privacy`) hoặc đổi sang gói trả phí.
- **Liên kết repo**: cả ba dự án đang để `links: []` (có `TODO:` trong `src/content/projects/*.ts`); chỉ thêm khi bạn xác nhận repo được công khai.
- **Thông tin cá nhân** trong `src/content/site.ts`: tên, giới thiệu, email, GitHub đang là `TODO:`; `cv` là `null`.
- **Câu định vị ở phần mở đầu trang chủ** (`home.hero.headline` trong `messages/vi.json` và `messages/en.json`: "Tôi xây hệ thống LLM và agent, cùng các sản phẩm web xung quanh chúng." / "I build LLM and agent systems, and the web products around them."):
  do người dựng site viết thay bạn; hãy xác nhận hoặc viết lại.

### Việc cần làm tiếp

- **Script lưu một lần chạy thật của Twistfit làm mẫu phát lại** (tương tự `npm run record:kb`): chưa làm. Cho tới khi có, bản phát lại Twistfit dùng ảnh giữ chỗ và bạn thay bằng tay (phần 13).
- **Gia phả live**: Gia phả vẫn là mô phỏng (phần 16). Chạy thật cần xây tính năng đọc ảnh/bản quét gia phả trước; chưa có kế hoạch cụ thể.
- **Twistfit chạy thật qua link mời** (tính năng `twistfit`, trần `twistfit_max` mỗi link) đã có ở web và `portfolio-api` (phần 7 mục 8 là việc bật lần đầu). Chưa có giới hạn tần suất riêng của nginx cho `/api/twistfit/*`
  (nằm trong `location /`): các chốt chặn là phiên mời, `twistfit_max`, 1 job đồng thời mỗi link và 2 toàn hệ thống.
- **Markdown trong câu trả lời của bot**: Gemini hay trả lời bằng markdown, còn demo hiển thị chữ thuần (an toàn, không chèn HTML). Chọn một trong hai: yêu cầu backend (system prompt) trả lời bằng chữ thuần, hoặc sau này hiển thị một tập con markdown an toàn ở frontend.
