const mongoose = require('mongoose');

const doctorScheduleSchema = new mongoose.Schema({
  doctorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
  },
  shift: {
    type: String,
    enum: ['Morning', 'Afternoon'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Unavailable', 'Booked', 'Cancelled'],
    default: 'Available',
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinicroom',
  },
  maxSlots: {
    type: Number,
    required: true,
    min: 1
  }
}, {
  timestamps: true
});

// ⭐ Unique index để ngăn duplicate schedule cho cùng 1 bác sĩ, ngày, và ca
doctorScheduleSchema.index({ doctorUserId: 1, date: 1, shift: 1 }, { unique: true });
doctorScheduleSchema.index({ status: 1 });

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema, 'doctorschedules');

