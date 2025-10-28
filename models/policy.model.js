const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Draft'],
    default: 'Active'
  }
}, {
  timestamps: true, 
  collection: 'policies' 
});

policySchema.index({ active: 1, status: 1 });
policySchema.index({ createdAt: -1 });

policySchema.pre('save', function(next) {
  if (this.status === 'Active' && !this.active) {
    this.active = true;
  }
  if (this.status === 'Inactive' && this.active) {
    this.active = false;
  }
  next();
});

module.exports = mongoose.model('Policy', policySchema);
