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
const { router: apiRoutes, setDb } = require('./routes/shopRoutes');

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        
        // "Inject" the database connection into your routes file
        setDb(database);
        
        console.log("✅ Successfully connected to MongoDB!");

        // Use the imported router for all API routes
        app.use(apiRoutes);

        app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();