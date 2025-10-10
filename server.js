require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors({ origin: 'https://your-netlify-url.netlify.app' })); // Make sure your Netlify URL is correct
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Import the router and the setDb function from your routes file
const { router: apiRoutes, setDb } = require('./routes/shopRoutes');

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        
        // "Inject" the database into your routes file
        setDb(database);
        
        console.log("✅ Successfully connected to MongoDB!");

        // Use the imported router
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