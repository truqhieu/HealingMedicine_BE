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
    // ⭐ LƯU Ý: Không tự động thêm dịch vụ chính vào đây nữa vì bác sĩ có quyền xóa nó
    // Dịch vụ chính chỉ được thêm khi tạo record mới (đã xử lý ở trên)
    let additionalServices = [];
    
    if (record?.additionalServiceIds && Array.isArray(record.additionalServiceIds)) {
      additionalServices = record.additionalServiceIds
        .filter(s => s && s._id) // Filter out null/undefined/invalid entries
        .map((s) => ({
          _id: s._id.toString(),
          serviceName: s.serviceName || '',
          price: s.price || 0,
        }));
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
   * @param {string} appointmentId 
   * @param {object} updateData - { diagnosis, conclusion, prescription, nurseNote, approve }
   */
  async updateMedicalRecordForDoctor(appointmentId, updateData) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }

    const { diagnosis, conclusion, prescription, nurseNote, approve } = updateData;

    const updateFields = {};
    if (diagnosis !== undefined) updateFields.diagnosis = diagnosis;
    if (conclusion !== undefined) updateFields.conclusion = conclusion;
    if (prescription !== undefined) updateFields.prescription = prescription;
    if (nurseNote !== undefined) updateFields.nurseNote = nurseNote;

    // Nếu approve = true, set doctorApproved = true và doctorApprovedAt = now
    if (approve === true) {
      updateFields.doctorApproved = true;
      updateFields.doctorApprovedAt = new Date();
    }

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

  /**
   * Approve medical record by doctor
   */
  async approveMedicalRecordByDoctor(appointmentId) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }

    const record = await MedicalRecord.findOneAndUpdate(
      { appointmentId },
      { 
        $set: { 
          doctorApproved: true,
          doctorApprovedAt: new Date()
        }
      },
      { new: true }
    ).populate({ path: 'additionalServiceIds', select: 'serviceName price' });

    if (!record) {
      throw new Error('Không tìm thấy hồ sơ khám bệnh');
    }

    return record;
  }

  /**
   * Get medical record for patient (read-only)
   * Patient chỉ có thể xem medical record của chính mình
   */
  async getMedicalRecordForPatient(appointmentId, patientUserId) {
    if (!appointmentId) {
      throw new Error('Thiếu appointmentId');
    }
    if (!patientUserId) {
      throw new Error('Thiếu patientUserId');
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorUserId', 'fullName')
      .populate('patientUserId', 'fullName dob address email phoneNumber gender')
      .populate('customerId', 'fullName address dob email phoneNumber gender')
      .populate('serviceId', 'serviceName price');

    if (!appointment) {
      throw new Error('Không tìm thấy lịch hẹn');
    }

    // Kiểm tra quyền: Patient chỉ có thể xem medical record của chính mình
    const isPatientOwner = appointment.patientUserId?._id?.toString() === patientUserId.toString();
    const isCustomerOwner = appointment.customerId?._id?.toString() === patientUserId.toString();
    
    if (!isPatientOwner && !isCustomerOwner) {
      throw new Error('Bạn không có quyền xem hồ sơ khám bệnh này');
    }

    // Chỉ lấy record nếu đã tồn tại (không tạo mới)
    const record = await MedicalRecord.findOne({ appointmentId })
      .populate({ path: 'additionalServiceIds', select: 'serviceName price' });

    if (!record) {
      throw new Error('Hồ sơ khám bệnh chưa được tạo');
    }

    // Kiểm tra appointment đã Completed và record đã được doctor duyệt
    if (appointment.status !== 'Completed') {
      throw new Error('Hồ sơ khám bệnh chỉ có thể xem sau khi ca khám đã hoàn thành');
    }

    if (!record.doctorApproved) {
      throw new Error('Hồ sơ khám bệnh chưa được bác sĩ duyệt');
    }

    const patient = appointment.patientUserId || appointment.customerId || null;
    const patientName = patient?.fullName || 'N/A';
    const patientAge = record.patientAge ?? this._calcAge(patient?.dob);
    const address = record.address || patient?.address || '';
    const patientDob = patient?.dob || null;
    const email = patient?.email || '';
    const phoneNumber = patient?.phoneNumber || '';
    const gender = patient?.gender || '';

    // Prepare additional services
    let additionalServices = [];
    if (record?.additionalServiceIds && Array.isArray(record.additionalServiceIds)) {
      additionalServices = record.additionalServiceIds
        .filter(s => s && s._id)
        .map((s) => ({
          _id: s._id.toString(),
          serviceName: s.serviceName || '',
          price: s.price || 0,
        }));
    }

    return {
      record: {
        _id: record._id,
        appointmentId: record.appointmentId,
        doctorUserId: record.doctorUserId,
        patientUserId: record.patientUserId,
        customerId: record.customerId,
        nurseId: record.nurseId,
        diagnosis: record.diagnosis || '',
        conclusion: record.conclusion || '',
        prescription: record.prescription || {},
        nurseNote: record.nurseNote || '',
        additionalServiceIds: record.additionalServiceIds || [],
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
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
   * Get all medical records for a patient
   * Trả về danh sách các hồ sơ khám bệnh đã hoàn thành của patient
   */
  async getPatientMedicalRecordsList(patientUserId) {
    if (!patientUserId) {
      throw new Error('Thiếu patientUserId');
    }

    // Tìm tất cả medical records của patient
    const records = await MedicalRecord.find({
      $or: [
        { patientUserId: patientUserId },
        { customerId: patientUserId }
      ]
    })
      .populate({
        path: 'appointmentId',
        select: 'status timeslotId serviceId doctorUserId',
        populate: [
          {
            path: 'timeslotId',
            select: 'startTime endTime'
          },
          {
            path: 'serviceId',
            select: 'serviceName price'
          },
          {
            path: 'doctorUserId',
            select: 'fullName'
          }
        ]
      })
      .populate('doctorUserId', 'fullName')
      .populate({ path: 'additionalServiceIds', select: 'serviceName price' })
      .sort({ createdAt: -1 }) // Mới nhất trước
      .lean();

    // Lọc chỉ lấy các records từ appointments đã hoàn thành VÀ đã được doctor duyệt
    const completedRecords = records.filter(record => {
      if (!record.appointmentId) return false;
      return record.appointmentId.status === 'Completed' && record.doctorApproved === true;
    });

    // Format dữ liệu để trả về
    const formattedRecords = completedRecords.map(record => {
      const appointment = record.appointmentId;
      const service = appointment?.serviceId;
      const timeslot = appointment?.timeslotId;
      const doctor = appointment?.doctorUserId || record.doctorUserId;

      return {
        _id: record._id,
        appointmentId: record.appointmentId?._id ? record.appointmentId._id.toString() : null,
        doctorName: doctor?.fullName || 'N/A',
        serviceName: service?.serviceName || 'N/A',
        date: timeslot?.startTime || record.createdAt,
        hasDiagnosis: !!record.diagnosis,
        hasPrescription: !!(record.prescription && (record.prescription.medicine || record.prescription.dosage || record.prescription.duration)),
        prescription: record.prescription || null,
        diagnosis: record.diagnosis || null,
        conclusion: record.conclusion || null,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    return formattedRecords;
  }
}

module.exports = new MedicalRecordService();

