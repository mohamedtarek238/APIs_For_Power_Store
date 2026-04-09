const router = require("express").Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus
} = require("../controllers/adminController");

router.post("/products", auth, admin, createProduct);
router.put("/products/:id", auth, admin, updateProduct);
router.delete("/products/:id", auth, admin, deleteProduct);

router.get("/orders", auth, admin, getOrders);
router.put("/orders/:id", auth, admin, updateOrderStatus);

module.exports = router;
