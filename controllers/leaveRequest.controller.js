const User = require('../models/user.model')
const LeaveRequest = require('../models/leaveRequest.model');

const createLeaveRequest = async(req,res) =>{
    try {
        const {startDate, endDate, reason} = req.body;
        
        if(!startDate || !endDate || !reason){
            return res.status(400).json({
                success : false,
                message : 'Vui lòng nhập đầy đủ thông tin'
            });
        }

        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if(isNaN(start.getTime())){
            return res.status(400).json({
                success : false,
                message : 'Ngày bắt đầu không hợp lệ.'
            });
        }
        if(start < now) {
            return res.status(400).json({
                success : false,
                message : 'Ngày bắt đầu phải tính từ hiện tại.'
            });           
        }
        if(end <= start){
            return res.status(400).json({
                success : false,
                message : 'Ngày kết thúc phải lớn hơn ngày bắt đầu.'
            });  
        }

        if (reason) {
            if (typeof reason !== 'string' || reason.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Lí do nghỉ không được để trống'
              });
            }
            
            const cleanReason = reason.trim();
            
            if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(cleanReason)) {
              return res.status(400).json({
                success: false,
                message: 'Lí do nghỉ không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 3 ký tự)
            if (cleanReason.length < 3) {
              return res.status(400).json({
                success: false,
                message: 'Lí do nghỉ phải có ít nhất 2 ký tự'
              });
            }
        }
        const newRequest = new LeaveRequest({
            userId : req.user.userId,
            startDate,
            endDate,
            reason
        })

        await newRequest.save();

        res.status(201).json({
            success : true,
            message : 'Gửi khiếu nại thành công',
            data : newRequest
        })
    } catch (error) {
        console.log('Lỗi khi tạo yêu cầu xin nghỉ', error)
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi gửi yêu cầu xin nghỉ'
        })
    }
}
const STATUS = LeaveRequest.schema.path('status').enumValues;
const getAllLeaveRequest = async(req,res) =>{
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
        } = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1 ) * limitNum;

        const filter = {};
        if(status && STATUS.includes(status)) filter.status = status

        if(search && String(search).trim().length > 0){
            const searchKey = String(search).strim();
            const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regax = new RegExp(safe, 'i');
            filter.$or = [
                {reason : {$regax : regax}}
            ]
        }

        const [total, leaveRequests] = await Promise.all([
            LeaveRequest.countDocuments(filter),
            LeaveRequest.find(filter)
            .skip(skip)
            .limit(limitNum)
            .lean()

        ])

        const totalPages = Math.max(1, Math.ceil(total/ limitNum));

        return res.status(200).json({
            status : true,
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
            status : true,
            message : `Đã ${map[status]} đơn nghỉ phép`,
            data : handleRequest
        })
    } catch (error) {
        console.log('Lỗi khi xử lý yêu cầu xin nghỉ', error)
        return res.status(500).json({
            status : false,
            message : 'Đã xảy ra lỗi khi xử lý yêu càu xin nghỉ'
        })       
    }
}

module.exports = {createLeaveRequest, getAllLeaveRequest, handleLeaveRequest}