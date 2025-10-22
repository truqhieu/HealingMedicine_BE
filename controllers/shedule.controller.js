const DoctorSchedule = require("../models/doctorSchedule.model")
const User = require('../models/user.model')
const Room = require('../models/clinic.model')

const checkAvailableDoctors = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const scheduleToday = await DoctorSchedule.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).select("doctorUserId shift");

    const doctorShift = {};
    scheduleToday.forEach((s) => {
      const id = s.doctorUserId.toString();
      if (!doctorShift[id]) doctorShift[id] = [];
      doctorShift[id].push(s.shift);
    });

    const doctors = await User.find({ role: "Doctor" }).select("_id fullName email");

    const availableDoctors = doctors.filter((d) => {
      const shifts = doctorShift[d._id.toString()] || [];
      return shifts.length < 2; 
    });

    res.status(200).json({
      status: true,
      message: "Danh sách bác sĩ còn trống lịch hôm nay",
      data: availableDoctors,
    });
  } catch (error) {
    console.log("Lỗi lấy danh sách bác sĩ trống ca làm.", error);
    res.status(500).json({ status: false, message: "Lỗi server" });
  }
}

const createScheduleDoctor = async(req,res) =>{
  try {
    const {doctorId, date, shift, startTime, endTime, roomId, maxSlots} = req.body
    const checkDoctor = await User.findById(doctorId)
    if(!checkDoctor){
      return res.status(400).json({
        status : false,
        message : 'Bác sĩ không tồn tại'
      })
    }

    // ⭐ Kiểm tra roomId nếu được cung cấp
    let validRoomId = roomId;
    if(roomId) {
      const checkRoom = await Room.findById(roomId);
      if(!checkRoom) {
        return res.status(400).json({
          status: false,
          message: 'Phòng không tồn tại'
        })
      }
      validRoomId = checkRoom._id;
    }

    const newSchedule = new DoctorSchedule({
      doctorUserId : doctorId,
      date,
      shift,
      startTime,
      endTime,
      roomId: validRoomId || null,
      maxSlots,
    })

    await newSchedule.save();

    res.status(201).json({
      status : true,
      message : "Tạo lịch làm việc thành công",
      data : newSchedule
    })
  } catch (error) {
    console.log('Lỗi khi tạo lịch làm việc cho bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}


const SHIFT = DoctorSchedule.schema.path('shift').enumValues;
const STATUS = DoctorSchedule.schema.path('status').enumValues;
const getAllScheduleDoctors = async(req,res) =>{
  try {
    const {
      page = 1,
      limit = 10,
      shift,
      status,
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;    

    const filter = {};
    if(shift && SHIFT.includes(shift)) filter.shift = shift;
    if(status && STATUS.includes(status)) filter.status = status;   
    
    
    const [total, schedules] = await Promise.all([
      DoctorSchedule.countDocuments(filter),
      DoctorSchedule.find(filter)
      .populate({
        path :'doctorUserId',
        select : 'fullName'
      })
      .populate({
        path: 'roomId',
        select: 'roomName'
      })
      .skip(skip)
      .limit(limitNum)
      .lean()
    ])

    const totalPages = Math.max(1, Math.ceil(total/ limitNum));

    return res.status(200).json({
      status : true,
      total,
      totalPages,
      page  : pageNum,
      limit : limitNum,
      data : schedules
    })
  } catch (error) {
    console.log('Lỗi khi lấy danh sách lịch làm việc cho bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}

const viewDetailScheduleDoctor = async(req,res)=>{
  try {
    const findScheduleDetail = await DoctorSchedule.findById(req.params.id);
    if(!findScheduleDetail){
      return res.status(400).json({
        status : false,
        message : 'Lịch làm việc không tồn tại'
      })
    }
    res.status(200).json({
      status : true,
      message : 'Chi tiết lịch làm việc',
      data : findScheduleDetail
    })
  } catch (error) {
    console.log('Lỗi khi xe lịch làm việc chi tiết của bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}

const updateScheduleDoctor = async(req,res) =>{
  try {
    const updateFields = [
    'shift',
    'startTime',
    'endTime',
    'status',
    'roomId'
  ]

  const updates = {};
  Object.keys(req.body).forEach(key =>{
    if(updateFields.includes(key)){
      updates[key] = req.body[key]
    }
  });
  if(Object.keys(updates).length === 0){
    return res.status(400).json({
      status : false,
      message : 'Không có trường hợp lệ để cập nhật'
    });   
  }

  const schedule = await DoctorSchedule.findByIdAndUpdate(
    req.params.id,
    {$set : updates},
    {new : true, runValidators : true}
  )

  if(!schedule){
    return res.status(400).json({
      status : false,
      message : 'Không tìm thấy lịch làm việc.'
    })
  }
  res.status(200).json({
    status : true,
    message : 'Cập nhật lịch làm việc thành công',
    data : schedule
  })
  } catch (error) {
    
  }
}

const deleteSchedule = async(req,res) =>{
  try {
    const deleteS = await DoctorSchedule.findByIdAndDelete(req.params.id)
    res.status(200).json({
      status : true,
      message : "Xóa lịch thành công"
    })
  } catch (error) {
    console.log('Lỗi khi xóa lịch làm việc cho bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}

module.exports = {checkAvailableDoctors,createScheduleDoctor, getAllScheduleDoctors,viewDetailScheduleDoctor, updateScheduleDoctor,deleteSchedule}