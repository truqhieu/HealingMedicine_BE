# 🗓️ Hướng dẫn Setup Google Meet API

Hướng dẫn chi tiết để thiết lập Google Calendar API nhằm tự động tạo liên kết Google Meet cho các cuộc tư vấn online.

## 📋 Bước 1: Tạo Project trên Google Cloud Console

### 1.1 Truy cập Google Cloud Console
- Đi đến: [https://console.cloud.google.com](https://console.cloud.google.com)
- Đăng nhập với tài khoản Google của bạn

### 1.2 Tạo Project mới
1. Nhấp vào dropdown "Select a Project" ở phía trên
2. Chọn "NEW PROJECT"
3. Nhập tên project: **"HaiAnhTeeth"** (hoặc tên bạn muốn)
4. Nhấp "CREATE"

## 🔐 Bước 2: Bật Google Calendar API

### 2.1 Tìm và bật API
1. Vào menu "APIs & Services" → "Library"
2. Tìm kiếm: **"Google Calendar API"**
3. Nhấp vào kết quả
4. Nhấp nút **"ENABLE"**

### 2.2 Chờ API được kích hoạt
Sau vài giây, bạn sẽ thấy thông báo API được bật.

## 🔑 Bước 3: Tạo Service Account

### 3.1 Tạo Service Account
1. Vào "APIs & Services" → "Credentials"
2. Chọn "Create Credentials" → "Service Account"
3. Điền thông tin:
   - **Service account name:** `haianh-teeth-app`
   - **Service account ID:** Sẽ tự động điền
   - **Description:** `Service account cho ứng dụng HaiAnhTeeth`
4. Nhấp "CREATE AND CONTINUE"

### 3.2 Cấp quyền cho Service Account
1. Trang "Grant this service account access to project":
   - Chọn role: **"Editor"**
   - (Hoặc chọn "Basic" → "Editor")
2. Nhấp "CONTINUE"
3. Nhấp "DONE"

## 📥 Bước 4: Tạo JSON Key

### 4.1 Tạo Private Key
1. Vào "APIs & Services" → "Credentials"
2. Tìm service account vừa tạo và nhấp vào
3. Vào tab "KEYS"
4. Nhấp "Add Key" → "Create new key"
5. Chọn loại key: **"JSON"**
6. Nhấp "CREATE"

### 4.2 File JSON sẽ được tải xuống tự động
Lưu file này lại, tên file sẽ giống như:
```
haianh-teeth-app-XXXXXXXXXXXXXX.json
```

## 📁 Bước 5: Cấu hình trong ứng dụng

### 5.1 Di chuyển file JSON vào project
1. Tạo folder `config` (nếu chưa có)
2. Sao chép file JSON vào: `config/google-credentials.json`

```bash
# Hoặc dùng dòng lệnh
cp ~/Downloads/haianh-teeth-app-*.json ./config/google-credentials.json
```

### 5.2 Cấu hình biến môi trường
Mở file `.env` và thêm:

```env
# Google Calendar API
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_EMAIL=noreply@haianteeth.com
```

**Lưu ý:**
- `GOOGLE_CALENDAR_ID=primary` sẽ sử dụng calendar mặc định
- `GOOGLE_CALENDAR_EMAIL` là email sẽ hiển thị trong event (thường là email công ty)

## 🔗 Bước 6: Chia sẻ Calendar cho Service Account

### 6.1 Lấy email của Service Account
1. Vào "APIs & Services" → "Credentials"
2. Nhấp vào Service Account vừa tạo
3. Lấy email ở dòng "Email" (ví dụ: `haianh-teeth-app@project-id.iam.gserviceaccount.com`)

### 6.2 Chia sẻ Google Calendar
1. Đăng nhập vào [Google Calendar](https://calendar.google.com) với tài khoản công ty
2. Nhấp chuột phải vào calendar → "Settings"
3. Vào tab "Share with specific people or groups"
4. Nhấp "Add people"
5. Paste email service account (từ bước 6.1)
6. Chọn quyền: **"Make changes to events"**
7. Nhấp "Send"

**⚠️ Quan trọng:** Bước này bắt buộc để service account có thể tạo event!

## 📦 Bước 7: Cài đặt NPM Package

```bash
npm install googleapis
```

## ✅ Bước 8: Kiểm tra cấu hình

### 8.1 Kiểm tra file credentials
```bash
# Đảm bảo file tồn tại
ls config/google-credentials.json
```

### 8.2 Chạy ứng dụng
```bash
npm run dev
```

### 8.3 Kiểm tra logs
Khi ứng dụng khởi động, bạn sẽ thấy:
```
✅ Google Calendar API initialized
```

Nếu không thấy, có thể:
- File credentials chưa được đặt đúng vị trí
- Chưa chia sẻ calendar cho service account
- Biến môi trường chưa được cấu hình

## 🧪 Kiểm tra chức năng

### Tạo appointment test
```bash
curl -X POST http://localhost:3000/api/appointments/consultation/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{...}'
```

### Duyệt appointment (tạo Google Meet link)
```bash
curl -X POST http://localhost:3000/api/appointments/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -d '{"appointmentId": "ID_APPOINTMENT"}'
```

Nếu thành công, bạn sẽ nhận được response:
```json
{
  "success": true,
  "message": "Lịch hẹn đã được duyệt và gửi email xác nhận cho bệnh nhân",
  "data": {
    "linkMeetUrl": "https://meet.google.com/abc-defg-hij",
    ...
  }
}
```

## 🚨 Xử lý lỗi thường gặp

### Lỗi: "File google-credentials.json không tồn tại"
**Giải pháp:** Kiểm tra đường dẫn file, đảm bảo file nằm ở `config/google-credentials.json`

### Lỗi: "Permission denied"
**Giải pháp:** 
- Kiểm tra service account đã được cấp quyền "Editor"
- Kiểm tra calendar đã được chia sẻ cho service account
- Chờ vài phút để Google xử lý permission

### Lỗi: "Invalid Credentials"
**Giải pháp:**
- Tải lại JSON key từ Google Cloud Console
- Thay thế file `config/google-credentials.json`

### Link meet không được tạo
**Giải pháp:**
- Ứng dụng sẽ fallback sang link tĩnh (APP_URL/appointment/ID/meet)
- Kiểm tra logs để xem lỗi chi tiết

## 📧 Fallback Mode

Nếu không setup Google Meet API, ứng dụng vẫn hoạt động bình thường:
- ✅ Tạo appointment thành công
- ✅ Duyệt appointment thành công
- ✅ Gửi email xác nhận thành công
- ⚠️ Link meet sẽ là: `http://yourapp.com/appointment/ID/meet` (static link)

## 🔄 Cập nhật credentials

Nếu muốn thay đổi credentials sau:
1. Tải JSON key mới từ Google Cloud
2. Thay thế file `config/google-credentials.json`
3. Restart ứng dụng: `npm run dev`

## 📚 Tài liệu tham khảo

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [Creating Google Meet Links](https://support.google.com/calendar/answer/10667003)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/authenticate-external-user-client)

---

**✨ Lưu ý:** Setup Google Meet API là tùy chọn. Nếu không setup, ứng dụng vẫn hoạt động nhưng sẽ không có link meet thực tế.

