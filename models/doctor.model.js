const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  doctorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vui lòng cung cấp ID người dùng bác sĩ']
  },
  specialization: {
    type: String,
    required: [true, 'Vui lòng nhập chuyên khoa'],
    trim: true
  },
  yearsOfExperience: {
    type: Number,
    required: [true, 'Vui lòng nhập số năm kinh nghiệm']
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
