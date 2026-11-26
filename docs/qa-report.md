# Báo cáo Kiểm thử, Sửa lỗi và Hoàn thiện Tương tác — TripLoom Frontend

- **Thư mục dự án:** `F:\DATN CODE\FE`
- **Thư mục thiết kế đối chiếu (chỉ đọc):** `C:\Users\Bi\Downloads\GIAO DIỆN`
- **Ngày thực hiện:** `2026-11-25`
- **Ngăn xếp công nghệ:** TypeScript `5.7` (`strict: true`, `noUncheckedIndexedAccess: true`), Vite `6.4`, HTML ngữ nghĩa, Tailwind CSS `3.4`, Vitest `2.1`
- **Trình quản lý gói:** `npm` (xác định từ `package-lock.json`; sử dụng `npm.cmd` trên Windows PowerShell)

---

## 1. Kết quả chạy kiểm tra kỹ thuật (Typecheck, Lint, Test, Build)

| Hạng mục | Lệnh thực thi | Kết quả | Chi tiết |
|---|---|---|---|
| **TypeScript (`strict`)** | `npm.cmd run typecheck` (`tsc --noEmit`) | **PASS (exit 0)** | Bật đầy đủ `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess`. Không sử dụng `@ts-ignore` hoặc ép kiểu `any` che lỗi. |
| **Lint** | *(Không có script `lint` riêng trong `package.json`)* | **Ghi nhận** | Dự án không cài thêm ESLint/Biome để tránh tự ý nâng cấp/thêm bộ công cụ ngoài phạm vi; chất lượng mã được kiểm soát trực tiếp qua `tsc --noEmit` ở chế độ nghiêm ngặt nhất và rà soát tĩnh toàn bộ `src/`. |
| **Unit & Integration Tests** | `npm.cmd test` (`vitest run`) | **PASS (7 file / 21 test)** | Kiểm thử các quy tắc nghiệp vụ cốt lõi và lớp HTTP/API adapter (xem Mục 5). |
| **Production Build** | `npm.cmd run build` (`tsc --noEmit && vite build`) | **PASS (exit 0)** | Đóng gói `93` module ra `dist/`, tách chunk theo từng trang/service, `DevToolbar` được tách thành chunk động riêng chỉ nạp khi bật chế độ công cụ phát triển. |

---

## 2. Đối chiếu Route, Trang, Modal, Drawer và Trạng thái (`docs/screen-map.json`)

Toàn bộ **46 hạng mục** từ bộ thiết kế Google Stitch (`C00` + 45 màn hình/biến thể) đã được rà soát đối chiếu thực tế:

- **Khu vực Công khai (`PublicShell`):**
  - `/` (`P01` Trang chủ), `/dia-diem` (`P02` Tìm kiếm & lọc địa điểm), `/dia-diem/:id` (`P03` Chi tiết địa điểm & đánh giá), `/dich-vu/:id` (`P04` Chi tiết dịch vụ có thể đặt).
- **Xác thực & OTP (`T01`–`T06`):**
  - `/dang-nhap` (`T01`), `/dang-ky` (`T02`), `/dang-ky/xac-thuc` (`T03`), `/quen-mat-khau` (`T04`), `/quen-mat-khau/dat-lai` (`T05`), `/kich-hoat-nhan-vien` (`T06`).
- **Không gian Cá nhân (`MemberShell` — `U01`–`U12`):**
  - `/ca-nhan` (`U01`), `/ca-nhan/ho-so` (`U02`), `/lap-lich-trinh` (`U03`), `/de-xuat` (`U04`), `/lich-trinh/nhap/:draftId` & `/lich-trinh/:id` (`U05` kèm drawer thêm/sửa điểm dừng `U06` và modal điều chỉnh bằng AI có xem trước `U07`), `/lich-trinh-cua-toi` (`U08` kèm modal nhân bản & modal xác nhận xóa `U09`), `/chat` & `/chat/:conversationId` (`U10`), `/yeu-thich` (`U11`), `/danh-gia-cua-toi` (`U12`).
- **Đặt dịch vụ & Thanh toán (`B01`–`B05`):**
  - `/dat-dich-vu/:serviceId` (`B01`), `/don-dich-vu` (`B02`), `/don-dich-vu/:bookingCode` (`B03`), `/thanh-toan/:bookingCode` (`B04`), `/thanh-toan/:bookingCode/ket-qua` (`B05`).
- **Backoffice Quản trị & Nhân viên (`BackofficeShell` — `A01`–`A17`):**
  - `/quan-tri` (`A01`), `/quan-tri/danh-muc` (`A02` kèm modal tạo/sửa), `/quan-tri/dia-diem` (`A03`), `/quan-tri/dia-diem/them` & `/quan-tri/dia-diem/:id/sua` (`A04`), `/quan-tri/dich-vu` (`A05`), `/quan-tri/dich-vu/them` & `/quan-tri/dich-vu/:id/sua` (`A06`), `/quan-tri/don-dich-vu` (`A07`), `/quan-tri/don-dich-vu/:bookingCode` (`A08`), `/quan-tri/danh-gia` (`A09` kèm drawer kiểm duyệt), `/quan-tri/thanh-toan` (`A11`), `/quan-tri/giao-dich/:eventId` (`A10`), `/quan-tri/ai-tri-thuc` (`A12`), `/quan-tri/nhan-vien` (`A13`), `/quan-tri/nhan-vien/them` (`A14`), `/quan-tri/nhan-vien/:staffCode` (`A13/A15/A16` kèm modal chỉnh quyền & khóa/mở khóa), `/quan-tri/nhat-ky` (`A17`).
- **Trang trạng thái hệ thống (`X01`):**
  - Hiển thị nhất quán cho `403` (truy cập trái quyền), `404` (route hoặc tài nguyên không tồn tại) và `500` (lỗi không mong đợi qua error boundary của router).

---

## 3. Các lỗi và điểm chưa nhất quán đã phát hiện & sửa chữa

1. **Tách biệt bản lịch trình đã lưu chính thức với thay đổi nháp (`U05` / `U06` / `U07`)**
   - **Nguyên nhân:** Trước khi sửa, thao tác sửa điểm dừng (`U06`) hoặc áp dụng gợi ý AI (`U07`) trên một lịch trình đã lưu (`isDraft === false`, ví dụ `LT001`) ghi đè trực tiếp mảng `days` của bản chính thức ngay trước khi người dùng bấm *"Lưu lịch trình"*.
   - **Khắc phục:** Bổ sung `pendingDraftDays` và `hasUnsavedChanges` trong `src/api/contracts/itinerary.ts`, `src/mocks/handlers/itinerary-handler.ts`, `src/api/adapters/*` và `src/features/itineraries/pages/ItineraryDetailPage.ts`. Mọi chỉnh sửa trên lịch trình đã lưu nay chỉ ghi vào vùng đệm nháp, hiển thị thanh cảnh báo *"Đang có thay đổi nháp chưa lưu chính thức"* cùng nút *"Khôi phục bản đã lưu"* (`discardItineraryChanges`), và chỉ cập nhật bản chính thức khi người dùng bấm *"Lưu lịch trình"*.

2. **Bảo toàn dữ liệu biểu mẫu khi lỗi gửi hoặc đổi tham số (`ChatPage`, `BookingConfirmPage`, `DestinationDetailPage`)**
   - **Nguyên nhân:** `ChatPage.ts` xóa trắng ô nhập tin nhắn trước khi `sendMessage` hoàn tất (làm mất nội dung khi AI/mạng lỗi); `BookingConfirmPage.ts` (`B01`) đặt lại tên/số điện thoại liên hệ về hồ sơ gốc khi đổi ngày hoặc số khách; `DestinationDetailPage.ts` (`P03`) tải lại toàn trang khi bấm Yêu thích làm mất nội dung nhận xét đang gõ dở.
   - **Khắc phục:** Giữ nguyên `draftMessage` và hiển thị lỗi tại chỗ `#chatInputErr` khi gửi chat thất bại; lưu cục bộ `contactNameState` / `contactPhoneState` ở `B01`; cập nhật trạng thái nút Yêu thích trực tiếp trên DOM tại `P02` và `P03` không tải lại trang.

3. **Xác thực số khách tại chỗ và chống nháy toàn trang ở Chi tiết dịch vụ (`P04`) & Wizard (`U03`)**
   - **Nguyên nhân:** `ServiceDetailPage.ts` âm thầm ép giá trị khách về `>= 1` và render lại toàn bộ khung trang bằng skeleton mỗi lần đổi ngày/số khách; `TripWizardPage.ts` gọi `render()` lại toàn bộ form trong sự kiện `change` khiến thao tác sửa ô nhập rồi bấm ngay *"Tiếp tục"* làm nút bị thay thế trước khi nhận sự kiện `click`.
   - **Khắc phục:** Ở `ServiceDetailPage.ts`, cập nhật bảng tóm tắt chỗ trống & tổng tiền trực tiếp tại chỗ, đồng bộ query `?date=...&guests=...`, hiển thị lỗi trường rõ ràng khi số khách `< 1` hoặc vượt `maxDailyCapacity` và khóa nút đặt dịch vụ. Ở `TripWizardPage.ts`, cập nhật khung tóm tắt chuyến đi trực tiếp (`updateSummaryInPlace`) mà không phá hủy nút điều hướng bước.

4. **Cảnh báo rời trang khi biểu mẫu quản trị đang sửa dở (`A04`, `A06`)**
   - **Nguyên nhân:** Nút *"Hủy"* và *"Quay lại"* trên form thêm/sửa Địa điểm (`DestinationFormPage.ts`) và Dịch vụ (`ServiceFormPage.ts`) thoát ngay lập tức dù quản trị viên đã nhập dữ liệu.
   - **Khắc phục:** Theo dõi cờ `isDirty` trên form và mở hộp thoại xác nhận (`openConfirmModal`) trước khi hủy thay đổi.

5. **Bắt lỗi bất đồng bộ `getOtpState` (`T03`, `T05`, `T06`) & hoàn thiện nhập OTP (`EmailCodeForm`)**
   - **Nguyên nhân:** Lời gọi `authService.getOtpState(...)` khi khởi tạo hoặc trong nhánh `catch` chưa có khối bảo vệ riêng khi mất mạng ở chế độ API; ô đầu tiên của OTP giới hạn `maxlength="1"` gây cản trở một số trình tự động điền mã 6 số trên thiết bị di động.
   - **Khắc phục:** Bọc `try/catch` an toàn cho mọi điểm gọi `getOtpState`, mở `maxlength="6"` cho ô đầu tiên kết hợp phân tách chuỗi tự động điền và cải thiện điều hướng phím `Backspace` / mũi tên trong `src/shared/components/EmailCodeForm.ts`.

6. **Bộ lọc khoảng ngày cho Nhật ký kiểm toán (`A17`)**
   - **Khắc phục:** Bổ sung bộ lọc *Từ ngày* (`#a17FromDate`) và *Đến ngày* (`#a17ToDate`) trong `src/features/staff/pages/AuditLogPage.ts`, kết nối trực tiếp vào `staffService.listAuditLogs`.

7. **Đồng bộ URL, liên kết lịch trình và trợ năng trên Trợ lý AI (`U10`), vị trí `DevToolbar` và mã hóa `screen-map.json`**
   - **Khắc phục:** Tự động đồng bộ URL `/chat/:conversationId` bằng `history.replaceState` ngay khi mở `/chat`, thêm pill mở nhanh lịch trình ngay trong bong bóng phản hồi AI khi phiên chat có liên kết lịch trình, bổ sung `aria-hidden="true"` cho icon trang trí để tránh rò rỉ chuỗi ligature vào cây trợ năng, chuyển nút thu gọn `Dev Tools` sang góc dưới bên trái để không che nút hành động bên phải, và chuẩn hóa lại mã hóa UTF-8 tiếng Việt cho `docs/screen-map.json`.

8. **Error Boundary cho Router & tách tải lười `DevToolbar`**
   - **Khắc phục:** Bổ sung `router.setErrorHandler` trong `src/app/router.ts` & `src/app/bootstrap.ts` để hiển thị trang lỗi `500` (`X01`) thân thiện nếu phát sinh ngoại lệ không lường trước; chuyển `DevToolbar` sang `import()` động chỉ khi `appEnv.enableDevTools === true`.

---

## 4. Phản hồi tương tác, chuyển động nhẹ và trợ năng đã bổ sung

- **Chuyển tiếp màn hình & lớp phủ mượt mà (`src/shared/styles/main.css`):**
  - Hiệu ứng vào trang nhẹ `.tl-page-enter` (`180ms`), nền mờ `.tl-backdrop-enter`, hộp thoại `.tl-modal-enter`, ngăn kéo `.tl-drawer-enter` / `.tl-drawer-left-enter`, thông báo `.tl-toast-enter` và nhịp nhấn nút Yêu thích `.tl-heart-pop`.
  - Phản hồi nhấn xúc giác nhẹ (`transform: scale(0.985)`) cho các nút bấm đang hoạt động.
- **Tôn trọng cấu hình giảm chuyển động (`prefers-reduced-motion: reduce`):**
  - Toàn bộ animation/transition tùy chỉnh tự động tắt hoàn toàn khi hệ điều hành hoặc trình duyệt bật chế độ giảm chuyển động.
- **Quản lý tiêu điểm (Focus Trap) & bàn phím cho Modal/Drawer (`Modal.ts`, `PublicShell.ts`, `MemberShell.ts`, `BackofficeShell.ts`):**
  - Bẫy tiêu điểm `Tab` / `Shift+Tab` bên trong `Modal` và `Drawer`, khóa cuộn nền `document.body`, gắn `aria-labelledby` / `aria-expanded`, đóng bằng phím `Escape` và trả focus về đúng phần tử kích hoạt sau khi đóng.
  - Nút xác nhận trong `openConfirmModal` hiển thị biểu tượng xoay chờ và tự vô hiệu hóa trong lúc xử lý bất đồng bộ để chống bấm đúp.
- **Khử trùng lặp Toast (`Toast.ts`):**
  - Khi người dùng bấm lặp nhanh cùng một thao tác (ví dụ sao chép nội dung chuyển khoản nhiều lần), hệ thống làm mới thời gian hiển thị và nháy nhẹ thông báo hiện tại thay vì xếp chồng nhiều toast giống hệt nhau.
- **Gợi ý vuốt ngang bảng dữ liệu trên màn hình nhỏ (`< 768px`):**
  - Các bảng quản trị nằm trong `.table-scroll-wrap` tự động hiển thị dòng chỉ dẫn *"Vuốt ngang để xem đầy đủ các cột →"* trên điện thoại mà không gây tràn ngang toàn trang.

---

## 5. Kiểm thử đã thực hiện (Tự động & Trình duyệt thực tế)

### 5.1. Bộ kiểm thử tự động Vitest (`tests/` — 7 file, 21 test case)
1. `tests/otp.test.ts` (3 tests): Hiệu lực OTP 5 phút, chờ gửi lại 60 giây, khóa đợt 15 phút sau lần gửi thứ 5 (mã thứ 5 vẫn dùng được 5 phút), chống dò email ở quên mật khẩu.
2. `tests/booking-payment.test.ts` (3 tests): Chống tạo đơn trùng theo `Idempotency-Key`, hết hạn giữ chỗ 15 phút theo `expiresAt` không tự gia hạn, luồng đối soát SePay `NEEDS_REVIEW` → xác nhận thủ công sang `PAID`/`CONFIRMED`.
3. `tests/itinerary.test.ts` (3 tests): Tạo lịch trình từ danh mục nội bộ, từ chối điểm dừng không còn khả dụng, tách biệt thay đổi nháp (`pendingDraftDays`) với bản đã lưu chính thức cho đến khi lưu hoặc khôi phục.
4. `tests/favorites-reviews-chat.test.ts` (3 tests): Thêm/xóa yêu thích tường minh (idempotent), đánh giá mới/sửa luôn về `PENDING` và chỉ `APPROVED` mới tính điểm trung bình, thử lại tin nhắn chat lỗi không nhân đôi câu hỏi của người dùng.
5. `tests/staff-rbac.test.ts` (2 tests): Vòng đời tạo nhân viên (`INVITED` → kích hoạt OTP → phân quyền → khóa phiên đăng nhập ngay khi `LOCKED` → ghi `AuditLog`), chặn `STAFF_PAYMENT_VIEW` gọi xác nhận đối soát thủ công (`403`).
6. `tests/route-guards.test.ts` (4 tests): Guard bảo vệ route cá nhân, quản trị viên và từng quyền nhân viên khi truy cập URL trực tiếp.
7. `tests/http-client-api-mode.test.ts` (3 tests): Kiểm tra `httpRequest` và `apiAdapter` với `422` (`field_errors`), ẩn chi tiết kỹ thuật `500`, truyền `Idempotency-Key`, không tự retry `POST`, không fallback về mock khi lỗi mạng, hỗ trợ `AbortController` và timeout `408`.

### 5.2. Kiểm thử trình duyệt trực tiếp (`http://localhost:5173`)
Đã khởi chạy máy chủ Vite và kiểm tra thực tế trên trình duyệt Chromium tích hợp qua các luồng và 3 kích thước khung nhìn (`1440×900`, `768×900`, `390×844`):
- **Điều hướng & lịch sử trình duyệt:** Mở URL trực tiếp, tải lại trang (refresh), Back/Forward (`/` ↔ `/dia-diem` ↔ `/dia-diem/HA001`), và kiểm tra đường dẫn không tồn tại `/duong-dan-khong-ton-tai` hiển thị đúng trang `404` (`X01`).
- **Tài nguyên & Console:** Toàn bộ ảnh SVG nội bộ trong `public/images/` hiển thị đầy đủ, không có request ảnh lỗi hay lỗi ngoại lệ chưa bắt trên giao diện.
- **Xác thực & OTP:** Đăng ký tài khoản mới → chuyển tới `/dang-ky/xac-thuc`, xác nhận đồng hồ đếm ngược 5 phút và 60 giây gửi lại giữ nguyên thời hạn thực tế sau khi refresh trang; quên mật khẩu hiển thị thông báo chung chống dò email; đăng nhập khách hàng, quản trị viên và nhân viên.
- **Khám phá, Yêu thích, Đánh giá & Dịch vụ:** Lọc theo khu vực, xóa chip lọc, chuyển trang phân trang tại `/dia-diem`; bấm Yêu thích phản hồi tức thì tại `/dia-diem/HA001`; gửi đánh giá chuyển về *"Chờ duyệt"*; kiểm tra nhập số khách không hợp lệ (`0`, `99`) tại `/dich-vu/SV001` hiển thị lỗi tại chỗ và khóa nút tiếp tục mà không nháy trang.
- **Lập lịch trình, Lưu/Nháp & Chat AI:** Đi trọn 3 bước `/lap-lich-trinh` (cập nhật tóm tắt trực tiếp, chuyển bước ngay lần bấm đầu tiên) → `/de-xuat` → sinh lịch trình nháp AI; mở `/lich-trinh/LT001` sửa hoạt động qua drawer `U06`, kiểm tra thanh cảnh báo thay đổi nháp và khôi phục bản đã lưu thành công; kiểm tra modal nhân bản/xóa bằng phím `Escape` tại `/lich-trinh-cua-toi`; kiểm tra `/chat` tự đồng bộ URL `/chat/:conversationId` và hiển thị pill liên kết lịch trình.
- **Đặt dịch vụ & Thanh toán:** Tạo đơn mới tại `/dat-dich-vu/SV001` → chuyển sang `/thanh-toan/:bookingCode` với đồng hồ 15 phút theo `expires_at`, kiểm tra khử trùng toast khi sao chép liên tiếp và kiểm tra nút *"Kiểm tra thanh toán"* đọc trạng thái qua service.
- **Backoffice & Phân quyền RBAC:** Kiểm tra với `admin@triploom.vn` (`/quan-tri`, modal `/quan-tri/danh-muc`, cảnh báo hủy dữ liệu đang nhập tại `/quan-tri/dia-diem/them`, drawer `/quan-tri/danh-gia`, bộ lọc ngày tại `/quan-tri/nhat-ky`); kiểm tra với `yen.do@triploom.vn` (`STAFF_PAYMENT_VIEW`) xác nhận ẩn menu trái quyền, chế độ chỉ đọc thanh toán và chặn `403` khi mở trực tiếp `/quan-tri/nhan-vien` hoặc `/quan-tri/danh-muc`.
- **Responsive (`1440×900`, `768×900`, `390×844`):** Xác nhận không tràn ngang toàn trang trên `/`, `/dia-diem`, `/lich-trinh/LT001` và `/quan-tri/thanh-toan`; bảng rộng cuộn ngang gọn trong `.table-scroll-wrap`; ngăn kéo menu di động ở cả 3 layout mở và đóng bằng phím `Escape` ổn định.

---

## 6. Sẵn sàng nối API Backend (`VITE_DATA_SOURCE=api`)

- Toàn bộ trang và component giao tiếp duy nhất qua các `*.service.ts` → `getDataSource()` (`mockAdapter` hoặc `apiAdapter`), không import trực tiếp fixture và không gọi `fetch` hay `localStorage` rải rác trong giao diện.
- `src/api/http-client.ts` tự động gắn `credentials: 'include'`, đọc cookie CSRF (`VITE_CSRF_COOKIE_NAME` / `VITE_CSRF_HEADER_NAME`) cho các phương thức thay đổi dữ liệu, hỗ trợ `Idempotency-Key` cho thao tác tạo đơn, hỗ trợ `AbortSignal` + timeout, và chuẩn hóa lỗi HTTP (`401`, `403`, `404`, `408`, `409`, `422`, `429`, `5xx`) mà không lộ chi tiết kỹ thuật máy chủ.
- Khi `VITE_DATA_SOURCE=api`, hệ thống tuyệt đối **không âm thầm chuyển về dữ liệu giả** nếu API trả lỗi hoặc mất kết nối.

---

## 7. Hạn chế còn lại & Lưu ý khi ghép Backend Django thật

1. **Chưa kiểm thử trực tiếp với máy chủ Django thật:** Do phạm vi công việc chỉ thực hiện trên frontend (`F:\DATN CODE\FE`) và backend Python/Django phát triển độc lập, chế độ `VITE_DATA_SOURCE=api` hiện được xác minh thông qua bộ kiểm thử `tests/http-client-api-mode.test.ts` (giả lập phản hồi `fetch` chuẩn REST) thay vì chạy end-to-end với server Django sống. Khi ghép nối thực tế, cần đối chiếu tên trường và đường dẫn trong `docs/api-contract.md` cũng như cấu hình CORS/CSRF cookie của Django.
2. **Dữ liệu giả lập ở chế độ `mock`:**
   - Gửi email OTP, sinh lịch trình/phản hồi Chat AI, ảnh QR chuyển khoản và sự kiện đối soát SePay hiện được mô phỏng cục bộ trong `src/mocks/` (kèm hộp công cụ `Dev Tools` chỉ bật ở môi trường phát triển).
   - Mốc ngày mẫu của dữ liệu seed (lịch trình và nhật ký kiểm toán demo) đang đặt ở đầu năm `2027` (`2027-01-14` đến `2027-01-16`) để luôn nằm ở tương lai khi trình diễn khóa luận; khi lọc ngày tại `/quan-tri/nhat-ky` trên dữ liệu seed gốc, nên chọn khoảng ngày quanh `01/2027` hoặc thực hiện thao tác quản trị mới để sinh bản ghi theo ngày hiện tại.
3. **Không có công cụ linter độc lập trong `package.json`:** Dự án hiện kiểm tra tĩnh bằng `tsc --noEmit` (`strict: true`); nếu nhóm phát triển muốn bổ sung quy tắc định dạng/style đồng nhất khi làm việc nhiều người, có thể cài thêm ESLint + Prettier trong một bước cấu hình riêng.
