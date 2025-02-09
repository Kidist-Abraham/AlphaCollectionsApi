require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const collectionRoutes = require("./routes/collections");
const contributeRoutes = require("./routes/contribute")

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
  });
  

// Routes
app.use("/auth", authRoutes);
app.use("/collections", collectionRoutes);
app.use("/contribute", contributeRoutes);

// Start the server
if (process.env.NODE_ENV !== "test") {
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
}

module.exports = app;