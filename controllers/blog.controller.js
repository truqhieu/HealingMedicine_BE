const Blog = require('../models/blog.model');
const {cloudinary, deleteOldImage} = require('../config/cloudinary');
const fs = require('fs');
const mongoose= require('mongoose');

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

    const [total, blogs] = await Promise.all([
      Blog.countDocuments(filter),
      Blog.find(filter)
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
                status : false,
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

const updateBlog = async(req,res) =>{
    try {
        const updateFileds = [
            'title',
            'summary',
            'category',
            'status'
        ]

        const updates = {};
        Object.keys(req.body).forEach(key =>{
            if(updateFileds.includes(key)){
                updates[key] = req.body[key];
            }

      else if(key === 'title'){
        const title = req.body[key];
          if (title) {
            // Kiểm tra không để trống
            if (typeof title !== 'string' || title.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Tên blog không được để trống'
              });
            }
            
            const cleanTitle = title.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanTitle)) {
              return res.status(400).json({
                success: false,
                message: 'Tên blog không được chứa tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanTitle.length < 2) {
              return res.status(400).json({
                success: false,
                message: 'Tên blog phải có ít nhất 2 ký tự'
              });
            }
            
            updates[key] = cleanTitle;
          }
      }
      else if(key === 'summary'){
        const summary = req.body[key];
          if (summary) {
            // Kiểm tra không để trống
            if (typeof summary !== 'string' || summary.trim().length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả blog không được để trống'
              });
            }
            
            const cleanSummary = tisummarytle.trim();
            
            if (!/^[a-zA-ZÀ-ỹ0-9\s]+$/.test(cleanSummary)) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả blog không được chứa tự đặc biệt'
              });
            }
            
            // Kiểm tra độ dài tối thiểu (ít nhất 2 ký tự)
            if (cleanSummary.length < 5) {
              return res.status(400).json({
                success: false,
                message: 'Mô tả blog phải có ít nhất 5 ký tự'
              });
            }
            
            updates[key] = cleanSummary;
          }
      }
      });

      if(req.file){
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder : "blogs",
            resource_type : "image",
            transformation : [
                { width: 300, height: 300, crop: "fill", gravity: "face" },
                { quality: "auto" },
            ],                
        });

        const blog = await Blog.findById(req.params.id);

        if(blog.imageId){
            await deleteOldImage(blog.imageId)
        }
        updates.thumbnailUrl = result.secure_url;
        fs.unlinkSync(req.file.path);
      }
    if(Object.keys(updates).length === 0){
      return res.status(400).json({
        success : false,
        message : 'Không có trường hợp lệ để cập nhật'
      })
    }

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      {$set : updates},
      {new : true, runValidators : true}
    );
    if(!blog){
      return res.status(400).json({
        success : false,
        message : 'Không tìm thấy blog'
      });
    }

    res.status(200).json({
      success : true,
      message : 'Cập nhật thông tin blog thành công',
      data : blog
    })

    } catch (error) {
        console.log('Lỗi khi cập nhật blog', error);
        return res.status(500).json({
            success : false,
            message : 'Đã xảy ra lỗi khi cập nhật blog'
        })              
    }
}

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