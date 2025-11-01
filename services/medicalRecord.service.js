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
      .populate('customerId', 'fullName address dob email phoneNumber gender')
      .populate('serviceId', 'serviceName price'); // Populate dịch vụ chính

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

      // Tự động thêm dịch vụ chính của appointment vào additionalServiceIds nếu có
      const initialServiceIds = [];
      if (appointment.serviceId && appointment.serviceId._id) {
        initialServiceIds.push(appointment.serviceId._id);
      }

      record = await MedicalRecord.create({
        appointmentId: appointment._id,
        doctorUserId: appointment.doctorUserId,
        patientUserId: appointment.patientUserId || null,
        customerId: appointment.customerId || null,
        nurseId: nurseUserId,
        patientAge,
        address,
        additionalServiceIds: initialServiceIds, // Thêm dịch vụ chính
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

    // Prepare additional services - filter out null/undefined and ensure we have valid data
    let additionalServices = [];
    let recordServiceIds = [];
    
    if (record?.additionalServiceIds && Array.isArray(record.additionalServiceIds)) {
      // Get actual service IDs (handle both populated and non-populated cases)
      recordServiceIds = record.additionalServiceIds
        .filter(s => s)
        .map(s => s._id ? s._id.toString() : s.toString());
      
      additionalServices = record.additionalServiceIds
        .filter(s => s && s._id) // Filter out null/undefined/invalid entries
        .map((s) => ({
          _id: s._id.toString(),
          serviceName: s.serviceName || '',
          price: s.price || 0,
        }));
    }
    
    // Nếu có dịch vụ chính của appointment nhưng chưa có trong additionalServiceIds, tự động thêm vào
    if (appointment.serviceId && appointment.serviceId._id) {
      const mainServiceId = appointment.serviceId._id.toString();
      const hasMainService = recordServiceIds.includes(mainServiceId);
      
      if (!hasMainService) {
        // Tự động thêm dịch vụ chính vào additionalServiceIds trong database
        const updatedServiceIds = [...recordServiceIds, appointment.serviceId._id];
        record.additionalServiceIds = updatedServiceIds;
        await record.save();
        
        // Re-populate để có đầy đủ thông tin
        record = await MedicalRecord.findById(record._id)
          .populate({ path: 'additionalServiceIds', select: 'serviceName price' });
        
        // Rebuild additionalServices từ record đã được populate lại
        if (record?.additionalServiceIds && Array.isArray(record.additionalServiceIds)) {
          additionalServices = record.additionalServiceIds
            .filter(s => s && s._id)
            .map((s) => ({
              _id: s._id.toString(),
              serviceName: s.serviceName || '',
              price: s.price || 0,
            }));
        }
        
        console.log('🔍 [getOrCreateMedicalRecord] Auto-added main appointment service to additionalServiceIds');
      }
    }
    
    console.log('🔍 [getOrCreateMedicalRecord] Appointment serviceId:', appointment.serviceId);
    console.log('🔍 [getOrCreateMedicalRecord] Record additionalServiceIds:', record?.additionalServiceIds);
    console.log('🔍 [getOrCreateMedicalRecord] Mapped additionalServices:', additionalServices);

    return {
      record,
      display: {
        patientName,
        patientAge,
        patientDob,
        address,
        doctorName: appointment.doctorUserId?.fullName || 'N/A',
        additionalServices,
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

