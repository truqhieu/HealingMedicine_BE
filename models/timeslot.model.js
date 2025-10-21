const mongoose = require('mongoose');

const timeslotSchema = new mongoose.Schema({
  doctorScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorSchedule',
  },
  doctorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  },
  startTime: {
    type: Date,
  },
  endTime: {
    type: Date,
  },
  breakAfterMinutes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Available', 'Booked', 'Cancelled', 'Completed'],
    default: 'Available',
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Timeslot', timeslotSchema,'timeslots');
