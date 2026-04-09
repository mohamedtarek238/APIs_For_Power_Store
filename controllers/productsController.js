const Product = require("../models/Product");

exports.getProducts = async (req, res) => {
  const products = await Product.find({ isActive: true });
  res.json(products);
};

exports.getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  res.json(product);
};
