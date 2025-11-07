require('dotenv').config();
const express = require('express'); // <-- This was the main error fix
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// --- CONNECT TO FRONTEND ---
// Set this to your live frontend URL on Render (or Netlify)
const frontendUrl = 'https://susegad-supplies-frontend.onrender.com';

app.use(cors({ origin: frontendUrl }));
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
        app.use('/', apiRouter);
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