const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

// Export a function that accepts the database connection
module.exports = function(db) {

    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;

            // --- Password Constraint Check ---
            if (!password || password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long." });
            }

            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { 
                return res.status(409).json({ message: "Email already exists." }); 
            }
            
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            // Save the user (set as verified by default and role to customer)
            await db.collection('users').insertOne({ 
                name, 
                email, 
                password: hashedPassword, 
                addresses: [],
                isEmailVerified: true, // Set to true by default
                role: 'customer' // Default role for new signups
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
            
            // Return only non-sensitive data
            res.status(200).json({ message: "Login successful!", user: { name: user.name, email: user.email } });
        } catch (err) {
            console.error("Error in /login:", err);
            res.status(500).json({ message: "Error logging in." });
        }
    });

    // --- ADMIN LOGIN (SECURITY FIX) ---
    router.post('/admin/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await db.collection('users').findOne({ email: email });

            // 1. Check if user exists
            if (!user) { return res.status(401).json({ message: "Invalid admin credentials." }); }

            // 2. Check password
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) { return res.status(401).json({ message: "Invalid admin credentials." }); }
            
            // 3. *** CRITICAL FIX *** Check if user is actually an admin
            if (user.role !== 'admin') {
                return res.status(403).json({ message: "Access Denied. Not an admin." });
            }
            
            // 4. Success - send admin user data
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

    // --- PRODUCT ROUTES (Public) ---
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

    // --- CATEGORY ROUTES (Public) ---
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
    router.get('/cart/:email', async (req, res) => { /* ... (code as provided) ... */ });
    router.post('/cart/update', async (req, res) => { /* ... (code as provided) ... */ });
    router.post('/checkout', async (req, res) => { /* ... (code as provided) ... */ });
    router.get('/orders/:email', async (req, res) => { /* ... (code as provided) ... */ });
    
    // --- SEARCH ROUTE ---
    router.get('/search', async (req, res) => { /* ... (code as provided) ... */ });

    //
    // --- ⬇️ ADMIN ROUTES (IMPLEMENTED) ⬇️ ---
    //

    // ADD A NEW PRODUCT (Matches handleAddProduct in admin.js)
    router.post('/products', async (req, res) => {
        try {
            const newProduct = req.body;
            // You could add validation here to check product structure
            const result = await db.collection('products').insertOne(newProduct);
            res.status(201).json({ message: "Product added successfully", insertedId: result.insertedId });
        } catch (err) {
            console.error("Error in ADMIN POST /products:", err);
            res.status(500).json({ message: "Error adding product." });
        }
    });

    // UPDATE A PRODUCT (Matches handleTableClick 'btn-save-price' in admin.js)
    router.put('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid product ID format." });
            }
            const updateData = req.body; 
            
            // $set will update only the fields provided (e.g., 'variations')
            const result = await db.collection('products').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData } 
            );
            
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Product not found." });
            }
            res.status(200).json({ message: "Product updated successfully." });
        } catch (err) {
            console.error("Error in ADMIN PUT /products/:id:", err);
            res.status(500).json({ message: "Error updating product." });
        }
    });

    // DELETE A PRODUCT (Matches handleTableClick 'delete-btn' in admin.js)
    router.delete('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid product ID format." });
            }
            
            const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Product not found." });
            }
            res.status(200).json({ message: "Product deleted successfully." });
        } catch (err) {
            console.error("Error in ADMIN DELETE /products/:id:", err);
            res.status(500).json({ message: "Error deleting product." });
        }
    });

    // ADD A NEW CATEGORY (Matches handleAddCategory in admin.js)
    router.post('/categories', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ message: "Category name is required." });
            }
            
            const existingCategory = await db.collection('categories').findOne({ name: name });
            if (existingCategory) {
                return res.status(409).json({ message: "Category already exists." });
            }
            
            await db.collection('categories').insertOne({ name: name });
            res.status(201).json({ message: "Category added successfully." });
        } catch (err) {
            console.error("Error in ADMIN POST /categories:", err);
            res.status(500).json({ message: "Error adding category." });
        }
    });

    // DELETE A CATEGORY (Matches handleCategoryListClick in admin.js)
    router.delete('/categories/:name', async (req, res) => {
        try {
            // Decode the URL-encoded category name
            const categoryName = decodeURIComponent(req.params.name);
            
            const result = await db.collection('categories').deleteOne({ name: categoryName });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Category not found." });
            }
            res.status(200).json({ message: "Category deleted successfully." });
        } catch (err) {
            console.error("Error in ADMIN DELETE /categories/:name:", err);
            res.status(500).json({ message: "Error deleting category." });
        }
    });
     
    // --- ⬆️ ADMIN ROUTES (IMPLEMENTED) ⬆️ ---

    // Return the configured router
    return router;
};