# 📅 Hướng dẫn Hệ thống Duyệt Lịch Hẹn + Google Meet

## 📌 Tổng Quan

Hệ thống này cho phép:
1. ✅ **Bệnh nhân** đặt lịch hẹn tư vấn online hoặc khám offline
2. ✅ **Staff** duyệt lịch hẹn từ backend
3. ✅ **Tự động** tạo Google Meet link cho cuộc tư vấn online
4. ✅ **Gửi email** xác nhận với link meet cho bệnh nhân

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Appointment Workflow                      │
└─────────────────────────────────────────────────────────────┘

1. PATIENT BOOKS APPOINTMENT
   ↓
   POST /api/appointments/consultation/create
   ├── Validate input
   ├── Create Appointment (Status: Pending)
   ├── Create Timeslot (Status: Booked)
   ├── Send confirmation email (without meet link)
   └── Return to patient

2. STAFF REVIEWS PENDING APPOINTMENTS
   ↓
   GET /api/appointments/pending
   └── List all pending appointments

3. STAFF APPROVES APPOINTMENT
   ↓
   POST /api/appointments/approve
   ├── Validate appointment status
   ├── If Consultation + Online:
   │   └── Generate Google Meet link (via Google Calendar API)
   ├── Update Appointment (Status: Approved)
   ├── Save link to linkMeetUrl
   ├── Send approval email (with meet link if available)
   └── Return confirmation

4. PATIENT RECEIVES EMAIL
   └── Email includes:
       ├── Appointment details
       ├── Google Meet link (if online consultation)
       └── Tips for joining meeting
```

---

## 📦 New API Endpoints

### 1️⃣ Duyệt Lịch Hẹn

**POST** `/api/appointments/approve`

**Headers:**
```json
{
  "Authorization": "Bearer STAFF_TOKEN",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "appointmentId": "64c3a5d0e1234567890abcdef"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Lịch hẹn đã được duyệt và gửi email xác nhận cho bệnh nhân",
  "data": {
    "_id": "64c3a5d0e1234567890abcdef",
    "status": "Approved",
    "mode": "Online",
    "type": "Consultation",
    "linkMeetUrl": "https://meet.google.com/abc-defg-hij",
    "approvedByUserId": "64c2a5c0e1234567890abcdXX",
    ...
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Lịch hẹn đang chờ thanh toán. Vui lòng chờ khách hàng thanh toán hoặc hủy yêu cầu này."
}
```

---

### 2️⃣ Lấy Danh Sách Lịch Hẹn Chờ Duyệt

**GET** `/api/appointments/pending`

**Query Parameters (tùy chọn):**
```
?doctorUserId=64c2a5c0e1234567890abcdXX
?startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```json
{
  "Authorization": "Bearer STAFF_TOKEN"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64c3a5d0e1234567890abcdef",
      "status": "Pending",
      "type": "Consultation",
      "mode": "Online",
      "patientUserId": {
        "_id": "64c2a5c0e1234567890abcdYY",
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@example.com"
      },
      "doctorUserId": {
        "_id": "64c2a5c0e1234567890abcdZZ",
        "fullName": "Dr. Trần Thị B",
        "email": "doctor@example.com"
      },
      "serviceId": {
        "serviceName": "Tư vấn khám phục hình",
        "price": 200000,
        "durationMinutes": 30
      },
      "timeslotId": {
        "startTime": "2024-12-20T14:00:00Z",
        "endTime": "2024-12-20T14:30:00Z"
      },
      "createdAt": "2024-12-19T10:00:00Z"
    },
    ...
  ],
  "count": 5
}
```

---

### 3️⃣ Lấy Danh Sách Tất Cả Lịch Hẹn

**GET** `/api/appointments/all`

**Query Parameters (tùy chọn):**
```
?status=Pending
?status=Approved
?status=Completed
?doctorUserId=xxx
?patientUserId=xxx
?mode=Online
?mode=Offline
?type=Consultation
?type=Examination
```

**Headers:**
```json
{
  "Authorization": "Bearer STAFF_TOKEN"
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 42
}
```

---

## 🚀 Quick Start

### 1. Cài Đặt

```bash
# Cài dependencies
npm install

# Hoặc nếu chưa cài googleapis
npm install googleapis
```

### 2. Cấu Hình .env

```env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Database
MONGODB_URI=mongodb://localhost:27017/haianh_teeth

# JWT
JWT_SECRET=your-secret-key
```

### 3. Setup Google Meet (Tùy Chọn)

Chi tiết xem: [GOOGLE_MEET_SETUP.md](./GOOGLE_MEET_SETUP.md)

Nếu không setup:
- ✅ Hệ thống vẫn hoạt động
- ⚠️ Link meet sẽ là: `http://yourapp.com/appointment/ID/meet` (static)

### 4. Khởi Động

```bash
npm run dev
```

---

## 📊 Database Schema Updates

Trường `linkMeetUrl` đã tồn tại trong `Appointment` model:

```javascript
linkMeetUrl: {
  type: String,
  default: null
}
```

Được populate khi appointment được approve.

---

## 📧 Email Templates

### Template 1: Appointment Confirmation (Khi đặt lịch)

Gửi đến: Bệnh nhân
Trạng thái: Lịch hẹn chờ duyệt
Nội dung: Thông tin cơ bản, KHÔNG có link meet

### Template 2: Appointment Approved (Khi duyệt lịch)

Gửi đến: Bệnh nhân
Trạng thái: Lịch hẹn được xác nhận
Nội dung: Thông tin đầy đủ + **Google Meet link** (nếu online)

**📧 Email Example:**
```
Xin chào Nguyễn Văn A!

Chúng tôi vui mừng thông báo rằng lịch tư vấn của bạn đã được xác nhận!

📋 Thông tin cuộc hẹn
- Dịch vụ: Tư vấn khám phục hình
- Bác sĩ: Dr. Trần Thị B
- Ngày hẹn: 20 Tháng 12, 2024
- Thời gian: 14:00 - 14:30
- Hình thức: Trực tuyến

💻 Liên kết cuộc họp
https://meet.google.com/abc-defg-hij

💡 Gợi ý hữu ích
- Đến sớm 5-10 phút trước giờ hẹn
- Kiểm tra kết nối Internet của bạn
- Chuẩn bị một nơi yên tĩnh để tư vấn

📞 Cần hỗ trợ?
Hotline: 1900-xxxx
Email: support@haianteeth.com
```

---

## 🔐 Permission & Authorization

### Roles cần thiết:

| Endpoint | Required Role | Notes |
|----------|---------------|-------|
| POST /consultation/create | Patient | Signed in users |
| POST /approve | Staff/Admin | Để duyệt appointment |
| GET /pending | Staff/Admin | Xem danh sách chờ duyệt |
| GET /all | Staff/Admin | Xem tất cả appointments |

---

## 🧪 Testing API

### Postman Collection

```bash
1. POST /api/appointments/consultation/create
   - Create appointment
   - Status: Pending

2. GET /api/appointments/pending
   - Xem appointment vừa tạo

3. POST /api/appointments/approve
   - Duyệt appointment
   - Status: Approved
   - Link meet được tạo
```

### cURL Examples

**Tạo appointment:**
```bash
curl -X POST http://localhost:3000/api/appointments/consultation/create \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "64c3a5d0e1234567890abcdef",
    "doctorUserId": "64c2a5c0e1234567890abcdZZ",
    "doctorScheduleId": "64c2a5c0e1234567890abcdXX",
    "selectedSlot": {
      "startTime": "2024-12-20T14:00:00Z",
      "endTime": "2024-12-20T14:30:00Z"
    },
    "phoneNumber": "0123456789",
    "appointmentFor": "self"
  }'
```

**Duyệt appointment:**
```bash
curl -X POST http://localhost:3000/api/appointments/approve \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": "64c3a5d0e1234567890abcdef"
  }'
```

**Xem danh sách chờ duyệt:**
```bash
curl -X GET "http://localhost:3000/api/appointments/pending" \
  -H "Authorization: Bearer STAFF_TOKEN"
```

---

## 🚨 Xử Lý Lỗi

| Lỗi | Nguyên Nhân | Giải Pháp |
|-----|-----------|----------|
| "Không tìm thấy lịch hẹn" | ID appointment sai | Kiểm tra ID |
| "Không thể duyệt lịch hẹn ở trạng thái X" | Status không phải Pending | Chỉ có thể duyệt Pending |
| "Lịch hẹn đang chờ thanh toán" | Status = PendingPayment | Đợi bệnh nhân thanh toán |
| Google Meet link không được tạo | Credentials chưa setup | Fallback sang link tĩnh |

---

## 📝 Checklist Triển Khai

- [ ] Cài `googleapis` package
- [ ] Tạo file `config/google-credentials.json`
- [ ] Cấu hình biến môi trường trong `.env`
- [ ] Test API endpoints
- [ ] Kiểm tra email templates
- [ ] Setup calendar sharing với service account
- [ ] Test end-to-end flow

---

## 📚 Tài Liệu Liên Quan

- [GOOGLE_MEET_SETUP.md](./GOOGLE_MEET_SETUP.md) - Setup Google Meet API chi tiết
- [services/googleMeetService.js](./services/googleMeetService.js) - Google Meet service code
- [services/appointment.service.js](./services/appointment.service.js) - Appointment business logic
- [models/appointment.model.js](./models/appointment.model.js) - Appointment schema

---

## 🎯 Tính Năng Sắp Tới

- [ ] Hủy appointment (xóa Google Meet event)
- [ ] Reschedule appointment (update Google Meet event)
- [ ] Reminder emails (24h trước)
- [ ] Zoom meeting integration
- [ ] SMS notifications
- [ ] Appointment history

---

**✨ Version: 1.0.0 | Last Updated: 2024**
