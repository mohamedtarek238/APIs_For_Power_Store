const Order = require("../models/Order");
const Product = require("../models/Product");
const Offer = require("../models/Offer");

const calculateDiscount = (totalPrice, offer) => {
  let discountAmount = 0;

  if (offer.discountType === "percentage") {
    discountAmount = (Number(totalPrice) * Number(offer.discountValue)) / 100;
    if (offer.maxDiscountAmount && discountAmount > Number(offer.maxDiscountAmount)) {
      discountAmount = Number(offer.maxDiscountAmount);
    }
  }

  if (offer.discountType === "fixed") {
    discountAmount = Number(offer.discountValue);
    if (discountAmount > Number(totalPrice)) {
      discountAmount = Number(totalPrice);
    }
  }

  return discountAmount;
};

exports.createOrder = async (req, res) => {
  try {
    const {
      customerName,
      phone,
      address,
      paymentMethod,
      products,
      offerCode
    } = req.body;

    if (!customerName || !phone || !address || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Customer name, phone, address, and products are required" });
    }

    const productIds = products.map((item) => item.product);
    const mongoProducts = await Product.find({ _id: { $in: productIds } });

    if (mongoProducts.length !== productIds.length) {
      return res.status(404).json({ message: "One or more products not found" });
    }

    const productMap = new Map(mongoProducts.map((product) => [product._id.toString(), product]));

    let subtotal = 0;
    for (const item of products) {
      const product = productMap.get(item.product.toString());
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) {
        return res.status(400).json({ message: "Product quantity must be greater than 0" });
      }

      subtotal += Number(product.price) * quantity;
    }

    let finalPrice = subtotal;
    let discountAmount = 0;
    let resolvedOfferCode = null;

    if (offerCode) {
      const offer = await Offer.findOne({ code: offerCode.toString().trim().toUpperCase() });

      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      if (!offer.isActive) {
        return res.status(400).json({ message: "Offer is inactive" });
      }

      const now = new Date();
      if (offer.startDate && new Date(offer.startDate) > now) {
        return res.status(400).json({ message: "Offer is not active yet" });
      }

      if (offer.endDate && new Date(offer.endDate) < now) {
        return res.status(400).json({ message: "Offer expired" });
      }

      if (offer.usageLimit !== undefined && offer.usageLimit !== null && offer.usedCount >= offer.usageLimit) {
        return res.status(400).json({ message: "Offer usage limit reached" });
      }

      if (subtotal < Number(offer.minOrderAmount || 0)) {
        return res.status(400).json({ message: "Minimum order amount not met" });
      }

      discountAmount = calculateDiscount(subtotal, offer);
      finalPrice = Math.max(0, subtotal - discountAmount);
      resolvedOfferCode = offer.code;

      offer.usedCount += 1;
      await offer.save();
    }

    const order = await Order.create({
      customerName,
      phone,
      address,
      paymentMethod: paymentMethod || "Cash On Delivery",
      products,
      offerCode: resolvedOfferCode,
      discountAmount,
      totalPrice: finalPrice,
      status: "pending"
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
