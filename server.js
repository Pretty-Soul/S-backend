const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
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