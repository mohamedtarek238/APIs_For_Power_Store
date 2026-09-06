const Offer = require("../models/Offer");

const normalizeCode = (code) => {
  return code ? code.toString().trim().toUpperCase() : "";
};

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

exports.createOffer = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      applicableProducts,
      startDate,
      endDate,
      usageLimit,
      isActive
    } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Offer code is required" });
    }

    if (!discountType || !["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    if (discountValue === undefined || discountValue === null || Number(discountValue) < 0) {
      return res.status(400).json({ message: "Discount value is required" });
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && end && start > end) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    const offer = await Offer.create({
      code: normalizeCode(code),
      description,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: minOrderAmount !== undefined ? Number(minOrderAmount) : 0,
      maxDiscountAmount: maxDiscountAmount !== undefined ? Number(maxDiscountAmount) : undefined,
      applicableProducts: applicableProducts || [],
      startDate: start || undefined,
      endDate: end || undefined,
      usageLimit: usageLimit !== undefined ? Number(usageLimit) : undefined,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json(offer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Offer code already exists" });
    }

    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({ isActive: true }).sort({ createdAt: -1 });

    const activeOffers = offers.filter((offer) => {
      if (offer.startDate && new Date(offer.startDate) > now) return false;
      if (offer.endDate && new Date(offer.endDate) < now) return false;
      if (offer.usageLimit !== undefined && offer.usageLimit !== null && offer.usedCount >= offer.usageLimit) return false;
      return true;
    });

    res.json(activeOffers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (req.body.code) {
      req.body.code = normalizeCode(req.body.code);
    }

    if (req.body.discountType && !["percentage", "fixed"].includes(req.body.discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    if (req.body.discountValue !== undefined && (Number(req.body.discountValue) < 0 || Number.isNaN(Number(req.body.discountValue)))) {
      return res.status(400).json({ message: "Discount value must be a valid number" });
    }

    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (start > end) {
        return res.status(400).json({ message: "Start date cannot be after end date" });
      }
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedOffer);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Offer code already exists" });
    }

    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    res.json({ message: "Offer deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.validateOffer = async (req, res) => {
  try {
    const { code, totalPrice } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Offer code is required" });
    }

    if (totalPrice === undefined || totalPrice === null || Number(totalPrice) < 0) {
      return res.status(400).json({ message: "Valid totalPrice is required" });
    }

    const offer = await Offer.findOne({ code: normalizeCode(code) });
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

    if (Number(totalPrice) < Number(offer.minOrderAmount || 0)) {
      return res.status(400).json({ message: "Minimum order amount not met" });
    }

    const discountAmount = calculateDiscount(totalPrice, offer);
    const finalPrice = Math.max(0, Number(totalPrice) - discountAmount);

    res.json({
      valid: true,
      code: offer.code,
      discountAmount,
      finalPrice
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
