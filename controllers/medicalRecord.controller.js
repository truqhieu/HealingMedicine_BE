const medicalRecordService = require('../services/medicalRecord.service');

exports.getOrCreateMedicalRecord = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const nurseUserId = req.user?.userId;

    const result = await medicalRecordService.getOrCreateMedicalRecord(appointmentId, nurseUserId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ getOrCreateMedicalRecord error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ',
      error: error.message
    });
  }
};

exports.updateNurseNote = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { nurseNote } = req.body;

    const record = await medicalRecordService.updateNurseNote(appointmentId, nurseNote);

    return res.status(200).json({
      success: true,
      message: 'Đã lưu ghi chú điều dưỡng',
      data: record
    });
  } catch (error) {
    console.error('❌ updateNurseNote error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ',
      error: error.message
    });
  }
};

exports.getActiveServicesForDoctor = async (_req, res) => {
  try {
    const services = await medicalRecordService.getActiveServicesForDoctor();

    return res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('❌ getActiveServicesForDoctor error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ',
      error: error.message
    });
  }
};

exports.updateAdditionalServicesForDoctor = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { serviceIds } = req.body || {};

    const record = await medicalRecordService.updateAdditionalServicesForDoctor(appointmentId, serviceIds);

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật dịch vụ bổ sung',
      data: record
    });
  } catch (error) {
    console.error('❌ updateAdditionalServicesForDoctor error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ',
      error: error.message
    });
  }
};
