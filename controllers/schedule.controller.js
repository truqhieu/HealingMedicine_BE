const DoctorSchedule = require('../models/doctorSchedule.model');
const User = require('../models/user.model');

/**
 * Cập nhật workingHours cho DoctorSchedule
 * PUT /api/schedule/:scheduleId/working-hours
 */
const updateWorkingHours = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { workingHours } = req.body;

    // Validation
    if (!workingHours) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp workingHours'
      });
    }

    // Validate workingHours format
    const { morningStart, morningEnd, afternoonStart, afternoonEnd } = workingHours;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(morningStart) || !timeRegex.test(morningEnd) || 
        !timeRegex.test(afternoonStart) || !timeRegex.test(afternoonEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian phải có định dạng HH:MM (24h)'
      });
    }

    // Validate time logic
    const morningStartTime = new Date(`2000-01-01T${morningStart}:00`);
    const morningEndTime = new Date(`2000-01-01T${morningEnd}:00`);
    const afternoonStartTime = new Date(`2000-01-01T${afternoonStart}:00`);
    const afternoonEndTime = new Date(`2000-01-01T${afternoonEnd}:00`);

    if (morningStartTime >= morningEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca sáng phải nhỏ hơn thời gian kết thúc ca sáng'
      });
    }

    if (afternoonStartTime >= afternoonEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca chiều phải nhỏ hơn thời gian kết thúc ca chiều'
      });
    }

    // Tìm DoctorSchedule
    const schedule = await DoctorSchedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch làm việc'
      });
    }

    // Cập nhật workingHours
    schedule.workingHours = workingHours;
    await schedule.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thời gian làm việc thành công',
      data: {
        scheduleId: schedule._id,
        doctorUserId: schedule.doctorUserId,
        date: schedule.date,
        shift: schedule.shift,
        workingHours: schedule.workingHours
      }
    });

  } catch (error) {
    console.error('Error in updateWorkingHours:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thời gian làm việc',
      error: error.message
    });
  }
};

/**
 * Lấy workingHours của DoctorSchedule
 * GET /api/schedule/:scheduleId/working-hours
 */
const getWorkingHours = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await DoctorSchedule.findById(scheduleId)
      .populate('doctorUserId', 'fullName');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch làm việc'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy thời gian làm việc thành công',
      data: {
        scheduleId: schedule._id,
        doctorUserId: schedule.doctorUserId._id,
        doctorName: schedule.doctorUserId.fullName,
        date: schedule.date,
        shift: schedule.shift,
        workingHours: schedule.workingHours
      }
    });

  } catch (error) {
    console.error('Error in getWorkingHours:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thời gian làm việc',
      error: error.message
    });
  }
};

/**
 * Cập nhật workingHours cho tất cả DoctorSchedule của một bác sĩ trong một ngày
 * PUT /api/schedule/doctor/:doctorId/date/:date/working-hours
 */
const updateDoctorWorkingHoursForDate = async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const { workingHours } = req.body;

    // Validation
    if (!workingHours) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp workingHours'
      });
    }

    // Validate workingHours format
    const { morningStart, morningEnd, afternoonStart, afternoonEnd } = workingHours;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(morningStart) || !timeRegex.test(morningEnd) || 
        !timeRegex.test(afternoonStart) || !timeRegex.test(afternoonEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian phải có định dạng HH:MM (24h)'
      });
    }

    // Validate time logic
    const morningStartTime = new Date(`2000-01-01T${morningStart}:00`);
    const morningEndTime = new Date(`2000-01-01T${morningEnd}:00`);
    const afternoonStartTime = new Date(`2000-01-01T${afternoonStart}:00`);
    const afternoonEndTime = new Date(`2000-01-01T${afternoonEnd}:00`);

    if (morningStartTime >= morningEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca sáng phải nhỏ hơn thời gian kết thúc ca sáng'
      });
    }

    if (afternoonStartTime >= afternoonEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca chiều phải nhỏ hơn thời gian kết thúc ca chiều'
      });
    }

    // Parse date
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    // Tìm tất cả DoctorSchedule của bác sĩ trong ngày đó
    const schedules = await DoctorSchedule.find({
      doctorUserId: doctorId,
      date: searchDate
    });

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch làm việc của bác sĩ trong ngày này'
      });
    }

    // Cập nhật workingHours cho tất cả schedules
    const updatePromises = schedules.map(schedule => {
      schedule.workingHours = workingHours;
      return schedule.save();
    });

    await Promise.all(updatePromises);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thời gian làm việc thành công',
      data: {
        doctorId,
        date: searchDate,
        updatedSchedules: schedules.length,
        workingHours
      }
    });

  } catch (error) {
    console.error('Error in updateDoctorWorkingHoursForDate:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thời gian làm việc',
      error: error.message
    });
  }
};

/**
 * Lấy danh sách tất cả bác sĩ với working hours
 * GET /api/schedule/doctors-with-working-hours
 */
const getDoctorsWithWorkingHours = async (req, res) => {
  try {
    // Lấy tất cả bác sĩ
    const doctors = await User.find({ role: 'Doctor' })
      .select('_id fullName email')
      .sort({ fullName: 1 });

    // Lấy working hours mặc định từ DoctorSchedule gần nhất của mỗi bác sĩ
    const doctorsWithWorkingHours = await Promise.all(
      doctors.map(async (doctor) => {
        // Tìm DoctorSchedule gần nhất của bác sĩ này
        const latestSchedule = await DoctorSchedule.findOne({
          doctorUserId: doctor._id
        })
        .sort({ createdAt: -1 });

        // Nếu không có schedule, sử dụng working hours mặc định
        const defaultWorkingHours = {
          morningStart: '08:00',
          morningEnd: '12:00',
          afternoonStart: '14:00',
          afternoonEnd: '18:00'
        };

        return {
          _id: doctor._id,
          fullName: doctor.fullName,
          email: doctor.email,
          workingHours: latestSchedule?.workingHours || defaultWorkingHours
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách bác sĩ với thời gian làm việc thành công',
      data: doctorsWithWorkingHours
    });

  } catch (error) {
    console.error('Error in getDoctorsWithWorkingHours:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách bác sĩ',
      error: error.message
    });
  }
};

/**
 * Cập nhật working hours cho tất cả DoctorSchedule của một bác sĩ
 * PUT /api/schedule/doctor/:doctorId/working-hours
 */
const updateDoctorWorkingHours = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { workingHours } = req.body;

    // Validation
    if (!workingHours) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp workingHours'
      });
    }

    // Validate workingHours format
    const { morningStart, morningEnd, afternoonStart, afternoonEnd } = workingHours;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(morningStart) || !timeRegex.test(morningEnd) || 
        !timeRegex.test(afternoonStart) || !timeRegex.test(afternoonEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian phải có định dạng HH:MM (24h)'
      });
    }

    // Validate time logic
    const morningStartTime = new Date(`2000-01-01T${morningStart}:00`);
    const morningEndTime = new Date(`2000-01-01T${morningEnd}:00`);
    const afternoonStartTime = new Date(`2000-01-01T${afternoonStart}:00`);
    const afternoonEndTime = new Date(`2000-01-01T${afternoonEnd}:00`);

    if (morningStartTime >= morningEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca sáng phải nhỏ hơn thời gian kết thúc ca sáng'
      });
    }

    if (afternoonStartTime >= afternoonEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu ca chiều phải nhỏ hơn thời gian kết thúc ca chiều'
      });
    }

    // Tìm tất cả DoctorSchedule của bác sĩ
    const schedules = await DoctorSchedule.find({
      doctorUserId: doctorId
    });

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch làm việc của bác sĩ'
      });
    }

    // Cập nhật workingHours cho tất cả schedules
    const updatePromises = schedules.map(schedule => {
      schedule.workingHours = workingHours;
      return schedule.save();
    });

    await Promise.all(updatePromises);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thời gian làm việc thành công',
      data: {
        doctorId,
        updatedSchedules: schedules.length,
        workingHours
      }
    });

  } catch (error) {
    console.error('Error in updateDoctorWorkingHours:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thời gian làm việc',
      error: error.message
    });
  }
};

module.exports = {
  updateWorkingHours,
  getWorkingHours,
  updateDoctorWorkingHoursForDate,
  getDoctorsWithWorkingHours,
  updateDoctorWorkingHours
};
