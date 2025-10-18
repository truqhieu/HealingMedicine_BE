const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vui lòng cung cấp ID người dùng']
  },
  position: {
    type: String,
    required: [true, 'Vui lòng nhập vị trí công việc'],
    trim: true
  },
  workShift: {
    type: String,
    required: [true, 'Vui lòng nhập ca làm việc'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Staff', staffSchema);