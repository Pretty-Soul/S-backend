require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// --- CORS Configuration ---
const allowedOrigins = [
    'https://susegad-supplies-frontend.onrender.com',
    'https://susegad-admin.onrender.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];
app.use(cors({ 
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
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

// --- Import BOTH route files ---
const initializeApiRoutes = require('./routes/shopRoutes'); 
const initializeAdminRoutes = require('./routes/adminRoutes'); 

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // --- Initialize BOTH routers (Pass client to shopRoutes) ---
        // 1. We now pass 'client' to shopRoutes for transactions
        const apiRouter = initializeApiRoutes(database, client); 
        const adminRouter = initializeAdminRoutes(database); 

        // --- Use BOTH routers with prefixes ---
        app.use('/', apiRouter); // Public routes are at the root
        app.use('/admin', adminRouter); // Admin routes are at /admin
        
        console.log("✅ API routes registered.");
        console.log("✅ Admin routes registered at /admin");

        app.listen(port, () => {
            console.log(`🚀 Server listening on port ${port}`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();