const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = function(db) {

    // --- AUTH ROUTES ---
    router.post('/signup', async (req, res) => {
        try {
            const { name, email, password } = req.body;
            const existingUser = await db.collection('users').findOne({ email: email });
            if (existingUser) { return res.status(409).json({ message: "Email already exists." }); }
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await db.collection('users').insertOne({ name, email, password: hashedPassword, addresses: [] });
            res.status(201).json({ message: "User created successfully!" });
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

    // --- USER PROFILE & ADDRESS ROUTES ---
    router.get('/user/addresses/:email', async (req, res) => {
        try {
            const user = await db.collection('users').findOne({ email: req.params.email });
            if (user && user.addresses) {
                res.status(200).json(user.addresses);
            } else {
                res.status(200).json([]);
            }
        } catch (err) {
            console.error("Error in /user/addresses/:email:", err);
            res.status(500).json({ message: "Error fetching addresses." });
        }
    });

    // --- UPDATED to prevent duplicate addresses ---
    router.post('/user/addresses', async (req, res) => {
        try {
            const { userEmail, newAddress } = req.body;
            const user = await db.collection('users').findOne({ email: userEmail });
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            const addressExists = user.addresses && user.addresses.some(
                savedAddr => 
                    savedAddr.fullName.toLowerCase() === newAddress.fullName.toLowerCase() &&
                    savedAddr.address.toLowerCase() === newAddress.address.toLowerCase() &&
                    savedAddr.city.toLowerCase() === newAddress.city.toLowerCase() &&
                    savedAddr.pincode === newAddress.pincode
            );

            if (addressExists) {
                return res.status(200).json({ message: "Address already exists." });
            }

            const addressWithId = { ...newAddress, _id: new ObjectId() };
            await db.collection('users').updateOne(
                { email: userEmail },
                { $push: { addresses: addressWithId } }
            );
            
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


    // --- PRODUCT, CART & ORDER ROUTES ---
    router.get('/cart/:email', async (req, res) => {
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
        try {
            const { userEmail, productId, quantity, productName, price } = req.body;
            let cart = await db.collection('carts').findOne({ userEmail });

            if (!cart) {
                cart = { userEmail, items: [] };
            }

            const itemIndex = cart.items.findIndex(item => item.productId === productId);

            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity;
                if (cart.items[itemIndex].quantity <= 0) {
                    cart.items.splice(itemIndex, 1);
                }
            } else if (quantity > 0) {
                cart.items.push({ productId, name: productName, price, quantity });
            }

            await db.collection('carts').updateOne(
                { userEmail },
                { $set: { items: cart.items } },
                { upsert: true }
            );
            res.status(200).json(cart);
        } catch (err) {
            console.error("Error in /cart/update:", err);
            res.status(500).json({ message: "Error updating cart." });
        }
    });

router.post('/checkout', async (req, res) => {
    try {
        const { userEmail, shippingAddress, shippingMethod } = req.body;
        const cart = await db.collection('carts').findOne({ userEmail });
        if (!cart || cart.items.length === 0) { 
            return res.status(400).json({ message: "Cart is empty." }); 
        }
        
        for (const item of cart.items) {
            const realProductId = item.productId.split('-')[0];
            const product = await db.collection('products').findOne({ _id: new ObjectId(realProductId) });
            if (!product) { 
                return res.status(400).json({ message: `Product not found for ${item.name}.` }); 
            }
        }
        
        const totalAmount = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const order = { userEmail, items: cart.items, totalAmount, shippingAddress, shippingMethod, orderDate: new Date() };
        const insertResult = await db.collection('orders').insertOne(order);
        await db.collection('carts').deleteOne({ userEmail });
        
        const newOrder = await db.collection('orders').findOne({ _id: insertResult.insertedId });
        res.status(200).json({ message: "Order placed successfully!", order: newOrder });

    }  catch (err) { 
    // THIS BLOCK IS DESIGNED TO SEND THE ERROR TO THE BROWSER
    console.error("Error in /checkout:", err); 
    res.status(500).json({ 
        message: "Server crashed during checkout.", 
        error: err.toString(), 
        stack: err.stack
    }); 
}
});

    router.get('/orders/:email', async (req, res) => {
        try {
            const userEmail = req.params.email;
            const orders = await db.collection('orders').find({ userEmail: userEmail }).sort({ orderDate: -1 }).toArray();
            res.status(200).json(orders);
        } catch (err) { 
            console.error("Error in /orders/:email:", err);
            res.status(500).json({ message: "Error fetching order history." }); 
        }
    });

    return router;
};