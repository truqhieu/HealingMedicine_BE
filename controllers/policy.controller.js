const Policy = require('../models/policy.model');


const getActivePolicies = async (req, res) => {
  try {
    const policies = await Policy.getActivePolicies();
    
    res.status(200).json({
      success: true,
      message: `Tìm thấy ${policies.length} chính sách`,
      data: policies
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách chính sách:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const getAllPolicies = async (req, res) => {
  try {
    const policies = await Policy.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      message: `Tìm thấy ${policies.length} chính sách`,
      data: policies
    });
  } catch (error) {
    console.error('Lỗi lấy tất cả chính sách:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const createPolicy = async (req, res) => {
  try {
    const { title, description, active = true, status = 'Active' } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tiêu đề và mô tả'
      });
    }

    const policy = new Policy({
      title,
      description,
      active,
      status
    });

    await policy.save();

    res.status(201).json({
      success: true,
      message: 'Tạo chính sách thành công',
      data: policy
    });
  } catch (error) {
    console.error('Lỗi tạo chính sách:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, active, status } = req.body;

    const policy = await Policy.findById(id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chính sách'
      });
    }

    if (title) policy.title = title;
    if (description) policy.description = description;
    if (typeof active === 'boolean') policy.active = active;
    if (status) policy.status = status;

    await policy.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật chính sách thành công',
      data: policy
    });
  } catch (error) {
    console.error('Lỗi cập nhật chính sách:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await Policy.findByIdAndDelete(id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chính sách'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa chính sách thành công'
    });
  } catch (error) {
    console.error('Lỗi xóa chính sách:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getActivePolicies,
  getAllPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy
};
