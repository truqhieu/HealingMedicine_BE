const mongoose = require('mongoose');
const User = require('../models/user.model')
const Doctor = require('../models/doctor.model');
const Staff = require('../models/staff.model');
const bcrypt = require('bcryptjs')

const ROLE_ACCOUNT = ['Doctor', 'Nurse', 'Staff', 'Patient', 'Manager'];
const GENDER = User.schema.path('gender').enumValues;
const STATUS = User.schema.path('status').enumValues;

const createAccount = async(req, res) =>{
    try {
        const {fullName, email, password, role, phone, specialization, yearsOfExperience} = req.body
        const checkEmail = await User.findOne({email})
        if(checkEmail){
            return res.status(400).json({
                status : false,
                message : 'Email đã tồn tại!'
            });
        }
        if(!password || password.lengh < 8){
            return res.status(400).json({
                status : false,
                message : 'Mật khẩu phải có ít nhất 8 ký tự!'
            });
        }
        if(!ROLE_ACCOUNT.includes(role)){
            return res.status(400).json({
                status : false,
                message : 'Vai trò không hợp lệ!'
            });
        }
        const roleMap = {
            Doctor: 'Bác sĩ',
            Nurse: 'Y tá',
            Staff: 'Lễ tân',
            Patient: 'Bệnh nhân',
            Manager: 'Quản lý'

        };
        
        // ⭐ Tạo User account
        const newAccount = new User({fullName, email, passwordHash : password, role, phone, status : 'Active'})
        await newAccount.save();
        
        // ⭐ Nếu role là Doctor, tạo record trong Doctor collection
        if (role === 'Doctor') {
            const newDoctor = new Doctor({
                doctorUserId: newAccount._id,
                specialization: specialization || null,
                yearsOfExperience: yearsOfExperience || 0,
                status: 'Available'
            });
            await newDoctor.save();
        }
        
        // ⭐ Nếu role là Nurse, tạo record trong Nurse collection (nếu có)
        if (role === 'Nurse') {
            // Nếu có model Nurse, thêm code tương tự ở đây
            // const Nurse = require('../models/nurse.model');
            // const newNurse = new Nurse({
            //     nurseUserId: newAccount._id,
            //     status: 'Available'
            // });
            // await newNurse.save();
        }

        // ⭐ Nếu role là Staff, tạo record trong Staff collection
        if (role === 'Staff') {
            const newStaff = new Staff({
                staffUserId: newAccount._id,
                status: 'Available'
            });
            await newStaff.save();
        }
        
        res.status(201).json({
            status : true,
            message : `Tạo tài khoản cho ${roleMap[role]} thành công`,
            data: {
                userId: newAccount._id,
                email: newAccount.email,
                fullName: newAccount.fullName,
                role: newAccount.role
            }
        });

    } catch (error) {
        console.error('Lỗi tạo tài khoản:', error);
        res.status(500).json({
            status: false,
            message: 'Đã xảy ra lỗi khi tạo tài khoản!'
        });
    }
}

const getAllAccounts = async(req,res) =>{
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
            gender,
            role,
        }   = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;  // ⭐ Sửa: dùng pageNum thay vì page

        const filter = {};
        if(status && STATUS.includes(status)) filter.status = status;
        if(gender && GENDER.includes(gender)) filter.gender = gender;
        if(role && ROLE_ACCOUNT.includes(role)) filter.role = role;

        if(search && String(search).trim().length > 0){
            const searchKey = String(search).trim();
            const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regax = new RegExp(safe, 'i');
            filter.$or =[
                {fullName : {$regex : regax}},
                {email : {$regex : regax}},
                {phoneNumber : {$regex : regax}},
            ]
        }

        const[total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
            .select('-passwordHash -__v')  // ⭐ Thêm role vào để xem được role
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
            data : users
        })
    } catch (error) {
        console.error('Lỗi lấy danh sách tài khoản', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const viewDetailAccount = async(req,res) =>{
    try {
        const detailAccount = await User.findById(req.params.id).select('role -passwordHash -__v');
        if(!detailAccount){
            return res.status(400).json({
                status : false,
                message : 'Không tìm thấy tài khoản'
            })
        }
        res.status(200).json({
            status : true,
            message : 'Chi tết tài khoản',
            data : detailAccount
        })
    } catch (error) {
        console.error('Lỗi xem chi tiết tài khoản', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const updateAccount = async (req,res) => {
    try {
        const checkUser = await User.findById(req.params.id)
        if(checkUser.role === 'Patient'){
            return res.status(400).json({
                status : false,
                message : 'Không thể cập nhật tài khoản bệnh nhân.'
            })
        }
        const updateFields = [
            'fullName',
            'phoneNumber',
            'address',
            'dob',
            'gender', 
        ];

        const updates = {};
        Object.keys(req.body).forEach(key =>{
            if(updateFields.includes(key)) {
                updates[key] = req.body[key]
            }
        });
        
        if(Object.keys(updates).length === 0){
            return res.status(400).json({
                status : false,
                message : 'Không có trường hợp lệ để cập nhật'
            });
        }

        const account = await User.findByIdAndUpdate(
            req.params.id,
            {$set : updates},
            {new : true, runValidators : true}
        ).select('-passwordHash');
        if(!account){
            return res.status(400).json({
                status : false, 
                message : 'Không tìm thấy tài khoản'
            });
        }
        res.status(200).json({
            status : true,
            message : 'Cập nhật thông tin tài khoản thành công',
            data : account
        })
    } catch (error) {
        console.error('Lỗi cập nhật tài khoản', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const changePassword = async (req, res) => {
  try {
    const checkUser = await User.findById(req.params.id);

    if (!checkUser) {
      return res.status(404).json({
        status: false,
        message: 'Không tìm thấy người dùng.'
      });
    }

    if (checkUser.role === 'Patient') {
      return res.status(403).json({
        status: false,
        message: 'Không thể thay đổi mật khẩu của bệnh nhân.'
      });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        status: false,
        message: 'Vui lòng nhập mật khẩu mới.'
      });
    }

    // const salt = await bcrypt.genSalt(12);
    // const hashedPassword = await bcrypt.hash(password, salt);

    checkUser.passwordHash = password;
    await checkUser.save();

    res.status(200).json({
      status: true,
      message: `Đổi mật khẩu thành công cho người dùng: ${checkUser.fullName || checkUser.email}`
    });

  } catch (error) {
    console.error('Lỗi thay đổi mật khẩu:', error);
    return res.status(500).json({
      status: false,
      message: 'Lỗi server.'
    });
  }
};

const lockAcount = async (req,res) =>{
    try {
        const lockAcc = await User.findByIdAndUpdate(
            req.params.id,
            {status : 'Lock'},
            {new : true, runValidators : true}
        );
        if(!lockAcc){
             return res.status(400).json({
                status : false, 
                message : 'Không tìm thấy tài khoản'
            });
        }
        res.status(200).json({
            status : true,
            message : 'Khóa tài khoản thành công',
            data : lockAcc
        })
    } catch (error) {
        console.error('Lỗi khóa tài khoản', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}
const unlockAcount = async (req,res) =>{
    try {
        const unlockAcc = await User.findByIdAndUpdate(
            req.params.id,
            {status : 'Active'},
            {new : true, runValidators : true}
        );
        if(!unlockAcc){
             return res.status(400).json({
                status : false, 
                message : 'Không tìm thấy tài khoản'
            });
        }
        res.status(200).json({
            status : true,
            message : 'Mở khóa tài khoản thành công',
            data : unlockAcc
        })
    } catch (error) {
        console.error('Lỗi mở khóa tài khoản', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const assignRole = async (req,res) =>{
    try {
        const user = await User.findById(req.params.id)
        if(user.role !== 'Doctor' && user.role !== 'Nurse'){
            return res.status(400).json({
                status : true,
                message : 'Chỉ có thể thay đổi vai trò của bác sĩ hoặc y tá'
            })
        }

        user.role = user.role === 'Doctor' ? 'Nurse' : 'Doctor';
        await user.save();

        res.status(200).json({
            status : true,
            message : 'Thay đổi vai trò thành công',
        })
    } catch (error) {
        console.error('Lỗi thay đổi vai trò', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}




module.exports = {
createAccount,
getAllAccounts,
viewDetailAccount,
updateAccount,
changePassword,
lockAcount,
unlockAcount,
assignRole
};