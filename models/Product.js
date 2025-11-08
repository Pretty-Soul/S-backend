// backend/models/Product.js 
const mongoose = require('mongoose');

const variationSchema = new mongoose.Schema({
    size: { type: String, required: true },  // e.g., "250g", "1 Piece"
    price: { type: Number, required: true },
    // This 'stock' field is your LIVE STOCK count
    stock: { type: Number, required: true, default: 0, min: 0 } 
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    images: [{ type: String }],
    variations: [variationSchema] 
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);