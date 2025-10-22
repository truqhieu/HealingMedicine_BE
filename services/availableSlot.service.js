const DoctorSchedule = require('../models/doctorSchedule.model');
const Appointment = require('../models/appointment.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');
const ScheduleHelper = require('../utils/scheduleHelper');

class AvailableSlotService {

  /**
   * Lấy các khung giờ available dựa trên:
   * - DoctorSchedule (khung giờ làm việc)
   * - Service (thời lượng dịch vụ)
   * - Appointments đã book (để loại trừ)
   * 
   * @param {Object} params
   * @param {ObjectId} params.doctorUserId - ID của User có role="Doctor"
   * @param {ObjectId} params.serviceId - ID dịch vụ
   * @param {Date} params.date - Ngày muốn đặt lịch
   * @param {Number} params.breakAfterMinutes - Thời gian nghỉ giữa các ca (mặc định 10 phút)
   */
  async getAvailableSlots({ doctorUserId, serviceId, date, breakAfterMinutes = 10 }) {
    
    // 1. Validate input
    if (!doctorUserId || !serviceId || !date) {
      throw new Error('Vui lòng cung cấp đầy đủ doctorUserId, serviceId và date');
    }

    // 2. Kiểm tra doctor có tồn tại không (từ bảng User với role="Doctor")
    const doctor = await User.findById(doctorUserId);
    if (!doctor) {
      throw new Error('Không tìm thấy bác sĩ');
    }

    if (doctor.role !== 'Doctor') {
      throw new Error('User này không phải là bác sĩ');
    }

    if (doctor.status !== 'Active') {
      throw new Error('Bác sĩ này hiện không hoạt động');
    }

    // 3. Lấy thông tin dịch vụ
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không hoạt động');
    }

    const serviceDuration = service.durationMinutes;

    // 4. Lấy DoctorSchedule của ngày đó
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    let schedules = await DoctorSchedule.find({
      doctorUserId,
      date: searchDate,
      status: 'Available'
    }).sort({ startTime: 1 });

    // ⭐ THÊM: Nếu chưa có schedule cho ngày này → Tự động tạo mặc định
    if (schedules.length === 0) {
      console.log(`⚠️  Không tìm thấy DoctorSchedule cho ngày ${searchDate.toISOString().split('T')[0]}, tự động tạo...`);
      
      try {
        // Tạo 2 schedule mặc định (Morning 8:00-12:00, Afternoon 14:00-18:00)
        const defaultSchedules = [
          {
            doctorUserId,
            date: searchDate,
            shift: 'Morning',
            startTime: new Date(searchDate).setHours(8, 0, 0),
            endTime: new Date(searchDate).setHours(12, 0, 0),
            status: 'Available',
            maxSlots: 4
          },
          {
            doctorUserId,
            date: searchDate,
            shift: 'Afternoon',
            startTime: new Date(searchDate).setHours(14, 0, 0),
            endTime: new Date(searchDate).setHours(18, 0, 0),
            status: 'Available',
            maxSlots: 4
          }
        ];
        
        schedules = await DoctorSchedule.insertMany(defaultSchedules);
        console.log(`✅ Tạo mới 2 schedule mặc định cho ngày ${searchDate.toISOString().split('T')[0]}`);
      } catch (insertError) {
        console.error(`❌ Lỗi tạo schedule mặc định:`, insertError.message);
        return {
          date: searchDate,
          doctorUserId,
          serviceId,
          serviceName: service.serviceName,
          serviceDuration,
          availableSlots: [],
          message: 'Không thể tạo lịch làm việc mặc định. Vui lòng liên hệ admin.'
        };
      }
    }

    // ⭐ Lúc này schedules luôn có dữ liệu (auto-created nếu cần)
    // Không cần check schedules.length === 0 nữa

    // 5. Lấy tất cả appointments đã book của bác sĩ trong ngày đó
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // ⭐ FIXED: Query appointments có timeslot rảnh trong ngày (không dùng createdAt)
    const bookedAppointments = await Appointment.find({
      doctorUserId,
      status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
      timeslotId: { $exists: true }
    })
    .populate({
      path: 'timeslotId',
      select: 'startTime endTime',
      match: {
        startTime: { $gte: startOfDay, $lte: endOfDay }
      }
    })
    .populate('serviceId', 'durationMinutes')
    .sort({ 'timeslotId.startTime': 1 });

    // Filter out appointments where timeslotId couldn't match (populate returned null)
    const validAppointments = bookedAppointments.filter(apt => apt.timeslotId !== null);

    // ⭐ THÊM: Lấy tất cả timeslots đã được Reserved hoặc Booked trong ngày
    // Để tránh conflict ngay cả khi chưa confirm appointment
    const Timeslot = require('../models/timeslot.model');
    const reservedTimeslots = await Timeslot.find({
      doctorUserId,
      status: { $in: ['Reserved', 'Booked'] },
      startTime: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ startTime: 1 });

    // 6. Tạo danh sách khoảng thời gian đã bận
    const busySlots = validAppointments.map(apt => {
      if (apt.timeslotId) {
        return {
          start: new Date(apt.timeslotId.startTime),
          end: new Date(apt.timeslotId.endTime).getTime() + breakAfterMinutes * 60000 // + break time
        };
      }
      return null;
    }).filter(slot => slot !== null);

    // ⭐ THÊM: Thêm Reserved/Booked timeslots vào busySlots
    const reservedBusySlots = reservedTimeslots.map(ts => ({
      start: new Date(ts.startTime),
      end: new Date(ts.endTime).getTime() + breakAfterMinutes * 60000
    }));
    
    busySlots.push(...reservedBusySlots);

    console.log('📅 Tính toán available slots:');
    console.log('   - Bác sĩ:', doctorUserId);
    console.log('   - Dịch vụ:', service.serviceName, `(${serviceDuration} phút)`);
    console.log('   - Ngày:', searchDate.toISOString().split('T')[0]);
    console.log('   - Số appointments đã book:', validAppointments.length);
    console.log('   - Số timeslots Reserved/Booked:', reservedTimeslots.length);
    console.log('🔴 DEBUG busySlots:', busySlots.map(b => ({
      start: new Date(b.start).toISOString(),
      end: new Date(b.end).toISOString()
    })));

    // 7. Tạo danh sách slots available
    const allAvailableSlots = [];

    for (const schedule of schedules) {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);

      console.log(`\n   🕐 Schedule ${schedule.shift}: ${ScheduleHelper.formatTimeSlot(scheduleStart, scheduleEnd)}`);

      // Tạo các slot có thể trong schedule này
      const slots = this._generateSlotsInRange(
        scheduleStart,
        scheduleEnd,
        serviceDuration,
        breakAfterMinutes,
        busySlots
      );

      allAvailableSlots.push(...slots);
    }

    console.log(`\n   ✅ Tổng số slots available: ${allAvailableSlots.length}`);

    return {
      date: searchDate,
      doctorUserId,
      serviceId,
      serviceName: service.serviceName,
      serviceDuration,
      breakAfterMinutes,
      availableSlots: allAvailableSlots,
      totalSlots: allAvailableSlots.length,
      // ⭐ Thêm scheduleId từ DoctorSchedule đầu tiên (có thể có multiple schedules)
      scheduleId: schedules.length > 0 ? schedules[0]._id : null
    };
  }

  /**
   * Tạo danh sách slots trong một khoảng thời gian, loại trừ busy slots
   * @private
   */
  _generateSlotsInRange(startTime, endTime, duration, breakTime, busySlots) {
    const slots = [];
    let currentStart = new Date(startTime);
    const end = new Date(endTime);

    while (currentStart < end) {
      // Tính end time của slot này
      const currentEnd = new Date(currentStart.getTime() + duration * 60000);

      // Kiểm tra slot có vượt quá thời gian làm việc không
      if (currentEnd > end) {
        break;
      }

      // Kiểm tra slot có trùng với busy slots không
      const isConflict = busySlots.some(busy => {
        return (
          (currentStart >= busy.start && currentStart < busy.end) ||
          (currentEnd > busy.start && currentEnd <= busy.end) ||
          (currentStart <= busy.start && currentEnd >= busy.end)
        );
      });

      if (!isConflict) {
        slots.push({
          startTime: new Date(currentStart),
          endTime: new Date(currentEnd),
          displayTime: ScheduleHelper.formatTimeSlot(currentStart, currentEnd)
        });
      }

      // Tính thời gian bắt đầu slot tiếp theo
      currentStart = new Date(currentEnd.getTime() + breakTime * 60000);
    }

    return slots;
  }

  /**
   * Lấy tất cả bác sĩ ACTIVE có khung giờ rảnh vào ngày và dịch vụ cụ thể
 */
  async getAvailableDoctors({ serviceId, date, breakAfterMinutes = 10 }) {
    // 1. Validate input
    if (!serviceId || !date) {
      throw new Error('Vui lòng cung cấp đầy đủ serviceId và date');
    }

    // 2. Lấy thông tin dịch vụ
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không hoạt động');
    }

    const serviceDuration = service.durationMinutes;

    // 3. Lấy tất cả bác sĩ ACTIVE
    const doctors = await User.find({
      role: 'Doctor',
      status: 'Active'
    }).select('_id fullName email phoneNumber');

    // 4. Chuẩn bị ngày tìm kiếm
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    if (doctors.length === 0) {
      return {
        date: searchDate,
        serviceId,
        serviceName: service.serviceName,
        serviceDuration,
        availableDoctors: [],
        totalDoctors: 0,
        message: 'Không có bác sĩ nào hoạt động'
      };
    }

    // 5. Duyệt qua từng bác sĩ để kiểm tra có khung giờ rảnh không
    const availableDoctors = [];

    for (const doctor of doctors) {
      try {
        // Lấy available slots cho bác sĩ này
        const slotsResult = await this.getAvailableSlots({
          doctorUserId: doctor._id,
          serviceId,
          date: searchDate,
          breakAfterMinutes
        });

        // Nếu bác sĩ này có khung giờ rảnh
        if (slotsResult.availableSlots && slotsResult.availableSlots.length > 0) {
          availableDoctors.push({
            doctorId: doctor._id,
            doctorScheduleId: slotsResult.scheduleId, 
            doctorName: doctor.fullName,
            email: doctor.email,
            phoneNumber: doctor.phoneNumber,
            availableSlots: slotsResult.availableSlots,
            totalSlots: slotsResult.availableSlots.length,
            totalSlotsToday: slotsResult.availableSlots.length
          });
        }
      } catch (error) {
        // Nếu có lỗi với bác sĩ này, bỏ qua và tiếp tục với bác sĩ khác
        console.warn(`⚠️  Lỗi lấy available slots cho bác sĩ ${doctor._id}:`, error.message);
      }
    }

    console.log('✅ Tìm kiếm bác sĩ có khung giờ rảnh:');
    console.log(`   - Ngày: ${searchDate.toISOString().split('T')[0]}`);
    console.log(`   - Dịch vụ: ${service.serviceName}`);
    console.log(`   - Tổng bác sĩ ACTIVE: ${doctors.length}`);
    console.log(`   - Bác sĩ có khung giờ rảnh: ${availableDoctors.length}`);

    return {
      date: searchDate,
      serviceId,
      serviceName: service.serviceName,
      serviceDuration,
      breakAfterMinutes,
      availableDoctors: availableDoctors,
      totalDoctors: availableDoctors.length,
      totalDoctorsActive: doctors.length
    };
  }

  /**
   * Lấy bác sĩ có khung giờ rảnh tại một khung giờ cụ thể
   * (Sử dụng khi FE chọn một khung giờ cụ thể thay vì xem tất cả)
   * 
   * @param {Object} params
   * @param {ObjectId} params.serviceId - ID dịch vụ
   * @param {Date} params.date - Ngày muốn đặt lịch
   * @param {Date} params.startTime - Giờ bắt đầu khung giờ muốn chọn
   * @param {Date} params.endTime - Giờ kết thúc khung giờ muốn chọn
   * @returns {Object} Danh sách bác sĩ có khung giờ khả dụng
   */
  async getAvailableDoctorsForTimeSlot({ serviceId, date, startTime, endTime }) {
    // 1. Validate input
    if (!serviceId || !date || !startTime || !endTime) {
      throw new Error('Vui lòng cung cấp đầy đủ serviceId, date, startTime và endTime');
    }

    // 2. Lấy thông tin dịch vụ
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không hoạt động');
    }

    // ⭐ THÊM: Validate duration của slot phải khớp với service
    const slotStartTime = new Date(startTime);
    const slotEndTime = new Date(endTime);
    const slotDurationMinutes = (slotEndTime - slotStartTime) / 60000;
    const serviceDurationMinutes = service.durationMinutes;

    if (slotDurationMinutes !== serviceDurationMinutes) {
      throw new Error(
        `Thời lượng khung giờ không khớp với dịch vụ. ` +
        `Dịch vụ "${service.serviceName}" yêu cầu ${serviceDurationMinutes} phút, ` +
        `nhưng bạn đã chọn ${slotDurationMinutes} phút.`
      );
    }

    // 3. Lấy tất cả bác sĩ ACTIVE
    const doctors = await User.find({
      role: 'Doctor',
      status: 'Active'
    }).select('_id fullName email phoneNumber');

    if (doctors.length === 0) {
      return {
        date: new Date(date),
        serviceId,
        serviceName: service.serviceName,
        requestedTime: {
          startTime: new Date(startTime),
          endTime: new Date(endTime)
        },
        availableDoctors: [],
        totalDoctors: 0,
        message: 'Không có bác sĩ nào hoạt động'
      };
    }

    // 4. Chuẩn bị ngày tìm kiếm
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    // ⭐ slotStartTime và slotEndTime đã được khai báo ở trên (dòng 375-376)
    // Không cần khai báo lại

    // 5. Duyệt qua từng bác sĩ để kiểm tra khung giờ này có rảnh không
    const availableDoctors = [];
    const Timeslot = require('../models/timeslot.model');

    for (const doctor of doctors) {
      try {
        // Kiểm tra xem bác sĩ có schedule vào ngày đó không
        let schedule = await DoctorSchedule.findOne({
          doctorUserId: doctor._id,
          date: searchDate,
          status: 'Available'
        });

        // ⭐ THÊM: Nếu không có schedule → Tự động tạo
        if (!schedule) {
          console.log(`⚠️  Bác sĩ ${doctor._id} không có schedule cho ngày ${searchDate.toISOString().split('T')[0]}, tự động tạo...`);
          
          try {
            const defaultSchedules = [
              {
                doctorUserId: doctor._id,
                date: searchDate,
                shift: 'Morning',
                startTime: new Date(searchDate).setHours(8, 0, 0),
                endTime: new Date(searchDate).setHours(12, 0, 0),
                status: 'Available',
                maxSlots: 4
              },
              {
                doctorUserId: doctor._id,
                date: searchDate,
                shift: 'Afternoon',
                startTime: new Date(searchDate).setHours(14, 0, 0),
                endTime: new Date(searchDate).setHours(18, 0, 0),
                status: 'Available',
                maxSlots: 4
              }
            ];
            
            const created = await DoctorSchedule.insertMany(defaultSchedules);
            console.log(`✅ Tạo mới 2 schedule mặc định`);
            
            // Lấy schedule Morning (shift đầu tiên)
            schedule = created[0];
          } catch (createError) {
            console.error(`❌ Lỗi tạo schedule: ${createError.message}`);
            continue;
          }
        }

        // Kiểm tra khung giờ có nằm trong schedule không
        const scheduleStart = new Date(schedule.startTime);
        const scheduleEnd = new Date(schedule.endTime);

        if (slotStartTime < scheduleStart || slotEndTime > scheduleEnd) {
          continue; // Khung giờ này nằm ngoài schedule
        }

        // Kiểm tra khung giờ có bị đặt trước không (kiểm tra Reserved hoặc Booked timeslots)
        const conflictingTimeslot = await Timeslot.findOne({
          doctorUserId: doctor._id,
          status: { $in: ['Reserved', 'Booked'] },
          // Kiểm tra có overlap: timeslot.startTime < slotEndTime AND timeslot.endTime > slotStartTime
          startTime: { $lt: slotEndTime },
          endTime: { $gt: slotStartTime }
        });

        if (conflictingTimeslot) {
          continue; // Khung giờ này đã bị đặt
        }

        // Bác sĩ này có khung giờ này rảnh
        availableDoctors.push({
          doctorId: doctor._id,
          doctorScheduleId: schedule._id, // ← Schedule của ngày đó
          doctorName: doctor.fullName,
          email: doctor.email,
          phoneNumber: doctor.phoneNumber,
          available: true
        });

      } catch (error) {
        console.warn(`⚠️  Lỗi kiểm tra bác sĩ ${doctor._id}:`, error.message);
      }
    }

    console.log('✅ Tìm kiếm bác sĩ rảnh cho khung giờ cụ thể:');
    console.log(`   - Ngày: ${searchDate.toISOString().split('T')[0]}`);
    console.log(`   - Khung giờ: ${slotStartTime.toISOString()} - ${slotEndTime.toISOString()}`);
    console.log(`   - Bác sĩ có khung giờ rảnh: ${availableDoctors.length}`);

    return {
      date: searchDate,
      serviceId,
      serviceName: service.serviceName,
      requestedTime: {
        startTime: slotStartTime,
        endTime: slotEndTime,
        displayTime: ScheduleHelper.formatTimeSlot(slotStartTime, slotEndTime)
      },
      availableDoctors: availableDoctors,
      totalDoctors: availableDoctors.length
    };
  }

  /**
   * ⭐ NEW: Generate danh sách khung giờ trống cho một ngày (không cần chọn bác sĩ)
   * FE dùng để hiển thị các slot khả dụng sau khi chọn dịch vụ + ngày
   */
  async generateAvailableSlotsByDate({ serviceId, date, breakAfterMinutes = 10 }) {
    // 1. Validate input
    if (!serviceId || !date) {
      throw new Error('Vui lòng cung cấp đầy đủ serviceId và date');
    }

    // 2. Lấy thông tin dịch vụ
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không hoạt động');
    }

    const serviceDuration = service.durationMinutes;

    // 3. Chuẩn bị ngày tìm kiếm
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    // 4. Tạo schedule mặc định nếu chưa có
    const schedules = [
      {
        shift: 'Morning',
        startTime: new Date(searchDate).setHours(8, 0, 0),
        endTime: new Date(searchDate).setHours(12, 0, 0)
      },
      {
        shift: 'Afternoon',
        startTime: new Date(searchDate).setHours(14, 0, 0),
        endTime: new Date(searchDate).setHours(18, 0, 0)
      }
    ];

    // 5. Generate slots từ schedules
    const allSlots = [];

    for (const schedule of schedules) {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);

      const slots = this._generateSlotsInRange(
        scheduleStart,
        scheduleEnd,
        serviceDuration,
        breakAfterMinutes,
        [] // Không có busySlots (chỉ generate toàn bộ)
      );

      allSlots.push(...slots);
    }

    console.log(`✅ Generate slots cho ngày ${searchDate.toISOString().split('T')[0]}`);
    console.log(`   - Dịch vụ: ${service.serviceName} (${serviceDuration} phút)`);
    console.log(`   - Tổng slots: ${allSlots.length}`);

    return {
      date: searchDate,
      serviceId,
      serviceName: service.serviceName,
      serviceDuration,
      breakAfterMinutes,
      availableSlots: allSlots,
      totalSlots: allSlots.length,
      schedules: [
        {
          shift: 'Morning',
          startTime: schedules[0].startTime,
          endTime: schedules[0].endTime
        },
        {
          shift: 'Afternoon',
          startTime: schedules[1].startTime,
          endTime: schedules[1].endTime
        }
      ]
    };
  }
}

module.exports = new AvailableSlotService();

