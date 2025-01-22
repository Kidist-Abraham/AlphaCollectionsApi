const { Pool } = require("pg");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log any pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => {
    console.log("Executing query:", text, "with params:", params || []);
    return pool.query(text, params);
  },
};
