const Order = require("../models/Order");

exports.createOrder = async (req, res) => {
  const order = await Order.create({
    ...req.body,
    user: req.user._id
  });
  res.json(order);
};

exports.myOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.json(orders);
};
