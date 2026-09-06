const router = require("express").Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const upload = require("../middleware/upload");
const { createAdmin } = require("../controllers/authController");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus
} = require("../controllers/adminController");
const {
  createOffer,
  getOffers,
  updateOffer,
  deleteOffer
} = require("../controllers/offerController");

router.post("/create", createAdmin);

router.post("/products", auth, admin, upload.single("image"), createProduct);
router.put("/products/:id", auth, admin, upload.single("image"), updateProduct);
router.delete("/products/:id", auth, admin, deleteProduct);

router.get("/orders", auth, admin, getOrders);
router.put("/orders/:id", auth, admin, updateOrderStatus);

router.post("/offers", auth, admin, createOffer);
router.get("/offers", auth, admin, getOffers);
router.put("/offers/:id", auth, admin, updateOffer);
router.delete("/offers/:id", auth, admin, deleteOffer);

module.exports = router;
