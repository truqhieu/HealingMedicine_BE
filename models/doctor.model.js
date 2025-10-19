const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  doctorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  specialization: {
    type: String,
    trim: true
  },
  yearsOfExperience: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['Available', 'Busy', 'On Leave', 'Inactive'],
    default: 'Available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', doctorSchema);
