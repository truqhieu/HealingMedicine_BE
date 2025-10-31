const User = require('../models/user.model')
const Complaint = require('../models/complaint.model')
const Appointment = require('../models/appointment.model')

const createComplaint = async (req, res) => {
  try {
    const { title, description , appointmentId} = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề phản ánh không được để trống',
      });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả phản ánh không được để trống',
      });
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!/^[a-zA-ZÀ-ỹ0-9\s\-\_\:\.()'"]{2,}$/.test(cleanTitle)) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề phản ánh không hợp lệ (ít nhất 2 ký tự, không chứa ký tự lạ).',
      });
    }
    if (!/^[a-zA-ZÀ-ỹ0-9\s\-\_\:\.\,\/\!\?\;\'\"\(\)\n\r]+$/.test(cleanDescription) || cleanDescription.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả phản ánh không hợp lệ (ít nhất 5 ký tự).',
      });
    }

    const checkAppointment = await Appointment.findById(appointmentId);
    if (!checkAppointment) {
      return res.status(404).json({
        success: false,
        message: 'Lịch khám không tồn tại',
      });
    }

    if (String(checkAppointment.patientUserId) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi phản ánh cho lịch khám này',
      });
    }

    const newComplaint = new Complaint({
      patientUserId: req.user.userId,
      appointmentId: appointmentId,
      title: cleanTitle,
      description: cleanDescription,
    });

    await newComplaint.save();

    return res.status(201).json({
      success: true,
      message: 'Gửi phản ánh thành công',
      data: newComplaint,
    });
  } catch (error) {
    console.error('Lỗi khi gửi phản ánh', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi gửi phản ánh',
    });
  }
};



const STATUS = Complaint.schema.path('status').enumValues;

const getAllComplaints = async(req,res) =>{
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      startDate,
      endDate,
      sort = 'desc',
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if(req.user && req.user.role === 'Patient') filter.patientUserId = req.user.userId
    if(status && STATUS.includes(status)) filter.status = status;

    if(search && String(search).trim().length > 0){
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regax = new RegExp(safe, 'i');
      filter.$or = [
        {title : {$regex : regax}},
        {description : {$regex : regax}},
      ]   
    }
    
    if(startDate || endDate){
      if(startDate){
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startDate = {...(filter.startDate || {}), $gte : start}
      }
      if(endDate){
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startDate = {...(filter.startDate || {}), $lte: end}
      }
    }

    const sortOrder = sort === 'asc' ? 1 : -1;

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
      .populate({
        path : 'patientUserId',
        select : 'fullName phone'
      })
      .populate({
        path : 'appointmentId',
        select : 'checkInAt'
      })
      .populate({
        path : 'resolvedByManagerId',
        select : 'fullName'
      })
      .select('-__v')
      .sort({startDate : sortOrder})
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
      return res.status(500).json({success : false, message: 'Đã xảy ra lỗi khi gửi phản ánh'})
  }
}

const viewDetailComplaint = async(req,res) =>{
  try {
    const detailComplaint = await Complaint.findById(req.params.id)
    .populate('appointmentId', 'doctorId')
    .populate('resolvedByManagerId', 'fullName')
    .populate('patientUserId', 'fullName phone')
    .select('-__v')
    
    if(!detailComplaint){
      return res.status(404).json({
        success : false,
        message : 'Không tìm thấy đơn khiếu nại'
      })
    }

    return res.status(200).json({
      success : true,
      message : 'Chi tiết đơn khiếu nại',
      data : detailComplaint,
    })
  } catch (error) {
        console.log('Lỗi khi xem chi tiết đơn khiếu nại', error);
        return res.status(500).json({success : false, message: 'Đã xảy ra lỗi xem chi tiết đơn khiếu nại'})    
  }
}

const handleComplaint = async(req,res) =>{
  try {
    const {status, responseText} = req.body;
    const findComplaint = await Complaint.findById(req.params.id);
    if(!findComplaint){
      return res.status(404).json({
        success : false,
        message : 'Không tìm thấy đơn khiếu nại'
      });
    }
    if(findComplaint.status !== 'Pending'){
      return res.status(400).json({
        success : false, 
        message : 'Đơn khiếu nại đã được xử lý, không thể cập nhật'
      })
    }
    findComplaint.status = status
        if (responseText) {
            if (typeof responseText !== 'string' || responseText.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Lý do xử lý đơn khiếu nại không được để trống'
              });
            }
            
            const cleanResponseText = responseText.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s.,!?;:'"()_-]+$/.test(cleanResponseText)) {
              return res.status(400).json({
                success: false,
                message: 'Phản hồi đối với đơn phản ảnh của khách hàng không hợp lệ'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 5 ký tự)
            if (cleanResponseText.length < 5) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài phản hồi không hợp lệ (tối thiểu 5 ký tự)'
              });
            }
        }
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
      success : true,
      message : `Đã ${map[status]} đơn khiếu nại`
    })
  } catch (error) {
        console.log('Lỗi khi xử lý đơn khiếu nại', error);
        return res.status(500).json({success : false, message: 'Đã xảy ra lỗi khi xử lý đơn khiếu nại'})
  }
}

const deleteComplaint = async(req,res) =>{
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if(!complaint){
      return res.status(404).json({
        success : false,
        message : 'Không tìm thấy đơn khiếu nại'
      })
    }
    res.status(200).json({
      success : true,
      message : 'Xóa đơn khiếu nại thành công'
    })
  } catch (error) {
        console.log('Lỗi khi xóa đơn khiếu nại', error);
        return res.status(500).json({success : false, message: 'Đã xảy ra lỗi khi xóa đơn khiếu nại'})    
  }
}

module.exports = {createComplaint, getAllComplaints,viewDetailComplaint, handleComplaint, deleteComplaint}