const DoctorSchedule = require('../models/doctorSchedule.model');
const User = require('../models/user.model');

class ScheduleService {

  /**
   * Validate working hours
   */
  _validateWorkingHours(workingHours) {
    const { morningStart, morningEnd, afternoonStart, afternoonEnd } = workingHours;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(morningStart) || !timeRegex.test(morningEnd) ||
      !timeRegex.test(afternoonStart) || !timeRegex.test(afternoonEnd)) {
      throw new Error('Thời gian phải có định dạng HH:MM (24h)');
    }

    // Validate time logic
    const morningStartTime = new Date(`2000-01-01T${morningStart}:00`);
    const morningEndTime = new Date(`2000-01-01T${morningEnd}:00`);
    const afternoonStartTime = new Date(`2000-01-01T${afternoonStart}:00`);
    const afternoonEndTime = new Date(`2000-01-01T${afternoonEnd}:00`);

    if (morningStartTime >= morningEndTime) {
      throw new Error('Thời gian bắt đầu ca sáng phải nhỏ hơn thời gian kết thúc ca sáng');
    }

    if (afternoonStartTime >= afternoonEndTime) {
      throw new Error('Thời gian bắt đầu ca chiều phải nhỏ hơn thời gian kết thúc ca chiều');
    }
  }

  /**
   * Cập nhật working hours cho một DoctorSchedule
   */
  async updateWorkingHours(scheduleId, workingHours) {
    if (!workingHours) {
      throw new Error('Vui lòng cung cấp workingHours');
    }

    this._validateWorkingHours(workingHours);

    const schedule = await DoctorSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error('Không tìm thấy lịch làm việc');
    }

    schedule.workingHours = workingHours;
    await schedule.save();

    return {
      scheduleId: schedule._id,
      doctorUserId: schedule.doctorUserId,
      date: schedule.date,
      shift: schedule.shift,
      workingHours: schedule.workingHours
    };
  }

  /**
   * Lấy working hours của một DoctorSchedule
   */
  async getWorkingHours(scheduleId) {
    const schedule = await DoctorSchedule.findById(scheduleId)
      .populate('doctorUserId', 'fullName');

    if (!schedule) {
      throw new Error('Không tìm thấy lịch làm việc');
    }

    return {
      scheduleId: schedule._id,
      doctorUserId: schedule.doctorUserId._id,
      doctorName: schedule.doctorUserId.fullName,
      date: schedule.date,
      shift: schedule.shift,
      workingHours: schedule.workingHours
    };
  }

  /**
   * Cập nhật working hours cho tất cả DoctorSchedule của một bác sĩ trong một ngày
   */
  async updateDoctorWorkingHoursForDate(doctorId, date, workingHours) {
    if (!workingHours) {
      throw new Error('Vui lòng cung cấp workingHours');
    }

    this._validateWorkingHours(workingHours);

    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    // Tìm tất cả DoctorSchedule của bác sĩ trong ngày đó
    const schedules = await DoctorSchedule.find({
      doctorUserId: doctorId,
      date: searchDate
    });

    if (schedules.length === 0) {
      throw new Error('Không tìm thấy lịch làm việc của bác sĩ trong ngày này');
    }

    // Cập nhật workingHours cho tất cả schedules
    const updatePromises = schedules.map(schedule => {
      schedule.workingHours = workingHours;
      return schedule.save();
    });

    await Promise.all(updatePromises);

    return {
      doctorId,
      date: searchDate,
      updatedSchedules: schedules.length,
      workingHours
    };
  }

  /**
   * Lấy danh sách tất cả bác sĩ với working hours
   */
  async getDoctorsWithWorkingHours() {
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

    return doctorsWithWorkingHours;
  }

  /**
   * Cập nhật working hours cho tất cả DoctorSchedule của một bác sĩ
   */
  async updateDoctorWorkingHours(doctorId, workingHours) {
    if (!workingHours) {
      throw new Error('Vui lòng cung cấp workingHours');
    }

    this._validateWorkingHours(workingHours);

    // Tìm tất cả DoctorSchedule của bác sĩ
    const schedules = await DoctorSchedule.find({
      doctorUserId: doctorId
    });

    if (schedules.length === 0) {
      throw new Error('Không tìm thấy lịch làm việc của bác sĩ');
    }

    // Cập nhật workingHours cho tất cả schedules
    const updatePromises = schedules.map(schedule => {
      schedule.workingHours = workingHours;
      return schedule.save();
    });

    await Promise.all(updatePromises);

    return {
      doctorId,
      updatedSchedules: schedules.length,
      workingHours
    };
  }
}

module.exports = new ScheduleService();

