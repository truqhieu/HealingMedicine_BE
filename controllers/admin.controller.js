const mongoose = require('mongoose');
const User = require('../models/user.model')
const Doctor = require('../models/doctor.model');
const Staff = require('../models/staff.model');
const Patient = require('../models/patient.model');

const ROLE_ACCOUNT = ['Doctor', 'Nurse', 'Staff', 'Patient', 'Manager'];


const createAccount = async(req, res) =>{
    try {
        const {fullName, email, passwordHash, dob ,role, phoneNumber, address,specialization, yearsOfExperience} = req.body
        if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0){
              return res.status(400).json({
                success: false,
                message: 'Họ tên không được để trống'
              });
            }
            
        const cleanFullName = fullName.trim();

        if(cleanFullName.length === 0){
              return res.status(400).json({
                success : false,
                message : "Họ và tên không được để trống"
              })
            }
            
        if (!/^[\p{L}\s]+$/u.test(cleanFullName)) {
              return res.status(400).json({
                success: false,
                message: 'Họ tên không được chứa số hoặc ký tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
        if (cleanFullName.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài họ và tên không hợp lệ (tối thiểu 2 ký tự)'

              });
            }
        

        if (!email || typeof email !== 'string' || email.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Email không được để trống'
              });
            }
            
        const cleanEmail = email.trim();
            
        if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
              return res.status(400).json({
                success: false,
                message: 'Email không đúng định dạng'
              });
            }
        const checkEmail = await User.findOne({email})
        if(checkEmail){
            return res.status(400).json({
                success : false,
                message : 'Email đã tồn tại!'
            });
        }
      
            if (!passwordHash || typeof passwordHash !== 'string' || passwordHash.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mật khẩu không được để trống'
              });
            }
            
            const cleanPassword = passwordHash.trim();
            
            if (!/^(?=.*[A-Z])(?=(?:.*\d){2,})(?=.*[!@#$%^&*()_+{}\[\]:;"'<>,.?/~`-]).+$/.test(cleanPassword)) {
              return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 2 chữ số và 1 kí tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu 
            if (cleanPassword.length < 4) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài mật khẩu không hợp lệ (tối thiểu 4 ký tự)'

              });
            }
        

          if(!dob || typeof dob !== 'string' || dob.trim().length === 0){
            return res.status(400).json({
              success : false,
              message : 'Ngày sinh không được để trống'
            })
          }
          const birthDate = new Date(dob);
          const now = new Date();

          if(isNaN(birthDate.getTime())){
            return res.status(400).json({
              success : false,
              message : 'Ngày sinh không hợp lệ'
            })
          }

          let age = now.getFullYear() - birthDate.getFullYear();
          const month = now.getMonth() - birthDate.getMonth();
          const day = now.getDate() - birthDate.getDate();

          if(month < 0 || (month === 0 && day < 0)){
            age --;
          }

          if(age < 18){
            return res.status(400).json({
              success : false,
              message : 'Người dùng phải đủ 18 tuổi trở lên'
            })
          }
                

        if(!role || !ROLE_ACCOUNT.includes(role)){
            return res.status(400).json({
                success : false,
                message : 'Vai trò không hợp lệ'
            });
        }

        if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Số điện thoại không được để trống'
              });
            }
            
            const cleanPhone = phoneNumber.trim();
            
            if (!/^[0-9]+$/.test(cleanPhone)) {
              return res.status(400).json({
                success: false,
                message: 'Số điện thoại chỉ được chứa chữ số'
              });
            }
            if (!cleanPhone.startsWith('0')) {
              return res.status(400).json({
                success: false,
                message: 'Số điện thoại phải bắt đầu bằng số 0'
              });
            }
            
            // Kiểm tra có đúng 10 số
            if (cleanPhone.length !== 10) {
              return res.status(400).json({
                success: false,
                message: 'Số điện thoại phải có đủ 10 số'
              });
            }
        

            if (!address || typeof address !== 'string' || address.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Địa chỉ không được để trống'
              });
            }
            
            const cleanAddress = address.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s,.\-\/]+$/.test(cleanAddress)) {
              return res.status(400).json({
                success: false,
                message: 'Địa chỉ không hợp lệ'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanAddress.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài địa chỉ không hợp lệ (tối thiểu 2 ký tự)'
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
        const newAccount = new User({fullName, email, passwordHash,dob,address, role, phoneNumber, status : 'Active'})
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
            console.log(`✅ Tạo Doctor record thành công cho user: ${newAccount._id}`);
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
                userId: newAccount._id,  // ⚠️ Sửa: staffUserId -> userId (theo model)
                status: 'Active'
            });
            await newStaff.save();
            console.log(`✅ Tạo Staff record thành công cho user: ${newAccount._id}`);
        }

        // ⭐ Nếu role là Patient, tạo record trong Patient collection
        if (role === 'Patient') {
            const newPatient = new Patient({
                patientUserId: newAccount._id,
                emergencyContact: {
                    name: '',
                    phone: '',
                    relationship: 'Other'
                }
            });
            await newPatient.save();
            console.log(`✅ Tạo Patient record thành công cho user: ${newAccount._id}`);
        }
        
        res.status(201).json({
            success : true,
            message : `Tạo tài khoản cho ${roleMap[role]} mới thành công`,
            data: {
                userId: newAccount._id,
                email: newAccount.email,
                fullName: newAccount.fullName,
                phoneNumber : newAccount.phoneNumber,
                dob : newAccount.dob,
                address : newAccount.address,
                role: newAccount.role
            }
        });

    } catch (error) {
        console.error('Lỗi tạo tài khoản:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tạo tài khoản'
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
            startDate,
            endDate,
            sort = 'desc'
        }   = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;  // ⭐ Sửa: dùng pageNum thay vì page

        const filter = {};
        if(status) filter.status = status;
        if(gender) filter.gender = gender;
        if (role) {
            filter.role = role;
        } else {
            filter.role = { $ne: 'Admin' };
        }
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

        const[total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
            .select('-passwordHash -resetPasswordToken -resetPasswordExpire -__v')  // ⭐ Thêm role vào để xem được role
            .sort({createdAt : sortOrder})
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
        return res.status(500).json({ success: false, message: 'Đã có lỗi khi lấy danh sách tài khoản' });
    }
}

const viewDetailAccount = async(req,res) =>{
    try {
        const detailAccount = await User.findById(req.params.id)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpire -__v')
        if(!detailAccount){
            return res.status(400).json({
                success : false,
                message : 'Không tìm thấy tài khoản'
            })
        }
        res.status(200).json({
            success : true,
            message : 'Chi tết tài khoản',
            data : detailAccount
        })
    } catch (error) {
        console.error('Lỗi xem chi tiết tài khoản', error);
        return res.status(500).json({ success: false, message: 'Đã có lỗi khi xem chi tiết tài khoản' });
    }
}

const updateAccount = async (req, res) => {
  try {
    const checkUser = await User.findById(req.params.id);
    if (!checkUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản',
      });
    }

    if (checkUser.role === 'Patient') {
      return res.status(400).json({
        success: false,
        message: 'Không thể cập nhật tài khoản bệnh nhân',
      });
    }

    const updateFields = ['fullName', 'phoneNumber', 'address', 'dob', 'gender', 'status'];
    const updates = {};

    for (const key of Object.keys(req.body)) {
      if (!updateFields.includes(key)) continue;

      let value = req.body[key];

      // --- Validate fullName ---
      if (key === 'fullName') {
        const cleanFullName = value.trim();
        if(cleanFullName.length === 0){
          return res.status(400).json({ success: false, message: 'Họ tên không được để trống' });
        }
          if (!/^[a-zA-ZÀ-Ỹà-ỹĐđ\s]+$/.test(cleanFullName)) {
          return res.status(400).json({ success: false, message: 'Họ tên không được chứa số hoặc ký tự đặc biệt' });
        }

        if (cleanFullName.length < 2) {
          return res.status(400).json({ success: false, message: 'Độ dài họ và tên không hợp lệ (tối thiểu 2 ký tự)' });
        }
        updates[key] = cleanFullName;
      }

      // --- Validate phoneNumber ---
      if (key === 'phoneNumber') {
        const cleanPhone = value.trim();
        if(cleanPhone.length === 0){
          updates[key] = null;
        }
        else{
          if (!/^[0-9]{10}$/.test(cleanPhone) || !cleanPhone.startsWith('0')) {
          return res.status(400).json({
            success: false,
            message: 'Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số',
          });
        }
        updates[key] = cleanPhone;
        }
      }

      // --- Validate address ---
      if (key === 'address') {
        const cleanAddress = value.trim();
        if(cleanAddress.length === 0){
          updates[key] = null;
        }
        else{
          if (!/^[a-zA-ZÀ-Ỹà-ỹĐđ0-9\s,.\-\/]+$/.test(cleanAddress)) {
          return res.status(400).json({ success: false, message: 'Địa chỉ không hợp lệ' });
        }
        if (cleanAddress.length < 2) {
          return res.status(400).json({ success: false, message: 'Độ dài địa chỉ không hợp lệ (tối thiểu 2 ký tự)' });
        }
        updates[key] = cleanAddress;
        }
      }

      // --- Validate dob ---
      if (key === 'dob') {
        const birthDate = new Date(value);
        if (isNaN(birthDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Ngày sinh không hợp lệ' });
        }
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        const m = now.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
        if (age < 18) {
          return res.status(400).json({ success: false, message: 'Người dùng phải đủ 18 tuổi trở lên' });
        }
        updates[key] = value;
      }

      // --- Gender & Status ---
      if (key === 'gender' || key === 'status') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có trường hợp lệ để cập nhật' });
    }

    const account = await User.findByIdAndUpdate(
      req.params.id, 
      {$set : updates},
      { new: true, runValidators: true })
      .select('-passwordHash');

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công',
      data: account,
    });
  } catch (error) {
    console.error('Lỗi cập nhật tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Đã có lỗi khi cập nhật thông tin tài khoản' });
  }
};


const changePassword = async (req, res) => {
  try {
    const checkUser = await User.findById(req.params.id);

    if (!checkUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    if (checkUser.role === 'Patient') {
      return res.status(403).json({
        success: false,
        message: 'Không thể thay đổi mật khẩu của bệnh nhân'
      });
    }

    const { password } = req.body;
        if (password) {
            if (typeof password !== 'string' || password.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mật khẩu không được để trống'
              });
            }
            
            const cleanPassword = password.trim();
            
            if (!/^(?=.*[A-Z])(?=(?:.*\d){2,})(?=.*[!@#$%^&*()_+{}\[\]:;"'<>,.?/~`-]).+$/.test(cleanPassword)) {
              return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 2 số và 1 kí tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu 
            if (cleanPassword.length < 4) {
              return res.status(400).json({
                success: false,
                message: 'Độ dài mật khẩu không hợp lệ (tối thiểu 4 ký tự)'
              });
            }
        }    
    // const salt = await bcrypt.genSalt(12);
    // const hashedPassword = await bcrypt.hash(password, salt);

    checkUser.passwordHash = password;
    await checkUser.save();

    res.status(200).json({
      success: true,
      message: `Đổi mật khẩu thành công cho người dùng : ${checkUser.fullName || checkUser.email}`
    });

  } catch (error) {
    console.error('Lỗi thay đổi mật khẩu:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi khi thay đổi mật khẩu'
    });
  }
};

const lockAccounts = async (req, res) => {
  try {
    const { selectedIds } = req.body;

    // ✅ Kiểm tra đầu vào
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một tài khoản để khóa',
      });
    }

    // ✅ Thực hiện khóa tài khoản
    const result = await User.updateMany(
      { _id: { $in: selectedIds } },
      { $set: { status: 'Lock' } }
    );

    return res.status(200).json({
      success: true,
      message: `Đã khóa ${result.modifiedCount} tài khoản thành công`,
    });

  } catch (error) {
    console.error('Lỗi khi khóa tài khoản:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi khóa tài khoản',
    });
  }
};

const unlockAccounts = async (req, res) => {
  try {
    const { selectedIds } = req.body;

    // ✅ Kiểm tra đầu vào
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một tài khoản để mở khóa',
      });
    }

    // ✅ Thực hiện mở khóa tài khoản
    const result = await User.updateMany(
      { _id: { $in: selectedIds } },
      { $set: { status: 'Active' } }
    );

    return res.status(200).json({
      success: true,
      message: `Đã mở khóa ${result.modifiedCount} tài khoản thành công`,
    });

  } catch (error) {
    console.error('Lỗi khi mở khóa tài khoản:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi mở khóa tài khoản',
    });
  }
};


const assignRole = async (req,res) =>{
    try {
        const user = await User.findById(req.params.id)
        if(user.role !== 'Doctor' && user.role !== 'Nurse'){
            return res.status(400).json({
                success : false,
                message : 'Chỉ có thể thay đổi vai trò của bác sĩ hoặc y tá'
            })
        }

        user.role = user.role === 'Doctor' ? 'Nurse' : 'Doctor';
        await user.save();

        if(user.role === 'Doctor'){
          const newDoctor = await Doctor.findOne({doctorUserId : req.params.id})
          if(!newDoctor){
          const newDoctor = new Doctor({
            doctorUserId : req.params.id,
            specialization : null,
            yearsOfExperience : 0,
          })
          await newDoctor.save()
        }
        }

        res.status(200).json({
            success : true,
            message : 'Thay đổi vai trò thành công',
        })
    } catch (error) {
        console.error('Lỗi thay đổi vai trò', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi đổi vai trò' });
    }
}


module.exports = {
createAccount,
getAllAccounts,
viewDetailAccount,
updateAccount,
changePassword,
lockAccounts,
unlockAccounts,
assignRole
};