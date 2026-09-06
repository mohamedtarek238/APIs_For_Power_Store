const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: Number
    }
  ],
  offerCode: String,
  discountAmount: { type: Number, default: 0 },
  totalPrice: Number,
  paymentMethod: { type: String, default: "Cash On Delivery" },
  status: {
    type: String,
    enum: ["pending", "shipped", "delivered"],
    default: "pending"
  },
  address: String,
  phone: String
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
