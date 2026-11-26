# Hợp đồng API đề xuất giữa Frontend TripLoom và Backend Python/Django

> **LƯU Ý QUAN TRỌNG:** Tất cả các endpoint trong tài liệu này đang ở trạng thái **ĐỀ XUẤT** để thống nhất giữa nhóm Frontend và nhóm Backend Python/Django trước khi chuyển `VITE_DATA_SOURCE=api`. Tài liệu này **không** khẳng định backend đã triển khai sẵn các endpoint bên dưới.

---

## 1. Quy ước chung cần thống nhất với Django

| Hạng mục | Quy chuẩn đề xuất | Ghi chú thống nhất với Backend |
|---|---|---|
| Base URL | `VITE_API_BASE_URL` (mặc định `/api/v1` hoặc `http://localhost:8000/api/v1`) | Cấu hình CORS (`CORS_ALLOW_CREDENTIALS = True`) nếu FE và BE khác origin. |
| Xác thực & Phiên | Django Session Cookie (`credentials: 'include'`) | FE không lưu secret hay token nhạy cảm vào `localStorage`; mọi quyền do máy chủ trả về qua `/auth/session`. |
| Bảo vệ CSRF | Cookie `csrftoken` + Header `X-CSRFToken` | FE tự đọc cookie CSRF và gắn vào mọi request `POST`/`PUT`/`PATCH`/`DELETE`. |
| Định dạng tiền tệ | Số nguyên VND (`number`, ví dụ `300000`) | Không dùng số thập phân hoặc chuỗi đã định dạng; `null` nghĩa là **Chưa có thông tin giá**, `0` nghĩa là **Miễn phí**. |
| Ngày & Giờ | Ngày lịch: `YYYY-MM-DD`; Mốc thời gian: ISO-8601 (`2027-01-16T09:42:00+07:00`) | Múi giờ chuẩn `Asia/Ho_Chi_Minh`. FE hiển thị `dd/MM/yyyy` và giờ 24h. |
| Quy tắc ID | Chuỗi mã nghiệp vụ ổn định (`USR001`, `DN001`, `SV001`, `LT001`, `BK001`, `TAI0001`, `NV001`, `RV001`, `EVT001`) | Nếu Django dùng UUID/integer PK, có thể map qua adapter hoặc trả kèm trường `code`. |
| Phân trang | Request: `?page=1&page_size=10`; Response: `{ items, total, page, pageSize, totalPages }` | Cần thống nhất casing (`camelCase` hay `snake_case`) giữa DRF serializer và FE adapter. |
| Chống tạo trùng | Header `Idempotency-Key` cho `POST /bookings` | Máy chủ trả lại cùng booking nếu cùng `Idempotency-Key` được gửi lặp. |
| Xung đột đồng thời | `expectedVersion` (địa điểm, dịch vụ, lịch trình) hoặc `expectedUpdatedAt` (nhân viên) | Máy chủ trả HTTP `409 Conflict` nếu dữ liệu đã đổi. |

### 1.1. Quy ước chuẩn hóa lỗi từ Backend

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Thông báo tiếng Việt thân thiện cho người dùng cuối.",
  "field_errors": {
    "email": "Email đã tồn tại trên hệ thống."
  },
  "meta": {
    "resendAvailableAt": "2027-01-15T08:01:00+07:00"
  }
}
```

Các mã lỗi (`code`) FE đang xử lý thống nhất trong `src/api/errors.ts`:
`VALIDATION_ERROR`, `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `EXPIRED` (410), `INSUFFICIENT_CAPACITY`, `PRICE_CHANGED`, `ACCOUNT_LOCKED`, `ACCOUNT_NOT_ACTIVATED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_USED`, `OTP_MAX_ATTEMPTS`, `AI_ERROR`, `EMAIL_DELIVERY_FAILED`, `SERVER_ERROR`.

### 1.2. Enum trạng thái nghiệp vụ

- **BookingStatus:** `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `EXPIRED`
- **PaymentStatus:** `PENDING`, `PAID`, `FAILED`, `NEEDS_REVIEW`
- **PaymentEventStatus:** `RECEIVED`, `MATCHED`, `NEEDS_REVIEW`, `IGNORED`, `RESOLVED`
- **StaffAccountStatus:** `INVITED`, `ACTIVE`, `LOCKED`
- **ReviewStatus:** `PENDING`, `PUBLISHED`, `HIDDEN`
- **ActiveStatus (Catalog):** `ACTIVE`, `HIDDEN`
- **TravelPace:** `SLOW`, `MODERATE`, `FAST`
- **OtpPurpose:** `REGISTER`, `PASSWORD_RESET`, `STAFF_ACTIVATION`
- **StaffPermissionCode:** `STAFF_DESTINATION`, `STAFF_SERVICE`, `STAFF_BOOKING`, `STAFF_REVIEW`, `STAFF_PAYMENT_VIEW`

---

## 2. Các trường bắt buộc do Backend quyết định (FE tuyệt đối không tự tính làm nguồn tin cậy)

1. **Xác thực & phân quyền:** `role`, `staffStatus`, `permissions`, `authVersion`, và kiểm tra quyền sở hữu tài nguyên.
2. **OTP & giới hạn gửi:** `expiresAt` (5 phút), `resendAvailableAt` (60 giây), `burstLockedUntil` (15 phút sau lần 5), `sendsUsedInBurst`, `remainingAttempts`, vô hiệu mã cũ/hết lượt.
3. **Booking & thanh toán SePay:** `unitPriceSnapshotVnd`, `totalAmountVnd`, `paymentCode`, `expiresAt` (`createdAt + 15 phút`), `status`, `paymentStatus`, `canCustomerCancel`, `canStaffCancel`, kiểm tra sức chứa theo ngày, khớp webhook SePay.
4. **Lịch trình & AI:** `draftExpiresAt` (24 giờ), `version`, kết quả gợi ý AI, đánh dấu liên kết hội thoại khi xóa lịch trình.
5. **Nhật ký kiểm toán (Audit Log):** `timestamp`, `actorId`, `beforeSummary`, `afterSummary` (đã loại bỏ toàn bộ mật khẩu, OTP, token).

---

## 3. Danh sách Endpoint ĐỀ XUẤT theo từng Service

### 3.1. `authService` & `profileService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `getSession()` | `GET /auth/session` *(ĐỀ XUẤT)* | Public | Trả `{ authenticated, user }` theo cookie phiên hiện tại. |
| `login(req)` | `POST /auth/login` *(ĐỀ XUẤT)* | Public | Xác thực email + mật khẩu; từ chối `INVITED` / `LOCKED`. |
| `logout()` | `POST /auth/logout` *(ĐỀ XUẤT)* | Auth | Hủy phiên hiện tại trên Django. |
| `register(req)` | `POST /auth/register` *(ĐỀ XUẤT)* | Public | Kiểm tra dữ liệu, gửi OTP `REGISTER`; chưa tạo user chính thức. |
| `verifyRegister(req)` | `POST /auth/register/verify` *(ĐỀ XUẤT)* | Public | Xác thực mã 6 số, tạo tài khoản `MEMBER`. |
| `requestPasswordReset(req)` | `POST /auth/password-reset/request` *(ĐỀ XUẤT)* | Public | Luôn trả thông báo chung không tiết lộ email tồn tại. |
| `resetPassword(req)` | `POST /auth/password-reset/confirm` *(ĐỀ XUẤT)* | Public | Đổi mật khẩu, thu hồi mọi phiên cũ; không tự đăng nhập/mở khóa nhân viên. |
| `changePassword(req)` | `POST /auth/change-password` *(ĐỀ XUẤT)* | Auth | Đổi mật khẩu trực tiếp cho tài khoản đang đăng nhập sau khi xác minh mật khẩu hiện tại. |
| `activateStaff(req)` | `POST /auth/staff/activate` *(ĐỀ XUẤT)* | Public | Kích hoạt nhân viên `INVITED` → `ACTIVE` bằng mã `STAFF_ACTIVATION`. |
| `resendOtp(req)` | `POST /auth/otp/resend` *(ĐỀ XUẤT)* | Public | Gửi lại OTP theo hạn mức chung 60s / 5 lần / 15 phút. |
| `getOtpState(email, purpose)` | `GET /auth/otp/state` *(ĐỀ XUẤT)* | Public | Đọc mốc thời hạn còn lại từ máy chủ (refresh không reset đồng hồ). |
| `getProfile()` / `updateProfile(req)` | `GET/PUT /profile` *(ĐỀ XUẤT)* | Auth | Đọc và cập nhật hồ sơ + sở thích (email chỉ đọc). |

### 3.2. `destinationsService`, `servicesService`, `adminCatalogService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `listCategories(params)` | `GET /categories` *(ĐỀ XUẤT)* | Public / Admin | Danh mục công khai (`include_hidden=true` cho quản trị). |
| `upsertCategory(id, req)` | `POST /admin/categories` · `PUT /admin/categories/{id}` *(ĐỀ XUẤT)* | Admin | Thêm/sửa/ẩn danh mục (tên duy nhất, không xóa cứng). |
| `listDestinations(params)` | `GET /destinations` *(ĐỀ XUẤT)* | Public / Staff | Tìm kiếm, lọc khu vực/danh mục, phân trang. |
| `getDestinationDetail(id)` | `GET /destinations/{id}` *(ĐỀ XUẤT)* | Public / Staff | Chi tiết địa điểm, dịch vụ liên quan, đánh giá công khai + bản đánh giá của tôi. |
| `upsertDestination` / `toggleDestinationStatus` | `POST/PUT /admin/destinations...` · `PATCH .../status` *(ĐỀ XUẤT)* | Admin / `STAFF_DESTINATION` | Tạo/sửa có kiểm tra `expectedVersion`, ẩn/kích hoạt. |
| `listServices` / `getServiceDetail` | `GET /services` · `GET /services/{id}` *(ĐỀ XUẤT)* | Public / Staff | Thông tin dịch vụ và trạng thái còn nhận đặt. |
| `checkServiceAvailability` | `GET /services/{id}/availability?service_date=` *(ĐỀ XUẤT)* | Public | Trả sức chứa tối đa/ngày, số khách đã giữ, chỗ còn lại tham khảo. |
| `upsertService` / `toggleServiceStatus` | `POST/PUT /admin/services...` · `PATCH .../status` *(ĐỀ XUẤT)* | Admin / `STAFF_SERVICE` | Thay đổi giá chỉ áp dụng cho đơn mới. |
| `getDashboard()` | `GET /admin/dashboard` *(ĐỀ XUẤT)* | Admin / Staff | Số liệu và hàng đợi việc cần làm lọc theo đúng quyền tài khoản. |

### 3.3. `tripPlanningService`, `itinerariesService`, `chatService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `createTripRequest(input)` | `POST /trip-requests` *(ĐỀ XUẤT)* | Auth | Kiểm tra ngày/số ngày/số khách/ngân sách, trả `TripDraftRequest`. |
| `getRecommendations(id)` | `GET /trip-requests/{id}/recommendations` *(ĐỀ XUẤT)* | Auth | Xếp hạng địa điểm nội bộ kèm lý do phù hợp. |
| `generateDraftItinerary(id, picks)` | `POST /trip-requests/{id}/generate-draft` *(ĐỀ XUẤT)* | Auth | Gọi AI phía máy chủ tạo bản nháp 24 giờ (`isDraft: true`). |
| `getItinerary(id)` / `listMyItineraries` | `GET /itineraries/{id}` · `GET /itineraries` *(ĐỀ XUẤT)* | Auth (Owner) | Xem bản nháp/đã lưu và lịch sử các lịch trình đã lưu. |
| `upsertActivity` / `reorderOrDeleteActivity` | `POST/PATCH /itineraries/{id}/activities...` *(ĐỀ XUẤT)* | Auth (Owner) | Sửa thủ công U06, kiểm tra chồng giờ & `expectedVersion`. |
| `previewRegenerateDay` / `applyRegeneratedDay` | `POST /itineraries/{id}/days/{day}/regenerate-preview` & `apply-preview` *(ĐỀ XUẤT)* | Auth (Owner) | Tái tạo riêng 1 ngày (U07), trả Trước/Sau và chỉ áp dụng khi người dùng xác nhận. |
| `saveItinerary` / `cloneItinerary` / `deleteItinerary` | `POST .../save`, `POST .../clone`, `DELETE /itineraries/{id}` *(ĐỀ XUẤT)* | Auth (Owner) | Lưu chính thức, sao chép dịch ngày, xóa không xóa booking/chat. |
| `listConversations` / `createConversation` / `sendMessage` / `retryMessage` | `GET/POST /chat/conversations...` *(ĐỀ XUẤT)* | Auth (Owner) | Quản lý hội thoại theo ngữ cảnh chuyến đi; retry không nhân đôi tin nhắn. |

### 3.4. `favoritesService`, `reviewsService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `listFavorites` / `addFavorite` / `removeFavorite` | `GET /favorites` · `PUT/DELETE /favorites/{destId}` *(ĐỀ XUẤT)* | Auth | Thao tác thêm/xóa tường minh (idempotent, không dùng toggle). |
| `upsertMyReview` / `listMyReviews` | `PUT/GET /reviews/mine` *(ĐỀ XUẤT)* | Auth | 1 đánh giá/người/địa điểm; tạo mới hoặc sửa đều chuyển `PENDING`. |
| `listAdminReviews` / `moderateReview` | `GET /admin/reviews` · `POST /admin/reviews/{id}/moderate` *(ĐỀ XUẤT)* | Admin / `STAFF_REVIEW` | Chỉ đổi `PUBLISHED`/`HIDDEN` kèm lý do; không sửa nội dung/sao người dùng. |

### 3.5. `bookingsService`, `paymentsService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `createBooking(req)` | `POST /bookings` *(ĐỀ XUẤT)* | Auth | Kèm `Idempotency-Key`; kiểm tra sức chứa & giá hiện hành (`PRICE_CHANGED`); tạo booking + payment giữ 15 phút. |
| `listMyBookings` / `getMyBookingDetail` / `cancelMyBooking` | `GET /bookings...` · `POST /bookings/{id}/cancel` *(ĐỀ XUẤT)* | Auth (Owner) | Chỉ hủy được đơn `PENDING_PAYMENT` chưa có giao dịch cần đối soát. |
| `checkPaymentStatus(bookingId)` | `GET /payments/booking/{bookingId}/status` *(ĐỀ XUẤT)* | Auth (Owner) | Đọc trạng thái mới nhất từ máy chủ (tự đồng bộ hết hạn 15 phút). |
| `listAdminBookings` / `getAdminBookingDetail` / `addAdminBookingNote` / `adminCancelBooking` | `GET/POST /admin/bookings...` *(ĐỀ XUẤT)* | Admin / `STAFF_BOOKING` | Hỗ trợ vận hành booking, ghi chú và hủy đơn đủ điều kiện kèm lý do. |
| `listAdminPayments` / `listAdminPaymentEvents` / `getAdminPaymentEventDetail` | `GET /admin/payments` · `GET /admin/payment-events...` *(ĐỀ XUẤT)* | Admin / `STAFF_PAYMENT_VIEW` | Tra cứu payment & từng sự kiện SePay tách biệt (nhân viên chỉ đọc). |
| `reconcilePaymentEvent(eventId, req)` | `POST /admin/payment-events/{id}/reconcile` *(ĐỀ XUẤT)* | **Admin only** | Quyết định đối soát kèm lý do & nhật ký; chặn `STAFF_PAYMENT_VIEW` bằng `403`. |

### 3.6. `staffService`

| Thao tác FE | Endpoint ĐỀ XUẤT | Quyền | Mô tả ngắn |
|---|---|---|---|
| `listStaff` / `getStaffDetail` / `createStaff` / `updateStaff` | `GET/POST/PUT /admin/staff...` *(ĐỀ XUẤT)* | **Admin only** | Mã nhân viên & email chỉ đọc sau khi tạo; gửi email tách biệt kết quả tạo tài khoản. |
| `updateStaffPermissions` | `PUT /admin/staff/{id}/permissions` *(ĐỀ XUẤT)* | **Admin only** | Chỉ gán 5 nhóm quyền cho phép; tăng `auth_version` để thu hồi phiên cũ. |
| `lockOrUnlockStaff` | `POST /admin/staff/{id}/lock-state` *(ĐỀ XUẤT)* | **Admin only** | Khóa (`LOCKED`) hoặc mở khóa (`ACTIVE` nếu đã kích hoạt, `INVITED` nếu chưa kích hoạt). |
| `resendStaffActivation` | `POST /admin/staff/{id}/resend-activation` *(ĐỀ XUẤT)* | **Admin only** | Gửi lại mã kích hoạt cho nhân viên `INVITED` không tạo trùng tài khoản. |
| `listAuditLogs` | `GET /admin/audit-logs` *(ĐỀ XUẤT)* | **Admin only** | Nhật ký chỉ đọc đã lọc bỏ mật khẩu/OTP/token. |

---

## 4. Điểm cần thống nhất trước khi ghép Django Backend

1. **Casing JSON:** FE hiện sử dụng `camelCase` trong contract TypeScript. Nếu Django REST Framework trả `snake_case`, cần bổ sung bộ chuyển đổi trong `src/api/adapters/api-adapter.ts` (không sửa giao diện).
2. **Endpoint lấy CSRF cookie lần đầu:** Xác nhận Django có cấp sẵn `GET /api/v1/auth/csrf` hay gắn `csrftoken` ngay khi gọi `GET /api/v1/auth/session`.
3. **SePay Webhook phía Backend:** FE không gọi hay mô phỏng webhook thật ở chế độ `api`; backend chịu trách nhiệm xác thực chữ ký SePay, chống trùng transaction ref và cập nhật trạng thái đơn.
4. **Hành vi chuyển đổi `VITE_DATA_SOURCE=api`:** Khi chạy chế độ `api`, nếu backend trả lỗi hoặc không phản hồi, FE hiển thị thông báo lỗi rõ ràng và **tuyệt đối không tự fallback về dữ liệu mock**.
