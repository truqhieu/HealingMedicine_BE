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
  async getAvailableSlots({ doctorUserId, serviceId, date, patientUserId, breakAfterMinutes = 10 }) {
    
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
        // Tạo 2 schedule mặc định (Morning 8:00-12:00, Afternoon 14:00-18:00 Việt Nam)
        // ⭐ Chuyển đổi từ giờ Việt Nam sang UTC: trừ 7 tiếng
        const defaultSchedules = [
          {
            doctorUserId,
            date: searchDate,
            shift: 'Morning',
            startTime: new Date(searchDate).setHours(1, 0, 0),  // 1h UTC = 8h Vietnam time
            endTime: new Date(searchDate).setHours(5, 0, 0),    // 5h UTC = 12h Vietnam time
            status: 'Available',
            maxSlots: 4
          },
          {
            doctorUserId,
            date: searchDate,
            shift: 'Afternoon',
            startTime: new Date(searchDate).setHours(7, 0, 0),  // 7h UTC = 14h Vietnam time
            endTime: new Date(searchDate).setHours(11, 0, 0),   // 11h UTC = 18h Vietnam time
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

    // ⭐ THÊM: Kiểm tra appointments của bệnh nhân hiện tại trong ngày (nếu đặt cho bản thân)
    let patientAppointments = [];
    if (patientUserId) {
      patientAppointments = await Appointment.find({
        patientUserId,
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
      .sort({ 'timeslotId.startTime': 1 });

      patientAppointments = patientAppointments.filter(apt => apt.timeslotId !== null);

      console.log('👤 Appointments của bệnh nhân hiện tại trong ngày:', patientAppointments.length);
    }

    // ⭐ THÊM: Lấy tất cả timeslots đã được Reserved hoặc Booked trong ngày
    // Để tránh conflict ngay cả khi chưa confirm appointment
    const Timeslot = require('../models/timeslot.model');
    const reservedTimeslots = await Timeslot.find({
      doctorUserId,
      status: { $in: ['Reserved', 'Booked'] },
      startTime: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ startTime: 1 });

    // ⭐ THÊM: Lấy tất cả timeslots từ appointments của bệnh nhân hiện tại trong ngày
    // Để exclude các khung giờ bệnh nhân đã book
    let patientTimeslots = [];
    if (patientUserId) {
      const patientTimeslotIds = patientAppointments.map(apt => apt.timeslotId._id);
      if (patientTimeslotIds.length > 0) {
        patientTimeslots = await Timeslot.find({
          _id: { $in: patientTimeslotIds },
          startTime: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ startTime: 1 });
        
        console.log('👤 Patient timeslots to exclude:', patientTimeslots.length);
      }
    }

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

    // ⭐ THÊM: Thêm appointments của bệnh nhân vào busy slots
    const patientBusySlots = patientAppointments.map(apt => {
      if (apt.timeslotId) {
        return {
          start: new Date(apt.timeslotId.startTime),
          end: new Date(apt.timeslotId.endTime).getTime() + breakAfterMinutes * 60000
        };
      }
      return null;
    }).filter(slot => slot !== null);
    
    busySlots.push(...patientBusySlots);

    // ⭐ THÊM: Thêm timeslots của bệnh nhân vào busy slots (để exclude khung giờ họ đã book)
    const patientTimeslotBusySlots = patientTimeslots.map(ts => ({
      start: new Date(ts.startTime),
      end: new Date(ts.endTime).getTime() + breakAfterMinutes * 60000
    }));
    
    busySlots.push(...patientTimeslotBusySlots);

    // ⭐ THÊM: Thêm Reserved/Booked timeslots vào busySlots
    const reservedBusySlots = reservedTimeslots.map(ts => ({
      start: new Date(ts.startTime),
      end: new Date(ts.endTime).getTime() + breakAfterMinutes * 60000
    }));
    
    busySlots.push(...reservedBusySlots);

    console.log('📅 Tính toán available slots:');
    console.log('   - Bác sĩ:', doctorUserId);
    console.log('   - Bệnh nhân:', patientUserId || 'N/A');
    console.log('   - Dịch vụ:', service.serviceName, `(${serviceDuration} phút)`);
    console.log('   - Ngày:', searchDate.toISOString().split('T')[0]);
    console.log('   - Số appointments của bác sĩ đã book:', validAppointments.length);
    console.log('   - Số appointments của bệnh nhân đã book:', patientAppointments.length);
    console.log('   - Số timeslots của bệnh nhân cần exclude:', patientTimeslots.length);
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
          startTime: currentStart.toISOString(),
          endTime: currentEnd.toISOString(),
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

    console.log('🔍 Search date:', searchDate.toISOString());
    console.log('📅 Searching for doctors with schedule on:', searchDate.toISOString().split('T')[0]);

    // ⭐ THÊM: Auto-create schedule cho TOÀN BỘ ngày (1 lần duy nhất)
    // Kiểm tra xem ngày này đã có schedule nào chưa
    const existingSchedules = await DoctorSchedule.findOne({
      date: searchDate,
      status: 'Available'
    });

    if (!existingSchedules) {
      console.log(`⚠️  Ngày ${searchDate.toISOString().split('T')[0]} chưa có schedule, tự động tạo cho tất cả bác sĩ...`);
      
      try {
        // Tạo schedule cho TẤT CẢ bác sĩ 1 lần
        const schedulesToCreate = [];
        for (const doctor of doctors) {
          schedulesToCreate.push(
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
          );
        }
        
        await DoctorSchedule.insertMany(schedulesToCreate);
        console.log(`✅ Tạo ${schedulesToCreate.length} schedules cho ${doctors.length} bác sĩ`);
      } catch (createError) {
        console.error(`❌ Lỗi tạo schedules: ${createError.message}`);
      }
    }

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

        // ⭐ Nếu vẫn không có schedule (rare case) → skip
        if (!schedule) {
          console.warn(`⚠️  Bác sĩ ${doctor._id} không có schedule cho ngày này, skip...`);
          continue;
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
  async getAvailableDoctorsForTimeSlot({ serviceId, date, startTime, endTime, patientUserId }) {
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

    // ⭐ THÊM: Check nếu bệnh nhân hiện tại đã có appointment vào khung giờ này
    if (patientUserId) {
      const slotStartTime = new Date(startTime);
      const slotEndTime = new Date(endTime);

      const existingPatientAppointment = await Appointment.findOne({
        patientUserId,
        status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
        timeslotId: { $exists: true }
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime',
        match: {
          startTime: { $gte: slotStartTime, $lt: slotEndTime },
          endTime: { $gt: slotStartTime, $lte: slotEndTime }
        }
      });

      if (existingPatientAppointment && existingPatientAppointment.timeslotId) {
        console.log(`⚠️  Bệnh nhân ${patientUserId} đã có appointment vào khung giờ này`);
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
          message: 'Bạn đã có appointment vào khung giờ này. Vui lòng chọn khung giờ khác.'
        };
      }
    }

    // ⭐ THÊM: Validate duration của slot phải khớp với service
    const slotStartTime = new Date(startTime);
    const slotEndTime = new Date(endTime);
    const slotDurationMinutes = (slotEndTime - slotStartTime) / 60000;
    let serviceDurationMinutes = service.durationMinutes;

    console.log('🔍 DEBUG getAvailableDoctorsForTimeSlot:');
    console.log('   - ServiceID:', serviceId);
    console.log('   - Service Name:', service.serviceName);
    console.log('   - Date:', date);
    console.log('   - Start Time Input:', startTime);
    console.log('   - End Time Input:', endTime);
    console.log('   - Slot Start:', slotStartTime.toISOString());
    console.log('   - Slot End:', slotEndTime.toISOString());
    console.log('   - Slot Duration (Minutes):', slotDurationMinutes);
    console.log('   - Service Duration (Minutes - raw):', serviceDurationMinutes);

    // ⭐ THÊM: Validate service duration - nếu không hợp lý, dùng duration tính từ slot
    if (!serviceDurationMinutes || serviceDurationMinutes <= 5 || serviceDurationMinutes > 480) {
      console.warn(`⚠️  Service duration ${serviceDurationMinutes} không hợp lệ, sử dụng slot duration ${slotDurationMinutes}`);
      serviceDurationMinutes = slotDurationMinutes;
    }

    console.log('   - Service Duration (Minutes - final):', serviceDurationMinutes);
    console.log('   - Duration Match:', slotDurationMinutes === serviceDurationMinutes);

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

        console.log(`\n👨‍⚕️ Checking doctor: ${doctor.fullName} (${doctor._id})`);
        console.log(`   Schedule found: ${schedule ? 'YES' : 'NO'}`);

        // ⭐ THÊM: Nếu không có schedule → Tự động tạo
        if (!schedule) {
          console.log(`⚠️  Bác sĩ ${doctor._id} không có schedule cho ngày ${searchDate.toISOString().split('T')[0]}, tự động tạo...`);
          
          try {
            const defaultSchedules = [
              {
                doctorUserId: doctor._id,
                date: searchDate,
                shift: 'Morning',
                startTime: new Date(searchDate).setHours(1, 0, 0),  // 1h UTC = 8h Vietnam time
                endTime: new Date(searchDate).setHours(5, 0, 0),    // 5h UTC = 12h Vietnam time
                status: 'Available',
                maxSlots: 4
              },
              {
                doctorUserId: doctor._id,
                date: searchDate,
                shift: 'Afternoon',
                startTime: new Date(searchDate).setHours(7, 0, 0),  // 7h UTC = 14h Vietnam time
                endTime: new Date(searchDate).setHours(11, 0, 0),   // 11h UTC = 18h Vietnam time
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

        console.log(`   Schedule: ${scheduleStart.toISOString()} - ${scheduleEnd.toISOString()}`);
        console.log(`   Slot: ${slotStartTime.toISOString()} - ${slotEndTime.toISOString()}`);
        console.log(`   Slot in schedule: ${slotStartTime >= scheduleStart && slotEndTime <= scheduleEnd}`);

        if (slotStartTime < scheduleStart || slotEndTime > scheduleEnd) {
          console.log(`   ❌ SKIP: Slot nằm ngoài schedule`);
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
          console.log(`   ❌ SKIP: Slot has conflict`);
          continue; // Khung giờ này đã bị đặt
        }

        // Bác sĩ này có khung giờ này rảnh
        console.log(`   ✅ AVAILABLE`);
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
    
    console.log('🔍 Service info for generateAvailableSlotsByDate:');
    console.log('   - Service ID:', serviceId);
    console.log('   - Service Name:', service.serviceName);
    console.log('   - Duration Minutes:', serviceDuration);
    console.log('   - Service object:', JSON.stringify({
      name: service.serviceName,
      durationMinutes: service.durationMinutes,
      category: service.category,
      status: service.status
    }, null, 2));

    // ⭐ THÊM: Validate service duration - nếu không hợp lý, dùng 30 phút mặc định
    const finalServiceDuration = (serviceDuration && serviceDuration > 5 && serviceDuration <= 480) 
      ? serviceDuration 
      : 30;
    
    if (finalServiceDuration !== serviceDuration) {
      console.warn(`⚠️  Service duration ${serviceDuration} không hợp lệ, sử dụng mặc định 30 phút`);
    }

    // 3. Chuẩn bị ngày tìm kiếm
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    console.log('🔍 Search date:', searchDate.toISOString());
    console.log('📅 Searching for doctors with schedule on:', searchDate.toISOString().split('T')[0]);

    // ⭐ THÊM: Auto-create schedule cho TOÀN BỘ ngày (1 lần duy nhất)
    // Kiểm tra xem ngày này đã có schedule nào chưa
    const existingSchedules = await DoctorSchedule.findOne({
      date: searchDate,
      status: 'Available'
    });

    if (!existingSchedules) {
      console.log(`⚠️  Ngày ${searchDate.toISOString().split('T')[0]} chưa có schedule, tự động tạo cho tất cả bác sĩ...`);
      
      try {
        // Tạo schedule cho TẤT CẢ bác sĩ 1 lần
        const doctors = await User.find({
          role: 'Doctor',
          status: 'Active'
        }).select('_id');

        const schedulesToCreate = [];
        for (const doctor of doctors) {
          schedulesToCreate.push(
            {
              doctorUserId: doctor._id,
              date: searchDate,
              shift: 'Morning',
              startTime: new Date(searchDate).setHours(1, 0, 0),  // 1h UTC = 8h Vietnam time
              endTime: new Date(searchDate).setHours(5, 0, 0),    // 5h UTC = 12h Vietnam time
              status: 'Available',
              maxSlots: 4
            },
            {
              doctorUserId: doctor._id,
              date: searchDate,
              shift: 'Afternoon',
              startTime: new Date(searchDate).setHours(7, 0, 0),  // 7h UTC = 14h Vietnam time
              endTime: new Date(searchDate).setHours(11, 0, 0),   // 11h UTC = 18h Vietnam time
              status: 'Available',
              maxSlots: 4
            }
          );
        }
        
        await DoctorSchedule.insertMany(schedulesToCreate);
        console.log(`✅ Đã tạo ${schedulesToCreate.length} schedules cho ${doctors.length} bác sĩ vào ngày ${searchDate.toISOString().split('T')[0]}`);
      } catch (error) {
        console.error('❌ Lỗi tạo schedule tự động:', error);
        // Không throw error, tiếp tục xử lý
      }
    }

    // 4. Lấy tất cả bác sĩ đang active
    const doctors = await User.find({
      role: 'Doctor',
      status: 'Active'
    }).select('_id fullName specialization');

    console.log(`📋 Tìm thấy ${doctors.length} bác sĩ active`);

    if (doctors.length === 0) {
      return {
        date: searchDate,
        slots: []
      };
    }

    // 5. Lấy schedules của tất cả bác sĩ trong ngày
    const schedules = await DoctorSchedule.find({
      doctorUserId: { $in: doctors.map(d => d._id) },
      date: searchDate,
      status: 'Available'
    });

    console.log(`📋 Tìm thấy ${schedules.length} schedules`);

    if (schedules.length === 0) {
      return {
        date: searchDate,
        slots: []
      };
    }

    // 6. Lấy tất cả appointments đã book trong ngày này
    const appointments = await Appointment.find({
      doctorUserId: { $in: doctors.map(d => d._id) },
      status: { $in: ['Pending', 'Approved', 'CheckedIn'] }
    }).populate('timeslotId', 'startTime endTime doctorUserId');

    // 7. Tạo map của booked timeslots theo doctorId
    const bookedSlotsByDoctor = {};
    for (const apt of appointments) {
      if (apt.timeslotId) {
        const docId = apt.timeslotId.doctorUserId.toString();
        if (!bookedSlotsByDoctor[docId]) {
          bookedSlotsByDoctor[docId] = [];
        }
        bookedSlotsByDoctor[docId].push({
          start: new Date(apt.timeslotId.startTime),
          end: new Date(apt.timeslotId.endTime)
        });
      }
    }

    // 8. Generate slots cho từng bác sĩ
    const allSlots = [];

    for (const schedule of schedules) {
      const doctorId = schedule.doctorUserId.toString();
      const doctor = doctors.find(d => d._id.toString() === doctorId);

      if (!doctor) continue;

      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      const slots = ScheduleHelper.generateTimeSlots({
        scheduleStart,
        scheduleEnd,
        serviceDuration: finalServiceDuration,
        breakAfterMinutes
      });

      // Lọc bỏ các slots đã được book
      const bookedSlots = bookedSlotsByDoctor[doctorId] || [];
      const availableSlots = slots.filter(slot => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        
        // Kiểm tra xem slot có bị trung với booked slot nào không
        return !bookedSlots.some(booked => {
          return (slotStart < booked.end && slotEnd > booked.start);
        });
      });

      // Thêm thông tin doctor vào mỗi slot
      availableSlots.forEach(slot => {
        allSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          doctor: {
            doctorUserId: doctor._id,
            fullName: doctor.fullName,
            specialization: doctor.specialization
          },
          doctorScheduleId: schedule._id
        });
      });
    }

    // 9. Sort theo thời gian
    allSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    console.log(`✅ Tổng cộng ${allSlots.length} slots khả dụng`);

    return {
      date: searchDate,
      slots: allSlots,
      totalSlots: allSlots.length
    };
  }
}

module.exports = new AvailableSlotService();