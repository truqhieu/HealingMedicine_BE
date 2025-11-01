# Hướng dẫn cleanup DoctorSchedule bị duplicate

## Vấn đề

Database hiện tại có nhiều bản ghi `DoctorSchedule` bị duplicate cho cùng một bác sĩ, ngày, và ca làm việc (shift). Điều này gây ra lỗi và hiển thị không chính xác.

## Nguyên nhân

Logic tự động tạo schedule trước đây chưa kiểm tra duplicate đúng cách, dẫn đến việc tạo ra nhiều bản ghi trùng lặp mỗi khi API được gọi.

## Giải pháp

### 1. Chạy script cleanup để xóa duplicates

```bash
cd HaiAnhTeeth_BE/HaiAnhTeeth_BE
node scripts/cleanupDuplicateSchedules.js
```

Script này sẽ:
- Tìm tất cả các schedule bị duplicate (cùng `doctorUserId + date + shift`)
- Giữ lại bản ghi cũ nhất (oldest) cho mỗi group
- Xóa các bản ghi duplicate còn lại
- Tạo unique index để ngăn duplicate trong tương lai

### 2. Các thay đổi đã thực hiện trong code

#### Model (`models/doctorSchedule.model.js`)
- ✅ Thêm unique index: `{ doctorUserId: 1, date: 1, shift: 1 }`
- Ngăn chặn việc tạo duplicate schedule trong tương lai

#### Service (`services/availableSlot.service.js`)

**Hàm `getAvailableDoctors`:**
- ✅ Sửa logic check schedule: dùng `countDocuments()` thay vì `findOne()`
- ✅ Thêm log rõ ràng hơn
- ✅ Sử dụng `insertMany` với `ordered: false` để bỏ qua duplicate key errors
- ✅ Xóa logic kiểm tra `slotStartTime`/`slotEndTime` không tồn tại (vì hàm này là lấy bác sĩ cho CẢ NGÀY)

**Lỗi đã sửa:**
- ❌ **Trước đây**: `slotStartTime is not defined` - biến không tồn tại trong hàm `getAvailableDoctors`
- ✅ **Bây giờ**: Logic chỉ kiểm tra bác sĩ có schedule vào ngày đó, không kiểm tra slot cụ thể

### 3. Luồng mới

1. **FE chọn ngày + dịch vụ** → Gọi `GET /api/available-slots/doctors/list`
2. **BE trả về danh sách bác sĩ** có schedule vào ngày đó (không kiểm tra slot cụ thể)
3. **FE chọn bác sĩ** → Gọi `GET /api/available-slots/doctor-schedule` để lấy schedule range
4. **FE hiển thị range** (ví dụ: 08:00 - 12:00)
5. **User nhập thời gian bắt đầu** (ví dụ: 09:20)
6. **FE validate** → Gọi `GET /api/available-slots/validate-appointment-time`
7. **BE trả về** thời gian kết thúc dự kiến và kiểm tra bác sĩ có rảnh không

### 4. Kiểm tra sau cleanup

```bash
# Kết nối MongoDB và kiểm tra
mongosh "your_mongodb_connection_string"

# Đếm số schedule theo ngày
use haianh_teeth
db.doctorschedules.aggregate([
  {
    $group: {
      _id: { 
        doctorUserId: "$doctorUserId", 
        date: "$date", 
        shift: "$shift" 
      },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
])
```

Nếu kết quả trả về rỗng → ✅ Không còn duplicate!

### 5. Test luồng mới

1. Chọn ngày và dịch vụ
2. Kiểm tra danh sách bác sĩ hiển thị đúng
3. Chọn bác sĩ → Kiểm tra schedule range hiển thị
4. Nhập thời gian → Kiểm tra validate và tính toán thời gian kết thúc

## Lưu ý

- ⚠️ Chạy script cleanup trong môi trường **non-production** trước
- ⚠️ Backup database trước khi chạy
- ⚠️ Unique index sẽ ngăn duplicate, nhưng phải cleanup database cũ trước khi apply index

