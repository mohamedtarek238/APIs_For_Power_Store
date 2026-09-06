const router = require("express").Router();
const {
  getActiveOffers,
  validateOffer
} = require("../controllers/offerController");

router.get("/active", getActiveOffers);
router.post("/validate", validateOffer);

module.exports = router;
