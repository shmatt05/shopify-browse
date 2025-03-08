const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API endpoint to fetch products
app.post('/api/products', async (req, res) => {
    try {
        const { storeName } = req.body;
        
        if (!storeName) {
            return res.status(400).json({ error: 'Store name is required' });
        }
        
        const products = await fetchAllProducts(storeName);
        res.json({ products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Function to fetch all products from a Shopify store
const fetchAllProducts = async (storeName) => {
    let allProducts = [];
    let page = 1;
    const limit = 250;  // Maximum allowed by Shopify

    while (true) {
        const url = `https://${storeName}.myshopify.com/products.json?limit=${limit}&page=${page}`;
        console.log(`Fetching URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Fetched page ${page}. Products on this page: ${data.products.length}`);

        allProducts = allProducts.concat(data.products);

        if (data.products.length < limit) {
            // If we get fewer than 250 products, we've reached the last page
            break;
        }

        page++;
    }

    console.log(`Finished fetching all products. Total pages: ${page}, Total products: ${allProducts.length}`);
    return allProducts;
};

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
