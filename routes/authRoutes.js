const router = require("express").Router();
const { login } = require("../controllers/authController");
const { createAdmin } = require("../controllers/authController");

router.post("/login", login);
router.post("/createAdmin", createAdmin);

module.exports = router;
