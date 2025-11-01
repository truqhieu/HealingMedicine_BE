const MedicalRecord = require('../models/medicalRecord.model');
const Appointment = require('../models/appointment.model');
const Service = require('../models/service.model');

class MedicalRecordService {

  /**
   * Calculate age from date of birth
   */
  _calcAge(dob) {
    if (!dob) return null;
    try {
      const birth = new Date(dob);
      const today = new Date();
      // Tính theo UTC để tránh lệch múi giờ
      let age = today.getUTCFullYear() - birth.getUTCFullYear();
      const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
        age--;
      }
      return age < 0 ? 0 : age;
    } catch (_) {
      return null;
    }
  }

  /**
   * Get or create medical record for appointment
   */
  async getOrCreateMedicalRecord(appointmentId, nurseUserId) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorUserId', 'fullName')
      .populate('patientUserId', 'fullName dob address email phoneNumber gender')
      .populate('customerId', 'fullName address dob email phoneNumber gender');

    if (!appointment) {
      throw new Error('Không tìm thấy lịch hẹn');
    }

    let record = await MedicalRecord.findOne({ appointmentId })
      .populate({ path: 'additionalServiceIds', select: 'serviceName price' });

    // Prefill basic info from user/customer if creating first time
    if (!record) {
      const patient = appointment.patientUserId || appointment.customerId || null;
      const patientAge = this._calcAge(patient?.dob);
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
      // Re-fetch with populate to include services info
      record = await MedicalRecord.findById(record._id)
        .populate({ path: 'additionalServiceIds', select: 'serviceName price' });
    }

    const patient = appointment.patientUserId || appointment.customerId || null;
    const patientName = patient?.fullName || 'N/A';
    const patientAge = record.patientAge ?? this._calcAge(patient?.dob);
    const address = record.address || patient?.address || '';
    const patientDob = patient?.dob || null;
    const email = patient?.email || '';
    const phoneNumber = patient?.phoneNumber || '';
    const gender = patient?.gender || '';

    return {
      record,
      display: {
        patientName,
        patientAge,
        patientDob,
        address,
        doctorName: appointment.doctorUserId?.fullName || 'N/A',
        additionalServices: Array.isArray(record?.additionalServiceIds)
          ? record.additionalServiceIds.map((s) => ({
            _id: s._id,
            serviceName: s.serviceName,
            price: s.price,
          }))
          : [],
        email,
        phoneNumber,
        gender
      }
    };
  }

  /**
   * Update nurse note
   */
  async updateNurseNote(appointmentId, nurseNote) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { appointmentId },
      { $set: { nurseNote } },
      { new: true, upsert: true }
    );

    return record;
  }

  /**
   * Get active services for doctor
   */
  async getActiveServicesForDoctor() {
    const services = await Service.find({ status: 'Active' })
      .select('_id serviceName price category isPrepaid durationMinutes')
      .sort({ serviceName: 1 });

    return services;
  }

  /**
   * Update additional services for doctor
   */
  async updateAdditionalServicesForDoctor(appointmentId, serviceIds) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }
    if (!Array.isArray(serviceIds)) {
      throw new Error('serviceIds phải là mảng');
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { appointmentId },
      { $set: { additionalServiceIds: serviceIds } },
      { new: true, upsert: true }
    ).populate({ path: 'additionalServiceIds', select: 'serviceName price' });

    return record;
  }

  /**
   * Update medical record for doctor (diagnosis, conclusion, prescription, nurseNote)
   */
  async updateMedicalRecordForDoctor(appointmentId, updateData) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }

    const { diagnosis, conclusion, prescription, nurseNote } = updateData;

    const updateFields = {};
    if (diagnosis !== undefined) updateFields.diagnosis = diagnosis;
    if (conclusion !== undefined) updateFields.conclusion = conclusion;
    if (prescription !== undefined) updateFields.prescription = prescription;
    if (nurseNote !== undefined) updateFields.nurseNote = nurseNote;

    if (Object.keys(updateFields).length === 0) {
      throw new Error('Không có trường nào để cập nhật');
    }

    // Cập nhật status thành InProgress nếu đang là Draft
    const existingRecord = await MedicalRecord.findOne({ appointmentId });
    if (existingRecord && existingRecord.status === 'Draft') {
      updateFields.status = 'InProgress';
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { appointmentId },
      { $set: updateFields },
      { new: true, upsert: true }
    ).populate({ path: 'additionalServiceIds', select: 'serviceName price' });

    return record;
  }
}

module.exports = new MedicalRecordService();

