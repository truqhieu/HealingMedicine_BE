const User = require('../models/user.model')
const LeaveRequest = require('../models/leaveRequest.model');

const createLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin',
      });
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Ngày bắt đầu không hợp lệ',
      });
    }

    if (start < now) {
      return res.status(400).json({
        success: false,
        message: 'Ngày bắt đầu phải tính từ hiện tại',
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Ngày kết thúc phải lớn hơn ngày bắt đầu',
      });
    }

    const cleanReason = reason.trim();
    if(cleanReason.length === 0){
      return res.status(400).json({
        success : false,
        message : "Lý do nghỉ không thể để trống"
      })
    }
    if (cleanReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Độ dài lý do nghỉ phép không hợp lệ (tối thiểu 3 ký tự)',
      });
    }
    if (!/^[a-zA-ZÀ-ỹ0-9\s.,!?;:'"()_-]+$/.test(cleanReason)) {
      return res.status(400).json({
        success: false,
        message: 'Lí do nghỉ không hợp lệ. Vui lòng chỉ nhập chữ, số và các ký tự . , ! ? ; : ( ) _ -',
      });
    }

    // ✅ Kiểm tra đơn nghỉ đã được duyệt có trùng thời gian không
    const existingApprovedLeave = await LeaveRequest.findOne({
      userId: req.user.userId,
      status: 'Approved',
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } } // có phần giao thời gian
      ]
    });

    if (existingApprovedLeave) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có đơn nghỉ được duyệt trong khoảng thời gian này',
      });
    }

    // ✅ Tạo đơn mới
    const newRequest = new LeaveRequest({
      userId: req.user.userId,
      startDate,
      endDate,
      reason,
    });

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu nghỉ thành công',
      data: newRequest,
    });
  } catch (error) {
    console.error('Lỗi khi gửi yêu cầu xin nghỉ', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi gửi yêu cầu xin nghỉ',
    });
  }
};

const STATUS = LeaveRequest.schema.path('status').enumValues;
const getAllLeaveRequest = async(req,res) =>{
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
        const skip = (pageNum - 1 ) * limitNum;

        const filter = {};
        if(req.user && ['Doctor','Nurse','Staff'].includes(req.user.role)) filter.userId = req.user.userId
        if(status && STATUS.includes(status)) filter.status = status

        if(search && String(search).trim().length > 0){
            const searchKey = String(search).trim();
            const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regax = new RegExp(safe, 'i');
            filter.$or = [
                {reason : {$regex : regax}}
            ]
        }

      if (startDate || endDate) {
        if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startDate = { ...(filter.startDate || {}), $gte: start };
      }
        if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startDate = { ...(filter.startDate || {}), $lte: end };
      }
    }

        const sortOrder = sort === 'asc' ? 1 : -1;

        const [total, leaveRequests] = await Promise.all([
            LeaveRequest.countDocuments(filter),
            LeaveRequest.find(filter)
            .populate({
              path : 'userId',
              select : 'fullName role'
            })
            .populate({
              path : 'approvedByManager',
              select : 'fullName'
            })
            .select('-__v')
            .sort({startDate : sortOrder})
            .skip(skip)
            .limit(limitNum)
            .lean()

        ])

        const totalPages = Math.max(1, Math.ceil(total/ limitNum));

        return res.status(200).json({
            success : true,
            total,
            totalPages,
            page : pageNum,
            limit : limitNum,
            data : leaveRequests
        })
    } catch (error) {
        console.log('Lỗi khi xem danh sách yêu cầu xin nghỉ', error)
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi xem danh sách yêu càu xin nghỉ'
        })
    }        
}

const handleLeaveRequest = async(req,res) =>{
    try {
        const {status} = req.body
        const handleRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            {
                approvedByManager : req.user.userId,
                status,
            },
            {new : true, runValidators : true}
        )
        const map = {
            Approved : 'duyệt',
            Rejected : 'từ chối'
        }
        res.status(200).json({
            success : true,
            message : `Đã ${map[status]} đơn nghỉ phép`,
            data : handleRequest
        })
    } catch (error) {
        console.log('Lỗi khi xử lý yêu cầu xin nghỉ', error)
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi xử lý yêu càu xin nghỉ'
        })       
    }
}

module.exports = {createLeaveRequest, getAllLeaveRequest, handleLeaveRequest}