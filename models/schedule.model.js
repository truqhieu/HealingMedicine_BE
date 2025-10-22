const mongoose = require('mongoose');

const schedulesDoctorsSchema = new mongoose.Schema({
  doctorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: [true, 'Vui lòng chọn bác sĩ.']
  },
  date: {
    type: Date,
    required: [true, 'Vui lòng nhập ngày làm việc.']
  },
  shift: {
    type: String,
    enum: ['Morning', 'Afternoon'],
    required: [true, 'Vui lòng chọn ca làm.']
  },
  startTime: {
    type: Date,
    required: [true, 'Vui lòng nhập thời gian bắt đầu.']
  },
  endTime: {
    type: Date,
    required: [true, 'Vui lòng nhập thời gian kết thúc.']
  },
  status: {
    type: String,
    enum: ['Available', 'Booked', 'Unavailable'],
    default: 'Available'
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinicroom', 
    required: [true, 'Vui lòng chọn phòng khám.']
  },
  maxSlots: {
    type: Number,
    default: 4,
    min: [1, 'Số slot tối thiểu là 1.']
  }
}, { timestamps: true });

module.exports = mongoose.model('SchedulesDoctor', schedulesDoctorsSchema);
