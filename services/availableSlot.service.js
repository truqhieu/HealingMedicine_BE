const DoctorSchedule = require('../models/doctorSchedule.model');
const Appointment = require('../models/appointment.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');
const ScheduleHelper = require('../utils/scheduleHelper');

class AvailableSlotService {

  /**
   * ⭐ HELPER: Tự động tạo schedule cho một ngày nếu chưa có
   * Đảm bảo mỗi bác sĩ chỉ có 1 Morning và 1 Afternoon schedule
   * @private
   */
  async _ensureSchedulesForDate(searchDate) {
    try {
      // Kiểm tra xem ngày này đã có schedule nào chưa
      const existingSchedulesCount = await DoctorSchedule.countDocuments({
        date: searchDate,
        status: 'Available'
      });

      if (existingSchedulesCount > 0) {
        console.log(`✅ Ngày ${searchDate.toISOString().split('T')[0]} đã có ${existingSchedulesCount} schedules`);
        return;
      }

      console.log(`⚠️  Ngày ${searchDate.toISOString().split('T')[0]} chưa có schedule, tự động tạo...`);
      
      // Lấy tất cả bác sĩ ACTIVE
      const doctors = await User.find({
        role: 'Doctor',
        status: 'Active'
      }).select('_id');

      if (doctors.length === 0) {
        console.log('⚠️  Không có bác sĩ ACTIVE nào');
        return;
      }

      // Tạo schedule cho TẤT CẢ bác sĩ - mỗi bác sĩ 1 Morning + 1 Afternoon
      const schedulesToCreate = [];
      for (const doctor of doctors) {
        // Tạo Date objects với giờ Việt Nam
        const morningStart = new Date(searchDate);
        morningStart.setHours(8, 0, 0, 0);
        
        const morningEnd = new Date(searchDate);
        morningEnd.setHours(12, 0, 0, 0);
        
        const afternoonStart = new Date(searchDate);
        afternoonStart.setHours(14, 0, 0, 0);
        
        const afternoonEnd = new Date(searchDate);
        afternoonEnd.setHours(18, 0, 0, 0);
        
        schedulesToCreate.push(
          {
            doctorUserId: doctor._id,
            date: searchDate,
            shift: 'Morning',
            startTime: morningStart,
            endTime: morningEnd,
            status: 'Available',
            maxSlots: 4
          },
          {
            doctorUserId: doctor._id,
            date: searchDate,
            shift: 'Afternoon',
            startTime: afternoonStart,
            endTime: afternoonEnd,
            status: 'Available',
            maxSlots: 4
          }
        );
      }
      
      // ⭐ Dùng insertMany với ordered: false để bỏ qua duplicate keys
      const result = await DoctorSchedule.insertMany(schedulesToCreate, { ordered: false });
      console.log(`✅ Tạo ${result.length} schedules mới cho ${doctors.length} bác sĩ`);
      
    } catch (error) {
      // ⭐ Nếu lỗi là duplicate key (code 11000), bỏ qua vì đã có schedule rồi
      if (error.code === 11000 || error.name === 'BulkWriteError') {
        console.log(`⚠️  Một số schedules đã tồn tại (bỏ qua duplicate)`);
      } else {
        console.error(`❌ Lỗi tạo schedules: ${error.message}`);
      }
    }
  }

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

    // ⭐ Tự động tạo schedule nếu chưa có (dùng helper method chung)
    await this._ensureSchedulesForDate(searchDate);

    // 5. Duyệt qua từng bác sĩ để lấy danh sách có schedule vào ngày đó
    const availableDoctors = [];

    for (const doctor of doctors) {
      try {
        // Kiểm tra xem bác sĩ có schedule vào ngày đó không (có thể có nhiều shifts)
        const schedules = await DoctorSchedule.find({
          doctorUserId: doctor._id,
          date: searchDate,
          status: 'Available'
        });

        // ⭐ Nếu vẫn không có schedule (rare case) → skip
        if (!schedules || schedules.length === 0) {
          console.warn(`⚠️  Bác sĩ ${doctor._id} không có schedule cho ngày này, skip...`);
          continue;
        }

        // Bác sĩ này có schedule vào ngày đó → thêm vào danh sách
        // (FE sẽ chọn bác sĩ, sau đó lấy schedule range của bác sĩ đó)
        availableDoctors.push({
          doctorId: doctor._id,
          doctorName: doctor.fullName,
          email: doctor.email,
          phoneNumber: doctor.phoneNumber,
          available: true,
          totalSchedules: schedules.length
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
  async getAvailableDoctorsForTimeSlot({ serviceId, date, startTime, endTime, patientUserId, appointmentFor }) {
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

    // ⭐ THÊM: Lấy danh sách bác sĩ mà user (self) đã có appointment vào khung giờ này
    // (nếu appointmentFor === 'other', sẽ exclude các bác sĩ này khỏi danh sách)
    let userAppointedDoctorIds = [];
    if (patientUserId && appointmentFor === 'other') {
      console.log(`🔍 [${appointmentFor}] Lấy danh sách bác sĩ mà user ${patientUserId} đã đặt vào khung giờ này`);
      
      const slotStartTime = new Date(startTime);
      const slotEndTime = new Date(endTime);
      
      const userAppointmentsInSlot = await Appointment.find({
        patientUserId,
        status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
        timeslotId: { $exists: true }
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime doctorUserId',
        match: {
          startTime: { $gte: slotStartTime, $lt: slotEndTime },
          endTime: { $gt: slotStartTime, $lte: slotEndTime }
        }
      });
      
      userAppointedDoctorIds = userAppointmentsInSlot
        .filter(apt => apt.timeslotId)
        .map(apt => apt.timeslotId.doctorUserId?.toString())
        .filter(id => id);
      
      console.log(`   - Bác sĩ user đã đặt: ${userAppointedDoctorIds.length}`, userAppointedDoctorIds);
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
        
        // ⭐ THÊM: Nếu appointmentFor === 'other', check xem bác sĩ này có trong danh sách user đã đặt không
        if (appointmentFor === 'other' && userAppointedDoctorIds.length > 0) {
          if (userAppointedDoctorIds.includes(doctor._id.toString())) {
            console.log(`   ⭐ EXCLUDE: User đã đặt với bác sĩ này vào khung giờ này`);
            continue; // Loại bỏ bác sĩ này
          }
        }
        
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
   * @param {string} patientUserId - ID của user đang đặt lịch (để exclude slots đã đặt)
   * @param {string} customerFullName - Tên người khác (để validate conflict)
   * @param {string} customerEmail - Email người khác (để validate conflict)
   */
  async generateAvailableSlotsByDate({ 
    serviceId, 
    date, 
    breakAfterMinutes = 10, 
    patientUserId = null,
    customerFullName = null,
    customerEmail = null
  }) {
    // 1. Validate input
    if (!serviceId || !date) {
      throw new Error('Vui lòng cung cấp đầy đủ serviceId và date');
    }

    // ⭐ DEBUG: Log input parameters
    console.log('🔍 [generateAvailableSlotsByDate] INPUT PARAMS:');
    console.log('   - patientUserId:', patientUserId || 'NULL (WILL NOT EXCLUDE USER SLOTS)');
    console.log('   - customerFullName:', customerFullName || 'NULL');
    console.log('   - customerEmail:', customerEmail || 'NULL');
    console.log('   - breakAfterMinutes:', breakAfterMinutes);

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

    // ⭐ Tự động tạo schedule nếu chưa có (dùng helper method chung)
    await this._ensureSchedulesForDate(searchDate);

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

    // 6.5. ⭐ Nếu có patientUserId, lấy thêm các appointments của user này để exclude
    let patientBookedSlots = [];
    if (patientUserId) {
      const patientAppointments = await Appointment.find({
        patientUserId: patientUserId,
        status: { $in: ['Pending', 'Approved', 'CheckedIn', 'Completed'] }
      }).populate('timeslotId', 'startTime endTime');

      patientBookedSlots = patientAppointments
        .filter(apt => apt.timeslotId)
        .map(apt => ({
          start: new Date(apt.timeslotId.startTime),
          end: new Date(apt.timeslotId.endTime)
        }));

      console.log(`👤 User ${patientUserId} đã đặt ${patientBookedSlots.length} slots`);
    }

    // 6.6. ⭐ THÊM: Nếu đặt cho người khác, lấy appointments của người khác này để exclude
    let customerBookedSlots = [];
    if (customerFullName && customerEmail) {
      console.log(`👤 Tìm appointments của customer: ${customerFullName} <${customerEmail}>`);
      
      const Customer = require('../models/customer.model');
      
      // Tìm customer có fullName + email match (case-insensitive)
      const customer = await Customer.findOne({
        fullName: new RegExp(`^${customerFullName}$`, 'i'),
        email: new RegExp(`^${customerEmail}$`, 'i')
      });

      if (customer) {
        console.log(`✅ Tìm thấy customer: ${customer._id}`);
        
        const customerAppointments = await Appointment.find({
          customerId: customer._id,
          status: { $in: ['Pending', 'Approved', 'CheckedIn', 'Completed'] }
        }).populate('timeslotId', 'startTime endTime');

        customerBookedSlots = customerAppointments
          .filter(apt => apt.timeslotId)
          .map(apt => ({
            start: new Date(apt.timeslotId.startTime),
            end: new Date(apt.timeslotId.endTime)
          }));

        console.log(`👤 Customer ${customerFullName} đã đặt ${customerBookedSlots.length} slots`);
      } else {
        console.log(`⚠️ Không tìm thấy customer: ${customerFullName} <${customerEmail}>`);
      }
    }

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

      // Lọc bỏ các slots đã được book (bởi bất kỳ ai)
      const bookedSlots = bookedSlotsByDoctor[doctorId] || [];
      let availableSlots = slots.filter(slot => {
        const slotStart = new Date(slot.startTime);
        const slotEnd = new Date(slot.endTime);
        
        // Kiểm tra xem slot có bị trung với booked slot nào không
        return !bookedSlots.some(booked => {
          return (slotStart < booked.end && slotEnd > booked.start);
        });
      });

      // ⭐ Exclude slots mà user hiện tại đã đặt (CHỈ khi appointmentFor === 'self')
      // Khi appointmentFor === 'other', patientUserId sẽ là null → skip bước này
      if (patientUserId && patientBookedSlots.length > 0) {
        console.log(`\n🔴 [Doctor ${doctor.fullName}] EXCLUDING USER BOOKED SLOTS (appointmentFor=self):`);
        console.log(`   - patientUserId: ${patientUserId}`);
        console.log(`   - patientBookedSlots count: ${patientBookedSlots.length}`);
        patientBookedSlots.forEach((booked, idx) => {
          console.log(`   - Booked slot ${idx}: ${booked.start.toISOString()} - ${booked.end.toISOString()}`);
        });
        
        console.log(`   - availableSlots BEFORE exclude: ${availableSlots.length}`);
        availableSlots.forEach((slot, idx) => {
          console.log(`     [${idx}] ${slot.startTime} - ${slot.endTime}`);
        });
        
        const slotsBeforeFilter = availableSlots.length;
        availableSlots = availableSlots.filter(slot => {
          const slotStart = new Date(slot.startTime);
          const slotEnd = new Date(slot.endTime);
          
          // Kiểm tra xem slot có trùng với slots user đã đặt không
          const isBooked = patientBookedSlots.some(booked => {
            return (slotStart.getTime() === booked.start.getTime() && 
                    slotEnd.getTime() === booked.end.getTime());
          });
          
          if (isBooked) {
            console.log(`     ❌ EXCLUDED: ${slot.startTime} - ${slot.endTime}`);
          }
          
          return !isBooked;
        });
        
        console.log(`   - availableSlots AFTER exclude: ${availableSlots.length} (removed ${slotsBeforeFilter - availableSlots.length})`);
      } else if (patientUserId && patientBookedSlots.length === 0) {
        console.log(`\n✅ [Doctor ${doctor.fullName}] NO USER BOOKED SLOTS TO EXCLUDE (appointmentFor=self, user has no appointments)`);
      } else if (!patientUserId) {
        console.log(`\n🟢 [Doctor ${doctor.fullName}] NOT EXCLUDING USER SLOTS (appointmentFor=other, patientUserId=null)`);
      }
      
      // ⭐ Exclude slots của customer (nếu đặt cho người khác và customer đã có appointment)
      // để tránh conflict double booking cho cùng 1 người
      if (customerBookedSlots.length > 0) {
        console.log(`\n🔴 [Doctor ${doctor.fullName}] EXCLUDING CUSTOMER BOOKED SLOTS:`);
        console.log(`   - customerBookedSlots count: ${customerBookedSlots.length}`);
        customerBookedSlots.forEach((booked, idx) => {
          console.log(`   - Booked slot ${idx}: ${booked.start.toISOString()} - ${booked.end.toISOString()}`);
        });
        
        console.log(`   - availableSlots BEFORE exclude: ${availableSlots.length}`);
        availableSlots.forEach((slot, idx) => {
          console.log(`     [${idx}] ${slot.startTime} - ${slot.endTime}`);
        });
        
        const slotsBeforeFilter = availableSlots.length;
        availableSlots = availableSlots.filter(slot => {
          const slotStart = new Date(slot.startTime);
          const slotEnd = new Date(slot.endTime);
          
          const isBooked = customerBookedSlots.some(booked => {
            return (slotStart.getTime() === booked.start.getTime() && 
                    slotEnd.getTime() === booked.end.getTime());
          });
          
          if (isBooked) {
            console.log(`     ❌ EXCLUDED: ${slot.startTime} - ${slot.endTime}`);
          }
          
          return !isBooked;
        });
        
        console.log(`   - availableSlots AFTER exclude: ${availableSlots.length} (removed ${slotsBeforeFilter - availableSlots.length})`);
      } else {
        console.log(`\n🟢 [Doctor ${doctor.fullName}] NO CUSTOMER BOOKED SLOTS (no customer info or customer not found)`);
      }

      // Thêm thông tin doctor và format displayTime theo giờ Việt Nam
      availableSlots.forEach(slot => {
        // Format thời gian hiển thị theo timezone Việt Nam
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);
        
        const formatVNTime = (date) => {
          return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Ho_Chi_Minh'
          });
        };
        
        const displayTime = `${formatVNTime(start)} - ${formatVNTime(end)}`;
        
        allSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          displayTime: displayTime, // Format sẵn theo giờ VN
          doctor: {
            doctorUserId: doctor._id,
            fullName: doctor.fullName,
            specialization: doctor.specialization
          },
          doctorScheduleId: schedule._id
        });
      });
      
      console.log(`\n✅ [Doctor ${doctor.fullName}] Final available slots: ${availableSlots.length}`);
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

  /**
   * ⭐ NEW: Lấy khoảng thời gian khả dụng của một bác sĩ cụ thể vào 1 ngày
   */
  async getDoctorScheduleRange({ doctorUserId, serviceId, date }) {
    // 1. Validate doctor
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

    // 2. Validate service
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }
    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không hoạt động');
    }

    // 3. Lấy doctor schedule (DoctorSchedule) của ngày đó
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    const schedules = await DoctorSchedule.find({
      doctorUserId,
      date: searchDate,
      status: 'Available'
    }).sort({ startTime: 1 });

    if (schedules.length === 0) {
      return {
        doctorId: doctorUserId,
        doctorName: doctor.fullName,
        date: searchDate,
        scheduleRange: null,
        message: 'Bác sĩ không có lịch làm việc vào ngày này'
      };
    }

    // 4. Lấy danh sách appointments đã book của doctor vào ngày này
    const bookedAppointments = await Appointment.find({
      doctorUserId,
      status: { $in: ['Pending', 'Approved', 'CheckedIn', 'PendingPayment'] },
      timeslotId: { $exists: true }
    }).populate({
      path: 'timeslotId',
      select: 'startTime endTime breakAfterMinutes'
    });

    // Filter appointments vào ngày đang xét
    const bookedSlots = bookedAppointments
      .filter(apt => {
        if (!apt.timeslotId) return false;
        const slotDate = new Date(apt.timeslotId.startTime);
        return slotDate.toISOString().split('T')[0] === searchDate.toISOString().split('T')[0];
      })
      .map(apt => ({
        start: new Date(apt.timeslotId.startTime),
        end: new Date(apt.timeslotId.endTime),
        breakAfter: apt.timeslotId.breakAfterMinutes || 10
      }))
      .sort((a, b) => a.start - b.start);

    // Helper function
    const formatTime = (date) => {
      const d = new Date(date);
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // Function tính available gaps cho một shift
    const calculateAvailableGaps = (shiftStart, shiftEnd, bookedSlots) => {
      const gaps = [];
      let currentStart = new Date(shiftStart);

      for (const slot of bookedSlots) {
        // Nếu slot nằm ngoài shift này, skip
        if (slot.end <= shiftStart || slot.start >= shiftEnd) continue;

        // Nếu có khoảng trống trước slot này
        if (currentStart < slot.start) {
          gaps.push({
            start: currentStart,
            end: slot.start
          });
        }

        // Di chuyển currentStart đến sau slot này + break time
        const slotEndWithBreak = new Date(slot.end.getTime() + slot.breakAfter * 60000);
        currentStart = slotEndWithBreak > currentStart ? slotEndWithBreak : new Date(slot.end);
      }

      // Nếu còn khoảng trống sau slot cuối cùng
      if (currentStart < shiftEnd) {
        gaps.push({
          start: currentStart,
          end: shiftEnd
        });
      }

      return gaps;
    };

    // Group theo shift và tính available gaps
    const morningSchedules = schedules.filter(s => s.shift === 'Morning');
    const afternoonSchedules = schedules.filter(s => s.shift === 'Afternoon');

    const scheduleRanges = [];
    
    if (morningSchedules.length > 0) {
      const morningStart = new Date(Math.min(...morningSchedules.map(s => new Date(s.startTime).getTime())));
      const morningEnd = new Date(Math.max(...morningSchedules.map(s => new Date(s.endTime).getTime())));
      
      const availableGaps = calculateAvailableGaps(morningStart, morningEnd, bookedSlots);
      
      scheduleRanges.push({
        shift: 'Morning',
        shiftDisplay: 'Buổi sáng',
        startTime: morningStart.toISOString(),
        endTime: morningEnd.toISOString(),
        availableGaps: availableGaps.map(gap => ({
          start: gap.start.toISOString(),
          end: gap.end.toISOString(),
          display: `${formatTime(gap.start)}-${formatTime(gap.end)}`
        })),
        displayRange: availableGaps.map(gap => `${formatTime(gap.start)}-${formatTime(gap.end)}`).join(', ') || 'Đã hết chỗ'
      });
    }
    
    if (afternoonSchedules.length > 0) {
      const afternoonStart = new Date(Math.min(...afternoonSchedules.map(s => new Date(s.startTime).getTime())));
      const afternoonEnd = new Date(Math.max(...afternoonSchedules.map(s => new Date(s.endTime).getTime())));
      
      const availableGaps = calculateAvailableGaps(afternoonStart, afternoonEnd, bookedSlots);
      
      scheduleRanges.push({
        shift: 'Afternoon',
        shiftDisplay: 'Buổi chiều',
        startTime: afternoonStart.toISOString(),
        endTime: afternoonEnd.toISOString(),
        availableGaps: availableGaps.map(gap => ({
          start: gap.start.toISOString(),
          end: gap.end.toISOString(),
          display: `${formatTime(gap.start)}-${formatTime(gap.end)}`
        })),
        displayRange: availableGaps.map(gap => `${formatTime(gap.start)}-${formatTime(gap.end)}`).join(', ') || 'Đã hết chỗ'
      });
    }

    console.log('📊 [getDoctorScheduleRange]');
    console.log('   - Doctor:', doctor.fullName);
    console.log('   - Date:', searchDate.toISOString().split('T')[0]);
    console.log('   - Schedule ranges:', scheduleRanges);

    return {
      doctorId: doctorUserId,
      doctorName: doctor.fullName,
      date: searchDate,
      serviceName: service.serviceName,
      serviceDuration: service.durationMinutes,
      doctorScheduleId: schedules.length > 0 ? schedules[0]._id : null,
      scheduleRanges: scheduleRanges,
      totalSchedules: schedules.length
    };
  }

  /**
   * ⭐ NEW: Validate appointment time
   * Check: thời gian nhập có nằm trong doctor schedule không và có doctor khả dụng không
   */
  async validateAppointmentTime({ doctorUserId, serviceId, date, startTime, patientUserId = null }) {
    // 1. Lấy schedule ranges
    const scheduleRangeResult = await this.getDoctorScheduleRange({
      doctorUserId,
      serviceId,
      date
    });

    if (!scheduleRangeResult.scheduleRanges || scheduleRangeResult.scheduleRanges.length === 0) {
      throw new Error(scheduleRangeResult.message || 'Bác sĩ không có lịch làm việc vào ngày này');
    }

    // 2. Validate service để lấy duration
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Không tìm thấy dịch vụ');
    }

    const serviceDuration = service.durationMinutes;

    // 3. Calculate end time
    const startTimeObj = new Date(startTime);
    const endTimeObj = new Date(startTimeObj.getTime() + serviceDuration * 60000);

    // ⭐ 3.5. Check conflict cho bệnh nhân
    // Logic phụ thuộc vào appointmentFor và thông tin customer
    if (patientUserId) {
      // Lấy tất cả appointments của user trong khoảng thời gian này
      const existingAppointments = await Appointment.find({
        patientUserId,
        status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
        timeslotId: { $exists: true }
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime doctorUserId'
      })
      .populate({
        path: 'customerId',
        select: 'fullName email'
      });

      // Filter appointments có overlap với thời gian đang đặt
      const overlappingAppointments = existingAppointments.filter(apt => {
        if (!apt.timeslotId) return false;
        
        const aptStart = new Date(apt.timeslotId.startTime);
        const aptEnd = new Date(apt.timeslotId.endTime);
        
        // Check overlap: (start1 < end2) AND (end1 > start2)
        return (startTimeObj < aptEnd && endTimeObj > aptStart);
      });

      if (overlappingAppointments.length > 0) {
        // Có appointment trùng giờ → cần validate theo logic
        for (const apt of overlappingAppointments) {
          const aptStart = new Date(apt.timeslotId.startTime);
          const aptEnd = new Date(apt.timeslotId.endTime);
          const aptStartDisplay = `${String(aptStart.getUTCHours()).padStart(2, '0')}:${String(aptStart.getUTCMinutes()).padStart(2, '0')}`;
          const aptEndDisplay = `${String(aptEnd.getUTCHours()).padStart(2, '0')}:${String(aptEnd.getUTCMinutes()).padStart(2, '0')}`;

          // Case 1: User đã có appointment cho BẢN THÂN vào giờ này
          if (apt.appointmentFor === 'self') {
            throw new Error(
              `Bạn đã có lịch khám cho bản thân vào ${aptStartDisplay} - ${aptEndDisplay}. ` +
              `Vui lòng chọn thời gian khác.`
            );
          }

          // Case 2: User đã đặt cho NGƯỜI THÂN vào giờ này
          // → Chỉ cho phép nếu đặt cho người thân KHÁC và bác sĩ KHÁC
          if (apt.appointmentFor === 'other' && apt.customerId) {
            // Check nếu đặt cùng bác sĩ → không được
            if (apt.timeslotId.doctorUserId && apt.timeslotId.doctorUserId.toString() === doctorUserId) {
              throw new Error(
                `Bạn đã đặt lịch với bác sĩ này vào ${aptStartDisplay} - ${aptEndDisplay} cho người thân. ` +
                `Vui lòng chọn bác sĩ khác hoặc thời gian khác.`
              );
            }

            // Note: Validate customer duplicate sẽ được làm ở createAppointment
            // vì ở đây chưa có thông tin fullName/email của customer mới
          }
        }
      }
    }

    // 4. Validate: startTime và endTime phải nằm trong một trong các schedule ranges
    const scheduleRanges = scheduleRangeResult.scheduleRanges;
    
    // Kiểm tra xem thời gian có nằm trong bất kỳ range nào không
    const isInValidRange = scheduleRanges.some(range => {
      const rangeStart = new Date(range.startTime);
      const rangeEnd = new Date(range.endTime);
      return startTimeObj >= rangeStart && endTimeObj <= rangeEnd;
    });

    console.log('🔍 [validateAppointmentTime]');
    console.log('   - startTime:', startTimeObj.toISOString());
    console.log('   - endTime:', endTimeObj.toISOString());
    console.log('   - scheduleRanges:', scheduleRanges.map(r => `${r.shiftDisplay}: ${r.displayRange}`));
    console.log('   - isInValidRange:', isInValidRange);

    if (!isInValidRange) {
      const rangesText = scheduleRanges.map(r => `${r.shiftDisplay}: ${r.displayRange}`).join(', ');
      throw new Error(
        `Thời gian nhập không nằm trong lịch làm việc. Bác sĩ rảnh: ${rangesText}`
      );
    }

    // 5. Check xem doctor có bị booked trong khoảng thời gian này không
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    const bookedAppointments = await Appointment.find({
      doctorUserId,
      status: { $in: ['Pending', 'Approved', 'CheckedIn'] },
      timeslotId: { $exists: true }
    }).populate({
      path: 'timeslotId',
      select: 'startTime endTime',
      match: {
        startTime: { $gte: searchDate.toISOString() }
      }
    });

    const validAppointments = bookedAppointments.filter(apt => apt.timeslotId !== null);

    // Check conflict
    const hasConflict = validAppointments.some(apt => {
      const aptStart = new Date(apt.timeslotId.startTime);
      const aptEnd = new Date(apt.timeslotId.endTime);
      
      return (startTimeObj < aptEnd && endTimeObj > aptStart);
    });

    if (hasConflict) {
      throw new Error('Bác sĩ đã có lịch khám vào thời gian này');
    }

    return {
      doctorId: doctorUserId,
      doctorName: scheduleRangeResult.doctorName,
      date,
      startTime: startTimeObj.toISOString(),
      endTime: endTimeObj.toISOString(),
      serviceName: service.serviceName,
      serviceDuration,
      scheduleRanges: scheduleRangeResult.scheduleRanges,
      isAvailable: true,
      message: 'Thời gian hợp lệ, bác sĩ khả dụng'
    };
  }
}

module.exports = new AvailableSlotService();