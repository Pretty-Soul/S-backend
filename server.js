require('dotenv').config();
const express = 'express';
const { MongoClient } = 'mongodb';
const cors = 'cors';

const app = express();
const port = 3000;

// --- IMPORTANT ---
// Replace this with your new Render frontend URL
const frontendUrl = 'https://susegad-supplies-frontend.onrender.com';
// (For example: 'https://susegad-supplies-frontend.onrender.com')

// Setup CORS to only allow requests from your live frontend
app.use(cors({ origin: frontendUrl }));
app.use(express.json());

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set.");
    process.exit(1); 
}
const client = new MongoClient(uri);

// Import your routes
// Make sure this path is correct
const initializeApiRoutes = require('./routes/shopRoutes'); 

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // Initialize and use your routes
        const apiRouter = initializeApiRoutes(database);
        app.use('/', apiRouter);
        console.log("✅ API routes registered.");

        // Health check route
        app.get('/health', (req, res) => {
            res.status(200).send('Backend server is running!');
        });

        app.listen(port, () => {
            console.log(`🚀 Server listening on port ${port}`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();