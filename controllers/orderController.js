const Order = require("../models/Order");
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
    const orderData = { ...req.body };
    const originalTotalPrice = Number(orderData.totalPrice);

    if (orderData.offerCode) {
      const offer = await Offer.findOne({ code: orderData.offerCode.toString().trim().toUpperCase() });

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

      if (Number(originalTotalPrice) < Number(offer.minOrderAmount || 0)) {
        return res.status(400).json({ message: "Minimum order amount not met" });
      }

      const discountAmount = calculateDiscount(originalTotalPrice, offer);
      const finalPrice = Math.max(0, originalTotalPrice - discountAmount);

      orderData.discountAmount = discountAmount;
      orderData.totalPrice = finalPrice;
      orderData.offerCode = offer.code;

      offer.usedCount += 1;
      await offer.save();
    }

    const order = await Order.create({
      ...orderData,
      user: req.user._id
    });

    res.json(order);
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
