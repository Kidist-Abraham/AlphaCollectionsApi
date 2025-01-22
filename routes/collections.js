const express = require("express");
const { authenticateToken } = require("../utils/middleware");
const db = require("../db");

const router = express.Router();

// Get all collections
// Example: collections.js (Node + Express)
router.get("/", authenticateToken, async (req, res) => {
    try {
      // Grab query params: page, limit, and search query
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchTerm = req.query.query || "";
  
      const offset = (page - 1) * limit; // for pagination
  
      // Example using PostgreSQL:
      // "ILIKE" for case-insensitive matching. Adjust for your DB as needed.
      const searchQuery = `
        SELECT * FROM collections
        WHERE name ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const values = [`%${searchTerm}%`, limit, offset];
  
      const result = await db.query(searchQuery, values);
  
      // Also get total count (for pagination info)
      const countQuery = `
        SELECT COUNT(*) FROM collections
        WHERE name ILIKE $1
      `;
      const countResult = await db.query(countQuery, [`%${searchTerm}%`]);
      const total = parseInt(countResult.rows[0].count, 10);
  
      res.json({
        collections: result.rows,
        total,
        page,
        limit,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  // GET /collections/owned
// Return the list of collections owned by the current user
router.get("/owned", authenticateToken, async (req, res) => {
    try {
      // The user ID from the JWT
      const userId = req.user.id;
      console.log("hereeee", userId)
  
      // Retrieve collections where created_by = the current user
      const result = await db.query(
        `
        SELECT id, name, description, created_at
        FROM collections
        WHERE created_by = $1
        ORDER BY created_at DESC
        `,
        [userId]
      );
  
      res.json(result.rows); // send back an array of collections
    } catch (error) {
      console.error("Error fetching owned collections:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/:id", authenticateToken, async (req, res) => {
    const collectionId = req.params.id;
  
    try {
      // 1) Fetch the collection details
      // Example table schema: collection (id, name, description, created_by, created_at, etc.)
      const collectionQuery = `
        SELECT id, name, description
        FROM collections
        WHERE id = $1
      `;
      const collectionResult = await db.query(collectionQuery, [collectionId]);
  
      if (collectionResult.rows.length === 0) {
        return res.status(404).json({ message: "collection not found" });
      }
  
      const collection = collectionResult.rows[0];
  
      // 2) Fetch the number of contributions (optional)
      // Example table schema: contributions (id, collection_id, user_id, file_url, contributed_at, etc.)
      const countQuery = `
        SELECT COUNT(*) AS contribution_count
        FROM contributions
        WHERE collection_id = $1
      `;
      const countResult = await db.query(countQuery, [collectionId]);
      const contributionCount = parseInt(countResult.rows[0].contribution_count, 10);
  
      // Combine the data into one response
      const responseData = {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        contributionCount,
        // Add any other fields you need
      };
  
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching collection by ID:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  

// Create a collection
router.post("/", authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO collections (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Failed to create collection" });
  }
});
  
  // DELETE /collections/:id
  // Delete a collection if owned by the current user
  router.delete("/:id", authenticateToken, async (req, res) => {
    const collectionId = req.params.id;
    const userId = req.user.id;
  
    try {
      // Attempt to delete where both 'id' and 'created_by' match
      const deleteResult = await db.query(
        `
        DELETE FROM collections
        WHERE id = $1 AND created_by = $2
        RETURNING id
        `,
        [collectionId, userId]
      );
  
      if (deleteResult.rowCount === 0) {
        // Either collection doesn't exist or isn't owned by the user
        return res.status(404).json({ message: "collection not found or not owned by user" });
      }
  
      res.json({ message: "collection deleted successfully" });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  

module.exports = router;
