require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

// Replace your old app.use(cors()); with this more specific configuration

app.use(cors({
  origin: 'https://68e665f10a949a000819c14c--susegad-supplies.netlify.app/' // <-- Paste your Netlify URL here
}));
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        const db = client.db("susegad_supplies");
        console.log("✅ Successfully connected to MongoDB!");

        // Import and use the separate route files
        const authRoutes = require('./routes/authRoutes')(db);
        const productRoutes = require('./routes/productRoutes')(db);
        const categoryRoutes = require('./routes/categoryRoutes')(db);
        const shopRoutes = require('./routes/shopRoutes')(db, client);

        app.use(authRoutes);
        app.use(productRoutes);
        app.use(categoryRoutes);
        app.use(shopRoutes);

        app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
        });

    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

startServer();