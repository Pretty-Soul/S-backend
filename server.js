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
        // ... (database connection, setDb, app.use('/', apiRouter)) ...

        console.log("✅ API routes should be registered now.");

        // --- ADD THESE TEST ROUTES ---
        app.get('/products', (req, res) => {
            console.log("!!! Reached /products route defined directly in server.js !!!");
            res.status(200).json([{ name: "Test Product", category: "Test" }]);
        });

        app.get('/categories', (req, res) => {
            console.log("!!! Reached /categories route defined directly in server.js !!!");
            res.status(200).json([{ name: "Test Category" }]);
        });
        // --- END OF ADDITIONS ---

        // Keep the health check route
        app.get('/health', (req, res) => { /* ... */ });

        app.listen(port, () => { /* ... */ });

    } catch (err) { /* ... */ }
}

startServer();