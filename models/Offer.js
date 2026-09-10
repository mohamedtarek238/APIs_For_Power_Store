const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: String,
  type: {
    type: String,
    enum: ["discount", "bundle"],
    default: "discount"
  },
  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    required: function() {
      return this.type !== "bundle";
    }
  },
  discountValue: {
    type: Number,
    required: function() {
      return this.type !== "bundle";
    }
  },
  collectionName: String,
  requiredQuantity: Number,
  bundlePrice: Number,
  minOrderAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: Number,
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }],
  startDate: Date,
  endDate: Date,
  usageLimit: Number,
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Offer", offerSchema);
