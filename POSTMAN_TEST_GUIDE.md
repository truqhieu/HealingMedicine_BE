# 📋 Hướng dẫn Test API Doctor trên Postman

## 🚀 Quick Start

### 1. Import Collection vào Postman
```
Bước 1: Mở Postman
Bước 2: Nhấn File → Import
Bước 3: Chọn file "postman_collection_doctor.json"
Bước 4: Nhấn Import
```

---

## 🔑 Setup Environment Variables

Trước khi test, cần setup các biến:

### Biến cần cập nhật:
```
baseUrl: http://localhost:3000/api  (mặc định đã có)
doctorToken: [Lấy từ bước login]
appointmentId: [Lấy từ bước danh sách lịch]
patientId: [Lấy từ bước chi tiết ca khám]
```

---

## 📖 Các bước Test theo thứ tự

### BƯỚC 1️⃣: Doctor Login (Lấy Token)
```
Endpoint: POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "123456"
}
```

**Cách setup Doctor:**
1. Vào database và tạo User với role = "Doctor"
   ```javascript
   {
     "fullName": "Nguyễn Văn A",
     "email": "doctor@example.com",
     "passwordHash": "hashed_password",
     "role": "Doctor",
     "status": "Active"
   }
   ```

2. Hoặc dùng Admin API để tạo tài khoản
   ```
   POST /api/admin/accounts
   {
     "fullName": "Nguyễn Văn A",
     "email": "doctor@example.com",
     "password": "123456",
     "role": "Doctor"
   }
   ```

**Expected Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "xxx",
      "fullName": "Nguyễn Văn A",
      "email": "doctor@example.com",
      "role": "Doctor"
    }
  }
}
```

**Sau khi nhận response:**
1. Copy giá trị `token` 
2. Vào Postman → Environments → Chọn Environment
3. Tìm biến `doctorToken` và paste token vào Value
4. Hoặc click vào "Set as variable" ở response

---

### BƯỚC 2️⃣: Lấy Danh sách Lịch Khám (2 tuần)
```
Endpoint: GET /api/doctor/appointments-schedule
```

**Headers:**
```
Authorization: Bearer {{doctorToken}}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Lấy lịch khám thành công",
  "data": {
    "doctorName": "Nguyễn Văn A",
    "doctorId": "xxx",
    "periodStart": "2025-10-20",
    "periodEnd": "2025-11-03",
    "appointmentsByDay": {
      "2025-10-20": [
        {
          "appointmentId": "appointment_id_here",
          "type": "Consultation",
          "status": "Approved",
          "startTime": "2025-10-20T09:00:00Z",
          "endTime": "2025-10-20T10:00:00Z",
          "patient": {
            "fullName": "Trần Thị B",
            "email": "patient@example.com",
            "phoneNumber": "0123456789"
          },
          "service": {
            "serviceName": "Tư vấn",
            "price": 200000
          },
          "notes": "Ghi chú từ staff",
          "mode": "Online",
          "linkMeetUrl": "https://zoom.us/..."
        }
      ]
    },
    "totalAppointments": 12
  }
}
```

**Nếu không có lịch:**
- Kiểm tra xem có Appointment nào trong DB không
- Appointment đó phải có doctorUserId = doctor đang login
- Và createdAt phải nằm trong vòng 2 tuần từ hôm nay

---

### BƯỚC 3️⃣: Chi tiết Ca Khám (Pop-up 1)
```
Endpoint: GET /api/doctor/appointments/{{appointmentId}}
```

**Setup biến appointmentId:**
1. Từ response của BƯỚC 2, lấy `appointmentId`
2. Set vào biến `appointmentId` trong Postman

**Headers:**
```
Authorization: Bearer {{doctorToken}}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Lấy chi tiết lịch hẹn thành công",
  "data": {
    "appointmentId": "xxx",
    "type": "Examination",
    "status": "CheckedIn",
    "mode": "Offline",
    "patient": {
      "_id": "patient_id",
      "fullName": "Trần Thị B",
      "email": "patient@example.com",
      "phoneNumber": "0123456789",
      "dob": "1990-01-01",
      "gender": "Female",
      "address": "123 Nguyễn Huệ, TP.HCM"
    },
    "service": {
      "_id": "service_id",
      "serviceName": "Khám tổng quát",
      "price": 500000,
      "description": "Khám toàn bộ cơ thể"
    },
    "timeslot": {
      "_id": "timeslot_id",
      "startTime": "2025-10-20T09:00:00Z",
      "endTime": "2025-10-20T10:00:00Z"
    },
    "payment": {
      "_id": "payment_id",
      "status": "Completed",
      "amount": 500000,
      "method": "Sepay"
    },
    "notes": "Bệnh nhân có dị ứng với Amoxicillin",
    "linkMeetUrl": "https://zoom.us/j/xxx",
    "rescheduleCount": 1,
    "replacedDoctorUserId": null
  }
}
```

---

### BƯỚC 4️⃣: Thông tin Bệnh nhân (Pop-up 2)
```
Endpoint: GET /api/doctor/patients/{{patientId}}
```

**Setup biến patientId:**
1. Từ response của BƯỚC 3, lấy `patient._id`
2. Set vào biến `patientId` trong Postman

**Headers:**
```
Authorization: Bearer {{doctorToken}}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Lấy chi tiết thông tin bệnh nhân thành công",
  "data": {
    "patientId": "patient_id",
    "fullName": "Trần Thị B",
    "email": "patient@example.com",
    "phoneNumber": "0123456789",
    "dateOfBirth": "1990-01-01",
    "gender": "Female",
    "address": "123 Nguyễn Huệ, TP.HCM",
    "status": "Active",
    "appointmentHistory": {
      "total": 5,
      "list": [
        {
          "_id": "appointment_id",
          "type": "Examination",
          "status": "Completed",
          "notes": "Khám xong, bệnh nhân bình thường",
          "service": {
            "serviceName": "Khám tổng quát",
            "price": 500000
          },
          "timeslot": {
            "startTime": "2025-09-15T09:00:00Z",
            "endTime": "2025-09-15T10:00:00Z"
          },
          "createdAt": "2025-09-15T10:30:00Z"
        }
      ]
    },
    "upcomingAppointments": {
      "total": 2,
      "list": [
        {
          "_id": "appointment_id_2",
          "type": "Consultation",
          "status": "Approved",
          "service": {
            "serviceName": "Tư vấn"
          },
          "timeslot": {
            "startTime": "2025-10-22T14:00:00Z",
            "endTime": "2025-10-22T15:00:00Z"
          }
        }
      ]
    }
  }
}
```

---

## 🧪 Test Data cần chuẩn bị

### 1. Doctor Account
```javascript
{
  "fullName": "Nguyễn Văn A",
  "email": "doctor@example.com",
  "password": "123456",
  "role": "Doctor",
  "status": "Active"
}
```

### 2. Patient Account
```javascript
{
  "fullName": "Trần Thị B",
  "email": "patient@example.com",
  "password": "123456",
  "role": "Patient",
  "status": "Active"
}
```

### 3. Service
```javascript
{
  "serviceName": "Khám tổng quát",
  "price": 500000,
  "description": "Khám toàn bộ cơ thể"
}
```

### 4. Appointment
```javascript
{
  "patientUserId": "patient_id",
  "doctorUserId": "doctor_id",
  "serviceId": "service_id",
  "type": "Examination",
  "status": "Approved",
  "mode": "Offline",
  "notes": "Bệnh nhân có dị ứng"
}
```

---

## ❌ Các lỗi thường gặp

### Error 1: 401 Unauthorized
```
Nguyên nhân: Token hết hạn hoặc không đúng
Giải pháp: Đăng nhập lại (BƯỚC 1) để lấy token mới
```

### Error 2: 403 Forbidden
```
Nguyên nhân: User không phải Doctor
Giải pháp: Kiểm tra role của user = "Doctor"
```

### Error 3: 404 Not Found
```
Nguyên nhân: Appointment hoặc Patient không tồn tại
Giải pháp: Kiểm tra appointmentId hoặc patientId có đúng không
```

### Error 4: Danh sách lịch trống
```
Nguyên nhân: Không có appointment trong DB
Giải pháp: 
1. Kiểm tra DB có appointment không
2. Appointment phải có doctorUserId = doctor_id
3. Appointment phải nằm trong 2 tuần từ hôm nay
```

---

## 📱 Testing Flow

```
Login Doctor
    ↓
Lấy danh sách lịch (2 tuần)
    ↓
Click vào lịch → Chi tiết ca khám (Pop-up 1)
    ↓
Click vào tên bệnh nhân → Thông tin bệnh nhân (Pop-up 2)
```

---

## ✅ Checklist test

- [ ] Doctor có thể login thành công
- [ ] Token được lấy và lưu vào biến
- [ ] Danh sách lịch 2 tuần được hiển thị
- [ ] Có thể xem chi tiết ca khám
- [ ] Có thể xem chi tiết thông tin bệnh nhân
- [ ] Lịch sử khám được hiển thị đúng
- [ ] Lịch sắp tới được hiển thị đúng
- [ ] Error handling hoạt động (404, 403, 401)

---

## 🎉 Khi test xong

Các endpoint đã sẵn sàng để FE integrate!

FE có thể:
1. Gọi `/doctor/appointments-schedule` → Hiển thị danh sách
2. Click vào lịch → Gọi `/doctor/appointments/:id` → Hiển thị Pop-up 1
3. Click vào tên bệnh nhân → Gọi `/doctor/patients/:patientId` → Hiển thị Pop-up 2
