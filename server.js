const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const offerRoutes = require("./routes/offerRoutes");
const adminRoutes = require("./routes/adminRoutes");

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

connectDB();

const app = express();
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/admin", adminRoutes);

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
