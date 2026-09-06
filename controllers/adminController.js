const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");
const Order = require("../models/Order");

exports.createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (req.file) {
      productData.image = `/uploads/${req.file.filename}`;
    }

    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updateData = { ...req.body };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;

      if (existingProduct.image) {
        const oldImagePath = path.join(__dirname, "../", existingProduct.image.replace(/^\//, ""));
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error("Failed to delete old product image:", err);
        }
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.image) {
      const imagePath = path.join(__dirname, "../", product.image.replace(/^\//, ""));
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.error("Failed to delete product image:", err);
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getOrders = async (req, res) => {
  const orders = await Order.find().populate("user");
  res.json(orders);
};

exports.updateOrderStatus = async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );
  res.json(order);
};
