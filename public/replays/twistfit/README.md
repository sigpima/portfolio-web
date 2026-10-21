# Ảnh demo phát lại Twistfit

Các file `.svg` trong thư mục này là **ảnh giữ chỗ** (hình trừu tượng, không phải ảnh thật).
Ba mẫu trong `src/content/replays/twistfit.ts` đều có `placeholder: true`, nên trang hiện băng
"ảnh giữ chỗ" trên mọi ảnh, và các dữ kiện của mẫu (dịp, phong cách, món đồ, tổng thời gian) chỉ là minh hoạ.

## Thay bằng ảnh của một lần chạy thật

Làm cho từng mẫu (`work-minimal`, `weekend-casual`, `evening-elegant`, hoặc đổi tên mẫu cho khớp lần chạy):

1. **Chọn một bản ghi `TryOnJob` có trạng thái `done`** trong Twistfit. Chỉ dùng ảnh mà bạn có quyền
   công khai (ảnh người mẫu, ảnh quần áo, ảnh kết quả). Xoá thông tin cá nhân hay metadata (EXIF) trước khi đưa lên.
2. **Đặt ảnh vào thư mục này**, theo quy ước tên:
   - `<mã-mẫu>-model.jpg`: ảnh người mẫu đã dùng cho lượt đó;
   - `<mã-mẫu>-garment-1.jpg`, `<mã-mẫu>-garment-2.jpg`, ...: từng món đồ đã được chọn;
   - `<mã-mẫu>-result.jpg`: ảnh kết quả Flux trả về.

   Ví dụ: `work-minimal-model.jpg`, `work-minimal-garment-1.jpg`, `work-minimal-result.jpg`.
   Nên để ảnh dọc tỉ lệ 3:4 (ví dụ 600×800) và nén dưới khoảng 200 KB mỗi ảnh.
3. **Sửa mẫu trong `src/content/replays/twistfit.ts`**:
   - đổi `src` của từng ảnh sang file mới, viết lại `alt` (vi và en) mô tả đúng ảnh thật;
   - điền dữ kiện thật của bản ghi vào `steps({...})`: `occasion` (dịp), `style` (phong cách),
     `garments` (các món đồ đã chọn), `model` (ảnh người mẫu nào), `totalSeconds` = `updated_at - created_at`
     của job (làm tròn giây);
   - trong chi tiết bước cuối, bỏ chữ "(minh hoạ)" / "(illustrative)" khi số giây là số thật;
   - đổi `placeholder: true` thành `placeholder: false`.
4. **Chỉ dùng dữ kiện có trong bản ghi job.** Không đưa tham số Flux, prompt, hay thời gian từng bước
   (bản ghi không có các số đó; `atMs` chỉ là nhịp hoạt ảnh).
5. Chạy `npx vitest run src/content src/components/demos` để kiểm tra. Test dữ liệu kiểm tra **tính nhất quán**
   của cờ `placeholder`, không bắt buộc giá trị nào:
   - mẫu `placeholder: true`: mọi `alt` phải chứa "giữ chỗ" (vi) / "placeholder" (en), và chi tiết bước phải có
     "(minh hoạ)" / "(illustrative)";
   - mẫu `placeholder: false` (dữ liệu thật): không ảnh nào được trỏ tới các SVG giữ chỗ có sẵn
     (`model.svg`, `garment-*.svg`, `result-*.svg`), và không chi tiết nào còn chữ "(minh hoạ)" / "(illustrative)".

   Khi `placeholder` là `false`, nhãn "Phát lại từ lần chạy thật" hiện mà không kèm thẻ "Ảnh và dữ kiện giữ chỗ"
   và băng "ảnh giữ chỗ"; vì vậy chỉ đổi cờ khi ảnh và dữ kiện đều đã là của lần chạy thật.

Khi mọi mẫu đã dùng ảnh thật, có thể xoá các file `.svg` giữ chỗ không còn được tham chiếu.
