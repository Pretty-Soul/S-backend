const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
// We no longer need crypto or emailSender

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            if (!password || password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long." });
            }
            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { 
                return res.status(409).json({ message: "Email already exists." }); 
            }
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await db.collection('users').insertOne({ 
                name, email, password: hashedPassword, addresses: [], isEmailVerified: true 
            });
            res.status(201).json({ message: "User created successfully! Please log in." });
        } catch (err) {
            console.error("Error in /signup:", err);
            res.status(500).json({ message: "Error creating user." });
        }
    });

    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });
            if (!user) { return res.status(401).json({ message: "Invalid credentials." }); }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid credentials." }); }
            res.status(200).json({ message: "Login successful!", user: { name: user.name, email: user.email } });
        } catch (err) {
            console.error("Error in /login:", err);
            res.status(500).json({ message: "Error logging in." });
        }
    });

    router.post('/admin/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });
            if (!user || user.role !== 'admin') { // Added role check
                return res.status(401).json({ message: "Invalid admin credentials." }); 
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid admin credentials." }); }
            res.status(200).json({ message: "Admin login successful!", user: { name: user.name, email: user.email, role: 'admin' } });
        } catch (err) {
            console.error("Error in /admin/login:", err);
            res.status(500).json({ message: "Error logging in as admin." });
        }
    });


    // --- USER PROFILE & ADDRESS ROUTES ---
    router.get('/user/addresses/:email', async (req, res) => {
        try {
            const user = await db.collection('users').findOne({ email: req.params.email });
            res.status(200).json(user?.addresses || []);
        } catch (err) {
            console.error("Error in /user/addresses/:email:", err);
            res.status(500).json({ message: "Error fetching addresses." });
        }
    });

    router.post('/user/addresses', async (req, res) => {
        try {
            const { userEmail, newAddress } = req.body;
            const user = await db.collection('users').findOne({ email: userEmail });
            if (!user) { return res.status(404).json({ message: "User not found." }); }
            const addressExists = user.addresses?.some(
                savedAddr =>
                    savedAddr.fullName?.toLowerCase() === newAddress.fullName?.toLowerCase() &&
                    savedAddr.address?.toLowerCase() === newAddress.address?.toLowerCase() &&
                    savedAddr.city?.toLowerCase() === newAddress.city?.toLowerCase() &&
                    savedAddr.pincode === newAddress.pincode
            );
            if (addressExists) { return res.status(200).json({ message: "Address already exists." }); }
            const addressWithId = { ...newAddress, _id: new ObjectId() };
            await db.collection('users').updateOne({ email: userEmail }, { $push: { addresses: addressWithId } });
            res.status(200).json({ message: "Address saved successfully." });
        } catch (err) {
            console.error("Error saving address:", err);
            res.status(500).json({ message: "Error saving address." });
        }
    });

    router.put('/user/addresses/:addressId', async (req, res) => {
        try {
            const { userEmail, address } = req.body;
            const { addressId } = req.params;
            await db.collection('users').updateOne(
                { email: userEmail, "addresses._id": new ObjectId(addressId) },
                { $set: { "addresses.$": { ...address, _id: new ObjectId(addressId) } } }
            );
            res.status(200).json({ message: "Address updated successfully." });
        } catch (err) {
            console.error("Error updating address:", err);
            res.status(500).json({ message: "Error updating address." });
        }
    });

    router.delete('/user/addresses/:addressId', async (req, res) => {
        try {
            const { userEmail } = req.body;
            const { addressId } = req.params;
            await db.collection('users').updateOne(
                { email: userEmail },
                { $pull: { addresses: { _id: new ObjectId(addressId) } } }
            );
            res.status(200).json({ message: "Address deleted successfully." });
        } catch (err) {
            console.error("Error deleting address:", err);
            res.status(500).json({ message: "Error deleting address." });
        }
    });

    router.get('/user/profile/:email', async (req, res) => {
        try {
            const user = await db.collection('users').findOne(
                { email: req.params.email },
                { projection: { password: 0 } }
            );
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: "User not found." });
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            res.status(500).json({ message: "Error fetching user profile." });
        }
    });

    router.put('/user/profile', async (req, res) => {
        try {
            const { userEmail, newName } = req.body;
            await db.collection('users').updateOne(
                { email: userEmail },
                { $set: { name: newName } }
            );
            res.status(200).json({ message: "Profile updated successfully." });
        } catch (err) {
            console.error("Error updating profile:", err);
            res.status(500).json({ message: "Error updating profile." });
        }
    });

    // --- PRODUCT ROUTES ---
    router.get('/products', async (req, res) => {
        console.log("Received request for GET /products");
        try {
            const products = await db.collection('products').find({}).sort({ name: 1 }).toArray();
            res.status(200).json(products);
        } catch (err) {
            console.error("Error fetching products:", err);
            res.status(500).json({ message: "Error fetching products." });
        }
    });

    router.get('/products/suggestions', async (req, res) => {
        console.log("Received request for GET /products/suggestions");
        try {
            const query = req.query.q;
            if (!query) { return res.json([]); }
            const suggestions = await db.collection('products')
                .find({ name: { $regex: query, $options: 'i' } })
                .project({ name: 1, _id: 0 })
                .limit(5)
                .toArray();
            res.status(200).json(suggestions);
        } catch (err) {
            console.error("Error in /products/suggestions:", err);
            res.status(500).json({ message: "Error fetching suggestions." });
        }
    });

    router.get('/products/:id', async (req, res) => {
        console.log(`Received request for GET /products/${req.params.id}`);
        try {
            const productId = req.params.id;
            if (!ObjectId.isValid(productId)) {
                 return res.status(400).json({ message: "Invalid product ID format." });
            }
            const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
            if (!product) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(product);
        } catch (err) {
            console.error("Error in /products/:id route:", err);
            res.status(500).json({ message: "Error fetching single product." });
        }
    });

    // --- CATEGORY ROUTES ---
    router.get('/categories', async (req, res) => {
        console.log("Received request for GET /categories");
        try {
            const categories = await db.collection('categories').find({}).toArray();
            res.status(200).json(categories);
        } catch (err) {
            console.error("Error fetching categories:", err);
            res.status(500).json({ message: "Error fetching categories." });
        }
    });

    // --- TESTIMONIALS ROUTE ---
    router.get('/testimonials', async (req, res) => {
        console.log("Received request for GET /testimonials");
        try {
            const testimonials = await db.collection('testimonials').find({}).limit(3).toArray();
            res.status(200).json(testimonials);
        } catch (err) {
            console.error("Error fetching testimonials:", err);
            res.status(500).json({ message: "Error fetching testimonials." });
        }
    });

    // --- CART & ORDER ROUTES ---
    router.get('/cart/:email', async (req, res) => {
        console.log(`Received request for GET /cart/${req.params.email}`);
        try {
            const userEmail = req.params.email;
            let cart = await db.collection('carts').findOne({ userEmail: userEmail });
            if (!cart) { cart = { userEmail: userEmail, items: [] }; }
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/:email:", err);
            res.status(500).json({ message: "Error fetching cart." });
        }
    });

    router.post('/cart/update', async (req, res) => {
        console.log("Received request for POST /cart/update");
        try {
            // NOTE: This route should ideally be updated to handle product ID and size/variation ID
            // For now, assuming front-end cart items have enough info to update the cart collection.
            const { userEmail, productId, quantity, productName, price } = req.body;
            let cart = await db.collection('carts').findOne({ userEmail });
            if (!cart) { cart = { userEmail, items: [] }; }
            const itemIndex = cart.items.findIndex(item => item.productId === productId);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity;
                if (cart.items[itemIndex].quantity <= 0) {
                    cart.items.splice(itemIndex, 1);
                }
            } else if (quantity > 0) {
                // NOTE: The productId here is typically a composite ID in the frontend (e.g., productID-size)
                cart.items.push({ productId, name: productName, price, quantity });
            }
            await db.collection('carts').updateOne({ userEmail }, { $set: { items: cart.items } }, { upsert: true });
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/update:", err);
            res.status(500).json({ message: "Error updating cart." });
        }
    });

    // --- 🚀 MODIFIED CHECKOUT ROUTE WITH LIVE STOCK REDUCTION 🚀 ---
    router.post('/checkout', async (req, res) => {
        console.log("Received request for POST /checkout");
        const session = db.client.startSession(); // Start a MongoDB session for transaction-like safety
        let order; // Define order outside try/catch for potential use in rollback/response

        try {
            await session.startTransaction(); // Start transaction

            const { userEmail, shippingAddress, shippingMethod, totalAmount } = req.body; 
            
            const cart = await db.collection('carts').findOne({ userEmail }, { session });
            if (!cart || cart.items.length === 0) { 
                await session.abortTransaction();
                return res.status(400).json({ message: "Cart is empty." }); 
            }
            
            // --- 1. Stock Validation and Reduction Loop ---
            for (const item of cart.items) {
                // The frontend uses a composite ID (e.g., productID-size) for cart items.
                // We split it to get the main product ID.
                const [realProductIdString, size] = item.productId.split('-'); 

                if (!ObjectId.isValid(realProductIdString)) { 
                    await session.abortTransaction();
                    return res.status(400).json({ message: `Invalid product ID format in cart.` }); 
                }
                const realProductId = new ObjectId(realProductIdString);

                // CRITICAL STEP: Atomically decrement stock
                const result = await db.collection('products').updateOne(
                    {
                        "_id": realProductId,
                        "variations": {
                            $elemMatch: {
                                "size": size,
                                "stock": { $gte: item.quantity } // Ensure sufficient stock
                            }
                        }
                    },
                    {
                        // $inc reduces the stock of the matched element within the array
                        "$inc": { "variations.$.stock": -item.quantity }
                    },
                    { session } // Apply to the session
                );

                // Check if the update succeeded (matched count = 1, modified count = 1)
                if (result.matchedCount === 0 || result.modifiedCount === 0) {
                    await session.abortTransaction();
                    return res.status(409).json({ message: `Out of stock for ${item.name} (${size}) or item not found.` });
                }
            }
            
            // --- 2. Create the Order ---
            order = { 
                userEmail, 
                items: cart.items, 
                totalAmount: totalAmount, 
                shippingAddress, 
                shippingMethod, 
                status: 'Pending', // New status field
                orderDate: new Date() 
            };
            
            const insertResult = await db.collection('orders').insertOne(order, { session });
            
            // --- 3. Clear the Cart ---
            await db.collection('carts').deleteOne({ userEmail }, { session });
            
            await session.commitTransaction(); // Commit all changes if successful

            const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId });
            res.status(200).json({ message: "Order placed successfully! Stock updated.", order: newOrder });

        } catch (err) {
            console.error("Error in /checkout (rolling back):", err);
            // Attempt to abort transaction in case of any error
            try {
                await session.abortTransaction();
            } catch (abortErr) {
                console.error("Error during transaction abort:", abortErr);
            }
            res.status(500).json({ message: "Error during checkout. Transaction rolled back." });
        } finally {
            await session.endSession(); // End the session
        }
    });
    // --- ⬆️ END OF MODIFIED CHECKOUT ROUTE ⬆️ ---

    router.get('/orders/:email', async (req, res) => {
        console.log(`Received request for GET /orders/${req.params.email}`);
        try {
            const userEmail = req.params.email;
            const orders = await db.collection('orders').find({ userEmail: userEmail }).sort({ orderDate: -1 }).toArray();
            res.status(200).json(orders);
        } catch (err) {
            console.error("Error in /orders/:email:", err);
            res.status(500).json({ message: "Error fetching order history." });
        }
    });
    
    // --- SEARCH ROUTE ---
    router.get('/search', async (req, res) => {
        console.log(`Received request for GET /search?q=${req.query.q}`);
        try {
            const query = req.query.q;
            if (!query) { return res.status(400).json({ message: "Search query is required." }); }
            const searchResults = await db.collection('products').find({
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            }).toArray();
            res.status(200).json(searchResults);
        } catch (err) {
            console.error("Error during search:", err);
            res.status(500).json({ message: "Error searching products." });
        }
    });

    // --- ADMIN ROUTES ---
     router.post('/products', async (req, res) => {
         console.log("Received request for ADMIN POST /products");
        try {
            const newProduct = req.body;
            if (!newProduct.name || !newProduct.variations || !newProduct.images) { return res.status(400).json({ message: "Missing required product fields." }); }
            const result = await db.collection('products').insertOne(newProduct);
            res.status(201).json(result);
        } catch (err) {
             console.error("Error adding product (admin):", err);
             res.status(500).json({ message: "Error adding product." });
        }
    });

    router.put('/products/:id', async (req, res) => {
         console.log(`Received request for ADMIN PUT /products/${req.params.id}`);
        try {
            const productId = req.params.id;
             if (!ObjectId.isValid(productId)) { return res.status(400).json({ message: "Invalid product ID format." }); }
            const updatedData = req.body;
            delete updatedData._id;
            const result = await db.collection('products').updateOne({ _id: new ObjectId(productId) }, { $set: updatedData });
             if (result.matchedCount === 0) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(result);
        } catch (err) {
             console.error("Error updating product (admin):", err);
             res.status(500).json({ message: "Error updating product." });
        }
    });

    router.delete('/products/:id', async (req, res) => {
         console.log(`Received request for ADMIN DELETE /products/${req.params.id}`);
        try {
            const productId = req.params.id;
             if (!ObjectId.isValid(productId)) { return res.status(400).json({ message: "Invalid product ID format." }); }
            const result = await db.collection('products').deleteOne({ _id: new ObjectId(productId) });
             if (result.deletedCount === 0) { return res.status(404).json({ message: "Product not found" }); }
            res.status(200).json(result);
        } catch (err) {
             console.error("Error deleting product (admin):", err);
             res.status(500).json({ message: "Error deleting product." });
        }
    });
    
    // --- ADMIN CATEGORY ROUTES ---
     router.post('/categories', async (req, res) => {
         console.log("Received request for ADMIN POST /categories");
         try {
             const { name } = req.body;
             if (!name) return res.status(400).json({ message: "Category name required." });
             const existing = await db.collection('categories').findOne({ name: name });
             if (existing) return res.status(409).json({ message: "Category already exists." });
             await db.collection('categories').insertOne({ name });
             res.status(201).json({ message: "Category added." });
         } catch (err) {
             console.error("Error adding category (admin):", err);
             res.status(500).json({ message: "Error adding category." });
         }
     });

     router.delete('/categories/:name', async (req, res) => {
         console.log(`Received request for ADMIN DELETE /categories/${req.params.name}`);
         try {
             const categoryName = decodeURIComponent(req.params.name);
             const result = await db.collection('categories').deleteOne({ name: categoryName });
             if (result.deletedCount === 0) return res.status(404).json({ message: "Category not found." });
             res.status(200).json({ message: "Category deleted." });
         } catch (err) {
             console.error("Error deleting category (admin):", err);
             res.status(500).json({ message: "Error deleting category." });
         }
     });

    // Return the configured router
    return router;
};