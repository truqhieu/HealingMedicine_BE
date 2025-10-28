const Service = require('../models/service.model');

const createService = async(req,res) =>{
    try {
        const {serviceName, description, price, isPrepaid,durationMinutes,category} = req.body
        const checkSerice = await Service.findOne({serviceName});
        if(checkSerice){
            return res.status(400).json({
                status : false,
                message : 'Tên dịch vụ đã tồn tại.'
            })
        }
        const finalTime = category === 'Consultation' ? 30 : durationMinutes;
        const paid = category === 'Consultation' ? 'true' : 'false';
        const newService = new Service({serviceName,description, price, isPrepaid : paid,durationMinutes : finalTime,category});
        await newService.save();
        res.status(201).json({
            status : true,
            message : `Dịch vụ ${serviceName} đã dược thêm mới.`,
            data : newService
        })
    } catch (error) {
        console.error('Lỗi tạo dịch vụ:', error);
        res.status(500).json({
            status: false,
            message: 'Đã xảy ra lỗi khi tạo dịch vụ'
        });
    }
}

const REPAID = Service.schema.path('isPrepaid').enumValues;
const STATUS = Service.schema.path('status').enumValues;
const CATEGORY = Service.schema.path('category').enumValues;
const getAllServices = async(req,res) =>{
    try {
        const {
            page = 1,
            limit = 10,
            isPrepaid,
            status,
            category,
            search,
            sortPrice,
            sortTime,
        } = req.query

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 10);
        const skip = (pageNum -1) * limitNum;

        const filter = {};
        // if(isPrepaid && REPAID.includes(isPrepaid)) filter.isPrepaid = isPrepaid;
        if (isPrepaid !== undefined) {
        filter.isPrepaid = isPrepaid === 'true';}
        if(status && STATUS.includes(status)) filter.status = status;
        if(category && CATEGORY.includes(category)) filter.category = category;

        let sortP = {};
        if(sortPrice){
            if(sortPrice === "asc") sortP.price = 1;
            else if (sortPrice === "desc") sortP.price = -1;
        }

        let sortT = {};
        if(sortTime){
            if(sortTime === "asc") sortT.durationMinutes = 1;
            else if (sortTime === "desc") sortT.durationMinutes = -1;
        }

        if(search && String(search).trim().length > 0){
            const searchKey = String(search).trim();
            const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regax = new RegExp(safe, 'i');
            filter.$or =[
                {serviceName : {$regex : regax}},
            ]
        }

        const[total, services] = await Promise.all([
            Service.countDocuments(filter),
            Service.find(filter)
            .sort(sortP)
            .sort(sortT)
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
            data : services
        })
    } catch (error) {
        console.error('Lỗi lấy danh sách dịch vụ', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi lấy danh sách dịch vụ' });
    }
}

const viewDetailService = async(req,res) =>{
    try {
        const detailService = await Service.findById(req.params.id);
        if(!detailService){
            return res.status(400).json({
                status : false,
                message : 'Không tìm thấy dịch vụ'
            })
        }
        res.status(200).json({
            status : true,
            message : 'Chi tiết dịch vụ',
            data : detailService
        })
    } catch (error) {
        console.error('Lỗi xem chi tiết dịch vụ', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi xem chi tiết dịch vụ' });  
    }
}

const updateService = async(req,res) =>{
    try {
        const updateFields = [
            'serviceName',
            'description',
            'price',
            'isPrepaid',
            'durationMinutes',
            'category',
            'status'
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

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            {$set : updates},
            {new : true, runValidators : true}
        )

        if(!service){
            return res.status(400).json({
                status : false, 
                message : 'Không tìm thấy dịch vụ'
            });
        }
        res.status(200).json({
            status : true, 
            message : 'Cập nhật thông tin dịch vụ thành công',
            data : service
        })
    } catch (error) {
        console.error('Lỗi cập nhật dịch vụ', error);
        return res.status(500).json({ success: false, message: ' Đã xảy ra lỗi khi cập nhật thông tin dịch vụ' });
    }
}

const deleteService = async(req,res) =>{
    try {
        const service = await Service.findByIdAndDelete(req.params.id)
        if(!service){
            return res.status(404).json({
                status : false,
                message : 'Không tìm thấy dịch vụ để xóa'
            })
        }
        res.status(200).json({
            status : true,
            message : 'Xóa dịch vụ thành công.'
        })
    } catch (error) {
        console.error('Lỗi xóa dịch vụ', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi khi xóa dịch vụ' });
    }
}

module.exports = {
createService,
getAllServices,
viewDetailService,
updateService,
deleteService
}