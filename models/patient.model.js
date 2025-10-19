const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  emergencyContact: {
    type: Object
  },
  lastVisitDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Patient', patientSchema);
