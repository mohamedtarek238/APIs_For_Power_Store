const Offer = require("../models/Offer");
const Product = require("../models/Product");

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

const getBundlePricing = (products, mongoProducts, offer) => {
  const requiredQuantity = Number(offer.requiredQuantity);
  const bundlePrice = Number(offer.bundlePrice);
  const applicableProductIds = new Set((offer.applicableProducts || []).map((id) => id.toString()));
  const productMap = new Map(mongoProducts.map((product) => [product._id.toString(), product]));
  const eligibleUnits = [];
  let subtotal = 0;

  for (const item of products) {
    const product = productMap.get(item.product.toString());
    const quantity = Number(item.quantity || 0);
    if (!product || quantity <= 0) {
      return { error: "Product quantity must be greater than 0" };
    }

    subtotal += Number(product.price) * quantity;
    if (applicableProductIds.has(item.product.toString())) {
      for (let index = 0; index < quantity; index += 1) {
        eligibleUnits.push(Number(product.price));
      }
    }
  }

  if (!Number.isInteger(requiredQuantity) || requiredQuantity <= 0) {
    return { error: "Bundle requiredQuantity must be a positive integer" };
  }

  if (!Number.isFinite(bundlePrice) || bundlePrice < 0) {
    return { error: "Bundle price must be a valid non-negative number" };
  }

  const bundleCount = Math.floor(eligibleUnits.length / requiredQuantity);
  if (bundleCount === 0) {
    return { error: "Required bundle quantity not met" };
  }

  eligibleUnits.sort((first, second) => second - first);
  const bundledUnitCount = bundleCount * requiredQuantity;
  const bundledSubtotal = eligibleUnits
    .slice(0, bundledUnitCount)
    .reduce((sum, price) => sum + price, 0);

  if (bundlePrice * bundleCount > bundledSubtotal) {
    return { error: "Bundle price must not exceed the normal bundle total" };
  }

  return {
    subtotal,
    discountAmount: bundledSubtotal - (bundlePrice * bundleCount),
    finalPrice: subtotal - (bundledSubtotal - (bundlePrice * bundleCount))
  };
};

exports.createOffer = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      discountType,
      discountValue,
      collectionName,
      requiredQuantity,
      bundlePrice,
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

    const offerType = type || "discount";
    if (!["discount", "bundle"].includes(offerType)) {
      return res.status(400).json({ message: "Invalid offer type" });
    }

    if (offerType === "discount" && (!discountType || !["percentage", "fixed"].includes(discountType))) {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    if (offerType === "discount" && (discountValue === undefined || discountValue === null || Number(discountValue) < 0)) {
      return res.status(400).json({ message: "Discount value is required" });
    }

    if (offerType === "bundle" && (!Number.isInteger(Number(requiredQuantity)) || Number(requiredQuantity) <= 0 || Number(bundlePrice) < 0 || !Array.isArray(applicableProducts) || applicableProducts.length === 0)) {
      return res.status(400).json({ message: "Bundle requires products, a positive requiredQuantity, and a valid bundlePrice" });
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && end && start > end) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    const offer = await Offer.create({
      code: normalizeCode(code),
      description,
      type: offerType,
      discountType: offerType === "discount" ? discountType : undefined,
      discountValue: offerType === "discount" ? Number(discountValue) : undefined,
      collectionName,
      requiredQuantity: offerType === "bundle" ? Number(requiredQuantity) : undefined,
      bundlePrice: offerType === "bundle" ? Number(bundlePrice) : undefined,
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
    const query = { isActive: true };
    const offers = await Offer.find(query).sort({ createdAt: -1 });

    // Admin date inputs are stored at UTC midnight. Compare their calendar
    // dates inclusively so a timezone offset does not hide the selected day.
    const calendarDay = (date) => Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    const activeOffers = offers.filter((offer) => {
      if (offer.startDate && calendarDay(new Date(offer.startDate)) > today) return false;
      if (offer.endDate && calendarDay(new Date(offer.endDate)) < today) return false;
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

    if (req.body.type && !["discount", "bundle"].includes(req.body.type)) {
      return res.status(400).json({ message: "Invalid offer type" });
    }

    if (req.body.discountType && !["percentage", "fixed"].includes(req.body.discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    if (req.body.type === "bundle") {
      if (!Number.isInteger(Number(req.body.requiredQuantity)) || Number(req.body.requiredQuantity) <= 0 || Number(req.body.bundlePrice) < 0 || !Array.isArray(req.body.applicableProducts) || req.body.applicableProducts.length === 0) {
        return res.status(400).json({ message: "Bundle requires products, a positive requiredQuantity, and a valid bundlePrice" });
      }
      req.body.requiredQuantity = Number(req.body.requiredQuantity);
      req.body.bundlePrice = Number(req.body.bundlePrice);
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
    const { code, totalPrice, products } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Offer code is required" });
    }

    if ((totalPrice === undefined || totalPrice === null || Number(totalPrice) < 0) && !Array.isArray(products)) {
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

    if (offer.type === "bundle") {
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Products are required to validate a bundle offer" });
      }

      const productIds = products.map((item) => item.product);
      const mongoProducts = await Product.find({ _id: { $in: productIds } });
      if (mongoProducts.length !== productIds.length) {
        return res.status(404).json({ message: "One or more products not found" });
      }

      const pricing = getBundlePricing(products, mongoProducts, offer);
      if (pricing.error) {
        return res.status(400).json({ message: pricing.error });
      }

      if (pricing.subtotal < Number(offer.minOrderAmount || 0)) {
        return res.status(400).json({ message: "Minimum order amount not met" });
      }

      return res.json({
        valid: true,
        code: offer.code,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice
      });
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
