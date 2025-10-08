const mongoose = require('mongoose');
const User = require('../models/user.model')

const STATUS = User.schema.path('status').enumValues;
const GENDER = User.schema.path('gender').enumValues;
const SORT = ['createAt', 'fullName']

const getAllManager = async(req,res) =>{
    try {
        const {
            page = 1,
            limit = 10,
            status,
            gender,
            search,
            sortBy = 'createAt',
            order = 'desc',
            fromDate,
            toDate,
        } = req.query
        
        //phan trang
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit,10) || 10);
        const skip = (page - 1)* limitNum;

        //loc cac truong
        const filter = {};
        filter.role = 'Manager'
        if(status && STATUS.includes(status)) filter.status = status;
        if(gender && GENDER.includes(gender)) filter.gender = gender;

        //Search cac truong
         if(search && String(search).trim().length > 0){
            const s = String(search).trim();
            const safe = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safe, 'i');
            filter.$or = [
                {fullName : {$regex: regex}},
                {phone : {$regex : regex}}
            ];
        }

        //Sort theo date 
         if(fromDate || toDate){
            filter.createAt = {};
            if(fromDate) filter.createAt.$gte = new Date(fromDate);
            if(toDate){
                const d = new Date(toDate);
                d.setHours(23, 59, 59 ,999);
                filter.createAt.$lte = d;
            }
        }

        //Sort cac truong co trong model
        const sortField = SORT.includes(sortBy) ? sortBy : 'createAt';
        const sortOrder = order === 'asc' ? 1 : -1;
        const sortObj = {[sortField] : sortOrder};

        const [total, users] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
            .select('-passwordHash -__v')
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .lean()
        ]);
        const totalPages = Math.max(1, Math.ceil(total/ limitNum));

        return res.status(200).json({
            success : true,
            total,
            totalPages,
            page : pageNum,
            limit : limitNum,
            data : users
        })
    } catch (error) {
        console.error('getAllUsers error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const getManagerById = async(req,res) =>{
    try {
        const findUser = await User.findById(req.params.id).select(" -passwordHash -__v");
        if(!findUser){
            return res.status(404).json({success: false, message: 'Không tìm thấy tài khoản'});
        }
        res.status(200).json({
            success : true,
            data : findUser
        })
    } catch (error) {
        console.error('getUserById error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const updateManager = async(req,res) =>{
    try {
        const {status} = req.body;
        if(!mongoose.Types.ObjectId.isValid(req.params.id)){
            return res.status(400).json({
                success : false,
                message : 'ID không hợp lệ'
            })
        }
        if(status && !STATUS.includes(status)){
            return res.status(400).json({success: false, message: 'Trạng thái không hợp lệ'});
        }
        const data = {};
        if(status) data.status = status;
        if(Object.keys(data).length === 0){
            return res.status(400).json({success: false, message: 'Không có dữ liệu cập nhật'});
        }
        const update = await User.findByIdAndUpdate(req.params.id, data, {new: true});
        if(!update){
            return res.status(404).json({success: false, message: 'Không tìm thấy tài khoản'});
        }
        res.status(200).json({
            success: true,
            message: 'Đã cập nhật thành công',
            data: update});
    } catch (error) {
        console.error('updateUser error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

const createManager = async(req,res) =>{
    try {
        const {fullName, email,password,  phone, gender} = req.body
        const check = await User.findOne({
            $or : [
                {email : email},
                {phone : phone}
            ]
        })
        if(check){
            return res.status(400).json({
                success : false,
                message : 'Email hoặc số điện thoại đã tồn tại'
            })
        }
        const newAccount = new User({fullName,email, passwordHash : password, phone,gender,role : 'Manager'})
        await newAccount.save();
        res.status(201).json({
            success : true,
            message : `Đã tạo thành công tài khoản cho ${fullName}`
        })
    } catch (error) {
        console.error('createAccount error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}



module.exports = {getAllManager, getManagerById, updateManager, createManager};
