// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

import shopRoutes from "./routes/shopRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// --- ✅ CORS setup ---
const allowedOrigins = [
  "https://s-frontend-nzij.onrender.com",
  "https://susegad-admin.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Blocked CORS request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// --- ✅ MongoDB Connection ---
const mongoURL = process.env.MONGO_URI;
const client = new MongoClient(mongoURL);

let db;

// --- Helpers for serving static files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "susegad_db");
    console.log("✅ Connected to MongoDB");

    // --- ✅ Mount Routes ---
    app.use("/shop", shopRoutes(db));
    app.use("/admin", adminRoutes(db));

    // --- ✅ Serve frontend if bundled ---
    const frontendPath = path.join(__dirname, "client", "dist");
    app.use(express.static(frontendPath));

    app.get("/", (req, res) => {
      res.send("🟢 Susegad Supplies API is running!");
    });

    // ✅ FIXED fallback route (Express 5+ safe)
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(frontendPath, "index.html"));
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
