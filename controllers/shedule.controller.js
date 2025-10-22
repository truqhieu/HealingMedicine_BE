const SchedulesDoctor = require("../models/schedule.model")
const User = require('../models/user.model')
const Clinicroom = require('../models/clinic.model')

const checkAvailableDoctors = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const scheduleToday = await SchedulesDoctor.find({
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
};



const createScheduleDoctor = async(req,res) =>{
  try {
    const {doctorId, date, shift, startTime, endTime, roomId, maxSlots} = req.body
    const checkDoctorRoom = await Clinicroom.findOne({assignedDoctorId : doctorId})

    const checkDoctor = await User.findById(doctorId)
    if(!checkDoctor){
      return res.status(400).json({
        status : false,
        message : 'Bác sĩ không tồn tại'
      })
    }

    const checkRoomId = checkDoctorRoom ? checkDoctorRoom._id : roomId === null;

    const newSchedule = new SchedulesDoctor({
      doctorUserId : doctorId,
      date,
      shift,
      startTime,
      endTime,
      roomId : checkRoomId ,
      maxSlots,
    })

    // if(newSchedule){
    //   return res.status(400).json({
    //     status : false,
    //     messge : 'Lịch làm việc đã tồn tại'
    //   })
    // }

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


const getAllScheduleDoctor = async(req,res) =>{
  try {
    const listScheduleDoctor = await SchedulesDoctor.find();
    res.status(200).json({
      status : true,
      message : 'Danh sách lịch làm việc của các bác sĩ.',
      data : listScheduleDoctor
    })
  } catch (error) {
    console.log('Lỗi khi lấy danh sách lịch làm việc cho bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}

const

const deleteSchedule = async(req,res) =>{
  try {
    const deleteS = await SchedulesDoctor.findByIdAndDelete(req.params.id)
    res.status(200).json({
      status : true,
      message : "Xóa lịch thành công"
    })
  } catch (error) {
    console.log('Lỗi khi xóa lịch làm việc cho bác sĩ.', error);
    res.status(500).json({status : false , message : 'Lỗi server'})
  }
}

module.exports = {checkAvailableDoctors,createScheduleDoctor, getAllScheduleDoctor, deleteSchedule}