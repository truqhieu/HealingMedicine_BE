const { Schema } = require('mongoose');
const Clinicroom = require('../models/clinic.model')
const User = require('../models/user.model')


const createClinicRoom = async(req,res) =>{
    try {
        const {name, description} = req.body;
        if (name) {
            if (typeof name !== 'string' || name.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Tên phòng khám không được để trống'
              });
            }
            
            const cleanName = name.trim();
            
            if (!/^[a-zA-ZÀ-ỹĐđ0-9\s]+$/.test(cleanName)) {
              return res.status(400).json({
                success: false,
                message: 'Tên phòng khám không hợp lệ'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanName.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài tên phòng khám không hợp lệ (tối thiểu 2 ký tự)'
              });
            }
        }

        if (description) {
            if (typeof description !== 'string' || description.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả phòng khám không được để trống'
              });
            }
            
            const cleanDescription = description.trim();
            
            if (!/^[a-zA-ZÀ-ỹĐđ0-9\s,.\-\/]+$/.test(cleanDescription)) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả phòng khám không hợp lệ'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 4 ký tự)
            if (cleanDescription.length < 4) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài mô tả phòng khám không hợp lệ (tối thiểu 4 ký tự)'
              });
            }
        }        
        const createRoom = new Clinicroom({name, description});
        await createRoom.save();
        res.status(201).json({
            success : true,
            message : 'Tạo phòng khám mới thành công',
            data : createRoom
        })
    } catch (error) {
        console.error('Lỗi tạo phòng khám', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi tạo phòng khám' });
    }
}

const STATUS = Clinicroom.schema.path('status').enumValues;
const getAllClinicRooms = async(req,res) =>{
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
            startDate,
            endDate,
            sort = 'desc'
        } = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1)
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;

        const filter = {};
        if(status && STATUS.includes(status)) filter.status = status;

        if(search && String(search).trim().length > 0){
            const serachKey = String(search).trim();
            const safe = serachKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regax = new RegExp(safe, 'i');
            filter.$or = [
                {name : {$regex : regax}},
                {description : {$regex : regax}},
            ]
        }

        if(startDate || endDate){
          filter.createdAt = {};
          if(startDate){
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filter.createdAt.$gte = start;
          }
          if(endDate){
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 9999);
            filter.createdAt.$lte = end;
          }
        }
        const sortOrder = sort === 'asc' ? 1 : -1;       

        const [total, clinicrooms] = await Promise.all([
            Clinicroom.countDocuments(filter),
            Clinicroom.find(filter)
            .populate({
                path : 'assignedDoctorId',
                select : 'fullName'
            })
            .sort({createdAt : sortOrder})
            .select('-__v')
            .skip(skip)
            .limit(limitNum)
            .lean()
        ]);

        const totalPages = Math.max(1, Math.ceil(total/ limitNum));

        return res.status(200).json({
            status : true,
            total,
            totalPages,
            page : pageNum,
            limit : limitNum,
            data : clinicrooms
        })
    } catch (error) {
        console.log('Lỗi lấy danh sách phòng khám', error);
        return res.status(500).json({success : false, message : 'Đã xảy ra lỗi khi lấy danh sách phòng khám'})
    }
}

const viewDetailClinicRoom = async(req,res) =>{
    try {
        const detailRoom = await Clinicroom.findById(req.params.id)
        .populate({
            path : "assignedDoctorId",
            select : "fullName"
        });
        if(!detailRoom){
            return res.status(400).json({
                success : false,
                message : 'Không tìm thấy phòng khám'
            });
        }

        res.status(200).json({
            success : true,
            message : 'Chi tiết phòng khám',
            data : detailRoom
        })
    } catch (error) {
        console.log('Lỗi khi xem chi tiết phòng khám', error);
        res.status(500).json({success : false, message : 'Đã xảy ra lỗi khi xem chi tiết phòng khám' });
    }
}

const updateClinicRoom = async(req,res) =>{
    try {
        const updateFields = [
            'name',
            'description',
            'status'
        ]
    
    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (!updateFields.includes(key)) continue;

      let value = req.body[key];

      if (key === 'name') {
        const cleanName = value?.trim() || '';
        if(cleanName.length === 0){
          return res.status(400).json({ success: false, message: 'Tên phòng khám không được để trống' });
        }
        if (!/^[a-zA-ZÀ-ỹĐđ0-9\s]+$/.test(cleanName)) {
          return res.status(400).json({ success: false, message: 'Tên phòng khám không hợp lệ' });
        }

        if (cleanName.length < 2) {
          return res.status(400).json({ success: false, message: 'Độ dài tên phòng khám không hợp lệ (tối thiểu 2 ký tự)' });
        }
        updates[key] = cleanName;
      }
      // --- Validate address ---
      if (key === 'description') {
        const cleanDescription = value?.trim() || '';
        if(cleanDescription.length === 0){
          return res.status(400).json({
            success : false,
            message : 'Mô tả phòng khám không được để trống'
          })
        }
        if (!/^[a-zA-ZÀ-Ỹà-ỹĐđ0-9\s,.\-\/]+$/.test(cleanDescription)) {
          return res.status(400).json({ success: false, message: 'Địa chỉ không hợp lệ' });
        }
        if (cleanDescription.length < 4) {
          return res.status(400).json({ success: false, message: 'Độ dài mô tả phòng khám không hợp lệ (tối thiểu 4 ký tự)' });
        }
        updates[key] = cleanDescription;
        
      }
     //  Status 
      if (key === 'status') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có trường hợp lệ để cập nhật' });
    }

        const room = await Clinicroom.findByIdAndUpdate(
            req.params.id,
            {$set : updates},
            {new : true, runValidators : true}
        )

        if(!room){
            return res.status(400).json({
                success : false, 
                message : 'Không tìm thấy phòng khám'
            }); 
        }
        res.status(200).json({
            success : true, 
            message : 'Cập nhật thông tin phòng khám thành công',
            data : room
        })
    } catch (error) {
        console.log('Lỗi cập nhật phòng khám', error);
        res.status(500).json({success : false, message : 'Đã xảy ra lỗi khi cập nhật thông tin phòng khám' });
    }
}

const deleteClinicRoom = async(req,res) =>{
    try {
        const room = await Clinicroom.findByIdAndDelete(req.params.id)
        if(!room){
            return res.status(404).json({
                success : false,
                message : 'Không tìm thấy phòng khám để xóa'
            })
        }
        res.status(200).json({
            success : true,
            message : 'Xóa phòng khám thành công.'
        })
    } catch (error) {
        console.error('Lỗi xóa phòng khám', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi xóa phòng khám' });   
    }
}

const listDoctor = async (req, res) => {
  try {
    const offDoctor = await Clinicroom.find({assignedDoctorId : {$ne : null}}).distinct('assignedDoctorId')

    const onDoctor = await User.find({
        role : 'Doctor',
        _id : {$nin : offDoctor}
    })
    res.status(200).json({
        success: true,
        message: 'Danh sách bác sĩ chưa được gán phòng khám',
        data: onDoctor,
    });
  } catch (error) {
    console.log('Lỗi lấy danh sách bác sĩ.', error)
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi lấy danh sách bác sĩ' });
  }
};

const assignDoctor = async(req,res) =>{
    try {
        const {doctorId} = req.body

        const clinic = await Clinicroom.findByIdAndUpdate(
            req.params.id,
            {assignedDoctorId : doctorId},
            {new : true}
        ).populate({
            path : 'assignedDoctorId',
            select : 'fullName'
        })
        const doctor = await User.findById(doctorId);
        res.status(200).json({
            success : true,
            message : `Gán bác sĩ ${doctor.fullName} vào phòng khám ${clinic.name} thành công.`,
            data : clinic
        })
    } catch (error) {
        console.log('Lỗi gán bác sĩ cho phòng khám', error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi gán bác sĩ vào phòng khám' });

    }
}

const unssignDoctor = async(req,res) =>{
    try {
        const clinic = await Clinicroom.findByIdAndUpdate(
            req.params.id,
            {assignedDoctorId : null},
            {new : true}
        )
        if(!clinic){
            return res.status(404).json({
                success : false,
                message : 'Không tìm thấy phòng khám'
            })
        }
        res.status(200).json({
            success : true,
            message : `Gỡ bác sĩ khỏi phòng khám thành công.`,
            data : clinic
        })
    } catch (error) {
        console.log('Lỗi gỡ bác sĩ cho phòng khám', error);
        res.status(500).json({ success: false, messge: 'Đã xảy ra lỗi khi gỡ bác sĩ khỏi phòng khám' });

    }
}

module.exports = {
createClinicRoom, 
getAllClinicRooms,
viewDetailClinicRoom,
updateClinicRoom,
deleteClinicRoom,
listDoctor,
assignDoctor,
unssignDoctor
};

