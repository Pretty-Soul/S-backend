require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// --- CONNECT TO FRONTEND (UPDATED) ---
// This list now allows both your websites to connect
const allowedOrigins = [
    'https://susegad-supplies-frontend.onrender.com', // Your main customer site
    'https://susegad-admin.onrender.com/',     // ⬇️ *** REPLACE THIS with your new admin URL *** ⬇️
    'http://localhost:5500',                         // For local testing
    'http://127.0.0.1:5500'                          // For local testing
];

app.use(cors({ 
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin) return callback(null, true);

        // Check if the incoming origin is in our allowed list
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));
app.use(express.json());
// --- END ---

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set.");
    process.exit(1); 
}
const client = new MongoClient(uri);

// Import your routes
const initializeApiRoutes = require('./routes/shopRoutes'); 

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // Initialize and use your single routes file
        const apiRouter = initializeApiRoutes(database);
        app.use('/', apiRouter); // All routes will be at the root (e.g., /login, /products)
        console.log("✅ API routes registered.");

        app.listen(port, () => {
            console.log(`🚀 Server listening on port ${port}`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();