const router = require("express").Router();
const { createOrder } = require("../controllers/orderController");

router.post("/", createOrder);

module.exports = router;
