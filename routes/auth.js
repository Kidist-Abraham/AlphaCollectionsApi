const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
    const { email, password } = req.body;
    try {
      // Check if user already exists
      const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }
  
      // Hash the password and insert the user
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [
        email,
        hashedPassword,
      ]);
      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      console.error("Error during registration:", error.message);
      res.status(500).json({ message: "An error occurred during registration" });
    }
  });
  

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (user.rows.length === 0) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
  
      const token = jwt.sign({ id: user.rows[0].id, email }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({ token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  

module.exports = router;
