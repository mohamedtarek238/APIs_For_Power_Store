const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getActiveOffers,
  validateOffer
} = require("../controllers/offerController");

router.get("/active", getActiveOffers);
router.post("/validate", auth, validateOffer);

module.exports = router;
