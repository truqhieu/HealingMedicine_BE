const Blog = require('../models/blog.model');
const {cloudinary, deleteOldImage} = require('../config/cloudinary');
const fs = require('fs');

const createBlog = async(req,res) =>{
    try {
        const {
            title,
            category,
            summary,
            status,
        } = req.body;
        
        if(title) {
            if(typeof title !== 'string' || title.trim().length === 0){
                return res.status(400).json({
                    success : false,
                    message : 'Tiêu đề blog không được để trống'
                })
            }

            const cleanTitle = title.trim();
            if(!/^[a-zA-ZÁ-ỹ0-9\s]+$/.test(cleanTitle)){
                return res.status(400).json({
                    success : false,
                    message : 'Tiêu đề blog không chứa kí tự đặc biệt'
                })
            }

            if(cleanTitle.length < 3){
                return res.status(400).json({
                    success : false,
                    message : 'Tiêu đề blog phải có ít nhất 3 ký tự'
                })
            }
        }

        if(summary) {
            if(typeof summary !== 'string' || summary.trim().length === 0){
                return res.status(400).json({
                    success : false,
                    message : 'Mô tả blog không được để trống'
                })
            }

            const cleanSummary = summary.trim();
            if(!/^[a-zA-ZÁ-ỹ0-9\s]+$/.test(cleanSummary)){
                return res.status(400).json({
                    success : false,
                    message : 'Mô tả blog không chứa kí tự đặc biệt'
                })
            }

            if(cleanSummary.length < 10){
                return res.status(400).json({
                    success : false,
                    message : 'Mô tả blog phải có ít nhất 10 ký tự'
                })
            }
        }        

        let imageUrl = null;
        if(req.file){
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder : "blogs",
                resource_type : "image",
                transformation : [
                    { width: 300, height: 300, crop: "fill", gravity: "face" },
                    { quality: "auto" },
                ],
            });
            imageUrl = result.secure_url;
            imageId = result.public_id;
            fs.unlinkSync(req.file.path);
        }
        const blog = new Blog({
            title,
            category,
            summary,
            authorUserId : req.user.userId,
            thumbnailUrl : imageUrl,
            status,
        });
        await blog.save();

        res.status(201).json({
            success : true,
            message : 'Tạo mới blog thành công',
            data : blog
        })
    } catch (error) {
        console.log('Lỗi khi tạo blog', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi tạo blog'
        })
    }
}

const CATEGORY = Blog.schema.path('category').enumValues;
const STATUS = Blog.schema.path('status').enumValues;
const getAllBlogs = async(req,res) =>{
   try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      search,
      startDate,
      endDate,
      sort = 'desc'
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if(req.user?.role !== 'Manager'){
        filter.status = 'Published'
    }
    if(category && CATEGORY.includes(category)) filter.category = category;
    if(status && STATUS.includes(status)) filter.status = status;

    if(search && String(search).trim().length > 0){
      const searchKey = String(search).trim();
      const safe = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filter.$or = [
        {title : {$regex : regex}},
        {summary : {$regex : regex}},
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

    const [total, blogs] = await Promise.all([
      Blog.countDocuments(filter),
      Blog.find(filter)
      .sort({createdAt : sortOrder})
      .skip(skip)
      .limit(limitNum)
      .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(total/limitNum));
    return res.status(200).json({
      status : true,
      total,
      totalPages,
      page : pageNum,
      limit : limitNum,
      data : blogs
    })
    } catch (error) {
        console.log('Lỗi khi lấy danh sách blog', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi lấy danh sách blog'
        })
    }
}

const viewDetailBlogs = async(req,res) =>{
    try {
        const blog = await Blog.findById(req.params.id);
        if(!blog){
            return res.status(404).json({
                success : false,
                message : 'Không tìm thấy blog'
            });
        }

        res.status(200).json({
            success : true,
            message : 'Chi tiết blog',
            data : blog
        })
    } catch (error) {
        console.log('Lỗi khi xem chi tiết blog', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi xem chi tiết blog'
        })        
    }
}

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        const allowedFields = ['title', 'summary', 'category', 'status'];

        // === 1. XỬ LÝ CÁC TRƯỜNG TEXT ===
        for (const field of allowedFields) {
            const value = req.body[field];

            // Nếu không gửi field → bỏ qua (không bắt buộc cập nhật)
            if (value === undefined) continue;

            // Nếu gửi nhưng để trống → lỗi
            if (typeof value !== 'string' || value.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `${field === 'title' ? 'Tiêu đề' : 
                                 field === 'summary' ? 'Mô tả' : 
                                 field === 'category' ? 'Danh mục' : 'Trạng thái'} không được để trống`
                });
            }

            const cleanValue = value.trim();

            // Regex: chỉ chữ cái, số, tiếng Việt, khoảng trắng
            if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanValue)) {
                return res.status(400).json({
                    success: false,
                    message: `${field === 'title' ? 'Tiêu đề' : 
                                 field === 'summary' ? 'Mô tả' : 
                                 field === 'category' ? 'Danh mục' : 'Trạng thái'} không được chứa ký tự đặc biệt`
                });
            }

            // Độ dài tối thiểu
            const minLength = field === 'title' ? 3 :
                             field === 'summary' ? 10 :
                             field === 'category' ? 2 : 3;

            if (cleanValue.length < minLength) {
                return res.status(400).json({
                    success: false,
                    message: `${field === 'title' ? 'Tiêu đề' : 
                                 field === 'summary' ? 'Mô tả' : 
                                 field === 'category' ? 'Danh mục' : 'Trạng thái'} phải có ít nhất ${minLength} ký tự`
                });
            }

            updates[field] = cleanValue;
        }

        // === 2. XỬ LÝ ẢNH (nếu có) ===
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "blogs",
                resource_type: "image",
                transformation: [
                    { width: 300, height: 300, crop: "fill", gravity: "face" },
                    { quality: "auto" },
                ],
            });

            const blog = await Blog.findById(id);
            if (blog && blog.thumbnailId) {
                await deleteOldImage(blog.thumbnailId); // Hàm xóa ảnh cũ
            }

            updates.thumbnailUrl = result.secure_url;
            updates.thumbnailId = result.public_id; // Lưu ID để xóa sau

            // Xóa file tạm
            fs.unlinkSync(req.file.path);
        }

        // === 3. KIỂM TRA CÓ GÌ ĐỂ CẬP NHẬT KHÔNG ===
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có trường hợp lệ để cập nhật'
            });
        }

        // === 4. CẬP NHẬT DB ===
        const blog = await Blog.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy blog'
            });
        }

        // === 5. TRẢ KẾT QUẢ ===
        res.status(200).json({
            success: true,
            message: 'Cập nhật blog thành công',
            data: blog
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật blog:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật blog'
        });
    }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy blog để xóa'
      });
    }

    // Nếu có ảnh thì xóa trên Cloudinary
    if (blog.imageId) {
      try {
        await deleteOldImage(blog.imageId);
      } catch (err) {
        console.warn('⚠️ Lỗi khi xóa ảnh Cloudinary:', err.message);
      }
    }

    // Xóa blog khỏi MongoDB
    await Blog.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa blog thành công'
    });

  } catch (error) {
    console.error('Lỗi khi xóa blog:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xóa blog'
    });
  }
};



module.exports = {createBlog, getAllBlogs, viewDetailBlogs, updateBlog, deleteBlog}