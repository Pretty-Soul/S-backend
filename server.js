require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

const netlifyUrl = 'https://susegad-supplies.netlify.app/'; // Use your actual URL

app.use(cors({ origin: netlifyUrl }));
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Import the function that *creates* the router
const initializeApiRoutes = require('./routes/shopRoutes'); 

async function startServer() {
    try {
        await client.connect();
        const database = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // Initialize the routes by passing the database connection
        const apiRouter = initializeApiRoutes(database); 
        
        console.log("Attempting to register API routes...");
        app.use('/', apiRouter); // Use the router returned by the function
        console.log("✅ API routes should be registered now.");

        // Keep the health check route
        app.get('/health', (req, res) => { // Changed path slightly just in case '/' conflicts
            res.status(200).send('Backend server is running!');
        });

        app.listen(port, () => {
            console.log(`🚀 Server running locally on http://localhost:${port}`); 
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();