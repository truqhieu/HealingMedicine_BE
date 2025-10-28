const User = require('../models/user.model')
const Complaint = require('../models/complaint.model')

const createComplaint = async(req,res) =>{
    try {
        const {title, description, appointmentId} = req.body
        if (title) {
            if (typeof title !== 'string' || title.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Tiêu đề phản ánh không được để trống'
              });
            }
            
            const cleanTitle = title.trim();
            
            if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanTitle)) {
              return res.status(400).json({
                success: false,
                message: 'Tiêu đề phản ánh không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanTitle.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Phản hồi phải có ít nhất 2 ký tự'
              });
            }
        }
        if (description) {
            if (typeof description !== 'string' || description.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả phản ánh không được để trống'
              });
            }
            
            const cleanDescription = description.trim();
            
            if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanDescription)) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả phản ánh không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanDescription.length < 5) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả phải có ít nhất 5 ký tự'
              });
            }
        }

        const newComplaint = new Complaint({
            patientUserId : req.user.userId,
            appointmentId : req.params.id,
            title,
            description,
            appointmentId
        })
        await newComplaint.save();
        res.status(200).json({
            status : true,
            message : 'Gửi khiếu nại thành công',
            data : newComplaint
        })
    } catch (error) {
        console.log('Lỗi khi gửi phản ánh', error);
        return res.status(500).json({status : false, message: 'Đã xảy ra lỗi khi gửi phản ánh'})
    }
}


const STATUS = Complaint.schema.path('status').enumValues;

const getAllComplaints = async(req,res) =>{
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if(status && STATUS.includes(status)) filter.status = status;

    if(search && String(search).trim().length > 0){
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regax = new RegExp(safe, 'i');
      filter.$or = [
        {title : {$regax : regax}},
        {description : {$regax : regax}},
      ]   
    } 

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
      .populate({
        path : 'appointmentId',
        select : 'checkInAt'
      })
      .populate({
        path : 'resolvedByManagerId',
        select : 'fullName'
      })
      .skip(skip)
      .limit(limitNum)
      .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(total/limitNum));
    return res.status(200).json({
      status : true,
      total,
      totalPages,
      page : pageNum,
      limit : limitNum,
      data : complaints
    })
  } catch (error) {
      console.log('Lỗi khi gửi phản ánh', error);
      return res.status(500).json({status : false, message: 'Đã xảy ra lỗi khi gửi phản ánh'})
  }
}

const viewDetailComplaint = async(req,res) =>{
  try {
    const detailComplaint = await Complaint.findById(req.params.id)
    .populate('appointmentId', 'doctorId')
    .populate('managerResponses.managerId', 'fullName')
    .populate('patientUserId', 'fullName phone')
    
    if(!deleteComplaint){
      return res.status(404).json({
        status : false,
        message : 'Không tìm thấy đơn khiếu nại'
      })
    }

    return res.status(200).json({
      status : true,
      message : 'Chi tiết đơn khiếu nại',
      data : deleteComplaint
    })
  } catch (error) {
        console.log('Lỗi khi xử lý đơn khiếu nại', error);
        return res.status(500).json({status : false, message: 'Đã xảy ra lỗi khi xử lý đơn khiếu nại'})    
  }
}

const handleComplaint = async(req,res) =>{
  try {
    const {status, responseText} = req.body;
    const findComplaint = await Complaint.findById(req.params.id);
    if(!findComplaint){
      return res.status(404).json({
        status : false,
        message : 'Không tìm thấy đơn khiếu nại'
      });
    }
    if(findComplaint.status !== 'Pending'){
      return res.status(400).json({
        status : false, 
        message : 'Đơn khiếu nại đã được xử lý, không thể cập nhật'
      })
    }
    findComplaint.status = status
    findComplaint.managerResponses.push({
      managerUserId : req.user.userId,
      responseText ,
      respondedAt : new Date()
    })
    findComplaint.resolvedByManagerId = req.user.userId
    findComplaint.resolutionDate = new Date()

    await findComplaint.save();

    const map = {
      Approved : 'duyệt',
      Rejected : 'từ chối'
    }
    
    res.status(201).json({
      status : true,
      message : `Đã ${map[status]} đơn khiếu nại`
    })
  } catch (error) {
        console.log('Lỗi khi xử lý đơn khiếu nại', error);
        return res.status(500).json({status : false, message: 'Đã xảy ra lỗi khi xử lý đơn khiếu nại'})
  }
}

const deleteComplaint = async(req,res) =>{
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if(!complaint){
      return res.status(404).json({
        status : false,
        message : 'Không tìm thấy đơn khiếu nại'
      })
    }
    res.status(201).json({
      status : true,
      message : 'Xóa đơn khiếu nại thành công'
    })
  } catch (error) {
        console.log('Lỗi khi xóa đơn khiếu nại', error);
        return res.status(500).json({status : false, message: 'Đã xảy ra lỗi khi xóa đơn khiếu nại'})    
  }
}

module.exports = {createComplaint, getAllComplaints, viewDetailComplaint, handleComplaint, deleteComplaint}