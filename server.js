require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// IMPORTANT: Replace this with your actual Netlify URL
const netlifyUrl = 'https://68e665f10a949a000819c14c--susegad-supplies.netlify.app';

app.use(cors({ origin: netlifyUrl }));
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Import the router and the setDb function from your routes file
// Ensure the path './routes/shopRoutes' is correct relative to server.js
const { router: apiRoutes, setDb } = require('./routes/shopRoutes'); 

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        
        // "Inject" the database connection into your routes file
        setDb(database);
        
        console.log("✅ Successfully connected to MongoDB!");

        console.log("Attempting to register API routes...");
        // Explicitly use the root path '/' for all routes defined in shopRoutes
        app.use('/', apiRoutes); // <--- THIS IS THE UPDATED LINE
        console.log("✅ API routes should be registered now.");


        app.listen(port, () => {
            // This log is primarily for local development, Render uses its own mechanisms
            console.log(`🚀 Server running locally on http://localhost:${port}`); 
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();