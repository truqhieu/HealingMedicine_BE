const mongoose = require('mongoose');
const User = require('../models/user.model')
const bcrypt = require('bcryptjs')

const ROLE_ACCOUNT = ['Doctor', 'Nurse', 'Staff', 'Patient', 'Manager'];
// const ASSIN_ROLE = ['Doctor', 'Nurse', 'Staff'];
const STATUS = User.schema.path('status').enumValues;

const createAccount = async(req, res) =>{
    try {
        const {fullName, email, password, role, phone} = req.body
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
            Patient: 'Bệnh nhân'
        };
        const newAccount = new User({fullName,email, passwordHash : password, role, phone, status : 'Active'})
        await newAccount.save();
        res.status(201).json({
            status : true,
            message : `Tạo tài khoản cho ${roleMap[role]} thành công`
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
        }   = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (page -1) * limitNum;

        const filter = {};
        if(status && STATUS.includes(status)) filter.status = status;

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
            .select('-passwordHash -__v')
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
        const detailAccount = await User.findById(req.params.id).select('-passwordHash -__v');
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

const changePassword = async(req,res) =>{
    try {
        const checkUser = await User.findById(req.params.id)
        if(checkUser.role === 'Patient'){
            return res.status(400).json({
                status : false,
                message : 'Không thể thay đổi tài khoản của bệnh nhân.'
            })
        }
        const newPassowrd = 'tuyenquangclinic';
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassowrd, salt)

        checkUser.passwordHash = hashedPassword;
        checkUser.mustChangePassword = true;
        await checkUser.save();
        res.status(200).json({
            status : true,
            message : `Đổi mật khẩu thành công`
        })

    } catch (error) {
        console.error('Lỗi thay đổi mật khẩu', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const lockAcount = async (req,res) =>{
    try {
        const lockAcc = await User.findByIdAndUpdate(
            req.params.id,
            {status : 'Inactive'},
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