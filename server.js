require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// IMPORTANT: Replace this with your actual Netlify URL if it changed
const netlifyUrl = 'https://susegad-supplies.netlify.app';

app.use(cors({ origin: netlifyUrl }));
app.use(express.json());

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error("FATAL ERROR: MONGO_URI environment variable is not set.");
    process.exit(1); // Exit if the connection string is missing
}
const client = new MongoClient(uri);

// Import the function that *creates* the router
const initializeApiRoutes = require('./routes/shopRoutes');

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // Initialize the routes by calling the function and passing the database
        const apiRouter = initializeApiRoutes(database);
        console.log("Router initialization function called.");

        console.log("Attempting to register API routes...");
        app.use('/', apiRouter); // Use the router returned by the function
        console.log("✅ API routes should be registered now.");

        // Health check route (optional, but good for testing)
        app.get('/health', (req, res) => {
            console.log("!!! Reached /health route !!!");
            res.status(200).send('Backend server is running!');
        });

        app.listen(port, () => {
            // Updated log message for clarity
            console.log(`🚀 Server listening on port ${port} (locally it would be http://localhost:${port})`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();