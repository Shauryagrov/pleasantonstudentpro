require('dotenv').config();
const axios = require('axios');

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;

const printifyAPI = axios.create({
    baseURL: 'https://api.printify.com/v1',
    headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// Get all products
async function getProducts() {
    try {
        const response = await printifyAPI.get(`/shops/${PRINTIFY_SHOP_ID}/products.json`);
        return response.data;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
}

// Get product details
async function getProductDetails(productId) {
    try {
        const response = await printifyAPI.get(`/shops/${PRINTIFY_SHOP_ID}/products/${productId}.json`);
        return response.data;
    } catch (error) {
        console.error('Error fetching product details:', error);
        throw error;
    }
}

// Create a new order
async function createOrder(orderData) {
    try {
        const response = await printifyAPI.post(`/shops/${PRINTIFY_SHOP_ID}/orders.json`, orderData);
        return response.data;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

module.exports = {
    getProducts,
    getProductDetails,
    createOrder
}; 