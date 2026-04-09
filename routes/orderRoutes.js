const router = require("express").Router();
const auth = require("../middleware/auth");
const { createOrder, myOrders } = require("../controllers/orderController");

router.post("/", auth, createOrder);
router.get("/my", auth, myOrders);

module.exports = router;
