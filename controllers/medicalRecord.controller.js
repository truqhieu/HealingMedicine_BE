const MedicalRecord = require('../models/medicalRecord.model');
const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');

function calcAge(dob) {
  if (!dob) return null;
  try {
    const d = new Date(dob);
    const diff = Date.now() - d.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  } catch (_) {
    return null;
  }
}

// GET /api/nurse/medical-records/:appointmentId
// If record not exist, create a Draft prefilled with patient info so FE can display
exports.getOrCreateMedicalRecord = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const nurseUserId = req.user?.userId;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'Thiếu appointmentId' });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorUserId', 'fullName')
      .populate('patientUserId', 'fullName dob address')
      .populate('customerId', 'fullName address dob');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    let record = await MedicalRecord.findOne({ appointmentId });

    // Prefill basic info from user/customer if creating first time
    if (!record) {
      const patient = appointment.patientUserId || appointment.customerId || null;
      const patientAge = calcAge(patient?.dob);
      const address = patient?.address || '';

      record = await MedicalRecord.create({
        appointmentId: appointment._id,
        doctorUserId: appointment.doctorUserId,
        patientUserId: appointment.patientUserId || null,
        customerId: appointment.customerId || null,
        nurseId: nurseUserId,
        patientAge,
        address,
        status: 'Draft'
      });
    }

    const patient = appointment.patientUserId || appointment.customerId || null;
    const patientName = patient?.fullName || 'N/A';
    const patientAge = record.patientAge ?? calcAge(patient?.dob);
    const address = record.address || patient?.address || '';

    return res.status(200).json({
      success: true,
      data: {
        record,
        display: {
          patientName,
          patientAge,
          address,
          doctorName: appointment.doctorUserId?.fullName || 'N/A'
        }
      }
    });
  } catch (error) {
    console.error('❌ getOrCreateMedicalRecord error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

// PATCH /api/nurse/medical-records/:appointmentId/nurse-note
exports.updateNurseNote = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { nurseNote } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'Thiếu appointmentId' });
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { appointmentId },
      { $set: { nurseNote } },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, message: 'Đã lưu ghi chú điều dưỡng', data: record });
  } catch (error) {
    console.error('❌ updateNurseNote error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};


