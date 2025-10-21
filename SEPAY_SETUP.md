# 🏦 HƯỚNG DẪN CẤU HÌNH SEPAY

## Bước 1: Cài đặt thư viện

```bash
npm install axios
```

## Bước 2: Đăng ký Sepay

1. Truy cập: https://my.sepay.vn/
2. Đăng ký tài khoản doanh nghiệp
3. Liên kết tài khoản ngân hàng
4. Lấy API Token từ dashboard

## Bước 3: Cấu hình .env

Thêm các biến sau vào file `.env`:

```env
# Sepay Payment Gateway
SEPAY_ACCOUNT_NUMBER=0123456789
SEPAY_ACCOUNT_NAME=PHONG KHAM RANG HAI ANH
SEPAY_BANK_CODE=MB
SEPAY_API_TOKEN=your_sepay_api_token_here

# Webhook URL (để nhận thông báo từ Sepay)
SEPAY_WEBHOOK_URL=https://yourdomain.com/api/payments/webhook/sepay
```

### Danh sách mã ngân hàng (SEPAY_BANK_CODE):

- `MB` - MBBank
- `VCB` - Vietcombank  
- `TCB` - Techcombank
- `ACB` - ACB
- `VPB` - VPBank
- `TPB` - TPBank
- `STB` - Sacombank
- `VIB` - VIB
- `SHB` - SHB
- `BIDV` - BIDV

## Bước 4: Setup Webhook (quan trọng!)

### Development (localhost):

Sử dụng **ngrok** để tạo public URL:

```bash
# Cài ngrok
npm install -g ngrok

# Chạy ngrok
ngrok http 3000
```

Ngrok sẽ cho bạn 1 public URL như: `https://abc123.ngrok.io`

Update `.env`:
```env
SEPAY_WEBHOOK_URL=https://abc123.ngrok.io/api/payments/webhook/sepay
```

### Production:

```env
SEPAY_WEBHOOK_URL=https://yourdomain.com/api/payments/webhook/sepay
```

### Đăng ký webhook URL với Sepay:

1. Đăng nhập https://my.sepay.vn/
2. Vào mục **Cài đặt** > **Webhook**
3. Nhập URL webhook của bạn
4. Lưu lại

## Bước 5: Khởi động server

```bash
npm run dev
```

## Kiểm tra cấu hình

Server sẽ log khi khởi động:

```
✅ Sepay Config OK
   - Account: 0123456789
   - Bank: MB
   - Webhook: https://abc123.ngrok.io/api/payments/webhook/sepay
```

Hoặc nếu thiếu config:

```
⚠️  Cảnh báo Sepay Config:
   - SEPAY_ACCOUNT_NUMBER chưa được cấu hình
   - SEPAY_API_TOKEN chưa được cấu hình
```

---

## 📋 API Endpoints

### 1. Đặt lịch (tự động tạo QR)

**POST** `/api/appointments/consultation/create`

**Response (khi cần thanh toán):**
```json
{
  "success": true,
  "message": "Vui lòng thanh toán để hoàn tất đặt lịch...",
  "data": {
    "appointmentId": "...",
    "status": "PendingPayment",
    "requirePayment": true,
    "payment": {
      "paymentId": "...",
      "amount": 100000,
      "expiresAt": "2025-10-25T09:15:00.000Z",
      "QRurl": "https://img.vietqr.io/image/MB-0123456789-compact2.png?..."
    }
  }
}
```

### 2. Check payment status (user tự check)

**GET** `/api/payments/:paymentId/check`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (chưa thanh toán):**
```json
{
  "success": true,
  "message": "Chưa nhận được thanh toán",
  "data": {
    "payment": {...},
    "confirmed": false
  }
}
```

**Response (đã thanh toán):**
```json
{
  "success": true,
  "message": "Thanh toán thành công",
  "data": {
    "payment": {...},
    "appointment": {...},
    "confirmed": true
  }
}
```

### 3. Webhook từ Sepay (auto)

**POST** `/api/payments/webhook/sepay`

Endpoint này được Sepay tự động gọi khi có giao dịch mới.

### 4. Manual confirm payment (admin only)

**POST** `/api/payments/:paymentId/confirm`

**Headers:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

---

## 🧪 Test Flow

### Scenario: User đặt lịch tư vấn (cần thanh toán)

1. **User đặt lịch:**
   ```
   POST /api/appointments/consultation/create
   ```
   → Nhận response có QR code

2. **User quét QR và chuyển khoản:**
   - Số tiền: 100,000 VND
   - Nội dung: `APPOINTMENT 12AB34CD`

3. **Sepay nhận giao dịch:**
   → Gọi webhook về server
   → Server auto confirm payment
   → Update appointment status: `PendingPayment` → `Pending`
   → Gửi email xác nhận

4. **Hoặc user tự check:**
   ```
   GET /api/payments/{paymentId}/check
   ```
   → Nếu đã có giao dịch → auto confirm

---

## ⚠️ Lưu ý quan trọng

### 1. Nội dung chuyển khoản:
- Format: `APPOINTMENT {8 ký tự cuối của appointmentId}`
- Ví dụ: `APPOINTMENT 12AB34CD`
- **BẮT BUỘC** phải chính xác để hệ thống tracking

### 2. Thời gian giữ slot:
- Slot được giữ trong **15 phút** 
- Sau 15 phút không thanh toán → appointment bị hủy
- User khác có thể đặt slot đó

### 3. Race condition:
- User A đặt → slot bị lock 15 phút
- User B đặt cùng slot → bị reject
- User A thanh toán → confirm thành công
- User A không thanh toán → sau 15 phút slot tự động available

### 4. Webhook trong Development:
- **BẮT BUỘC** dùng ngrok hoặc tương tự
- Sepay cần public URL để gọi webhook
- Localhost không hoạt động

### 5. Testing không có API Token:
- Hệ thống vẫn tạo QR code (dùng VietQR API miễn phí)
- Nhưng KHÔNG thể auto-check giao dịch
- Cần manual confirm bởi admin

---

## 🐛 Troubleshooting

### Webhook không hoạt động:
1. Kiểm tra ngrok đang chạy
2. Kiểm tra URL webhook đã đăng ký với Sepay
3. Xem log server có nhận request không

### QR code không hiển thị:
1. Kiểm tra `SEPAY_ACCOUNT_NUMBER`, `SEPAY_BANK_CODE`
2. Kiểm tra network có block ảnh từ vietqr.io không

### Payment không auto-confirm:
1. Kiểm tra webhook URL
2. Kiểm tra nội dung chuyển khoản có đúng format không
3. Kiểm tra số tiền có đúng không

---

## 📞 Hỗ trợ

- Sepay Support: https://my.sepay.vn/support
- Docs: https://docs.sepay.vn/

