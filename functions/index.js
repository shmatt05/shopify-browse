const functions = require('firebase-functions');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

// Configure CORS - Use wildcard for all origins to be safe
const corsOptions = {
  origin: '*',  // Allow all origins for now to debug
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,  // Must be false with wildcard origin
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 3600  // Cache preflight for 1 hour
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

// API endpoint to fetch products - Remove extra /api/ from path
app.post('/products', async (req, res) => {
    try {
        console.log('Received request to /api/products:', JSON.stringify(req.body));
        
        const { storeName } = req.body;
        
        if (!storeName) {
            console.log('Missing store name in request');
            return res.status(400).json({ error: 'Store name is required' });
        }
        
        console.log(`Processing request for store: ${storeName}`);
        
        // Validate store name format
        if (!/^[a-zA-Z0-9-]+$/.test(storeName)) {
            console.log(`Invalid store name format: ${storeName}`);
            return res.status(400).json({ error: 'Invalid store name format. Only letters, numbers, and hyphens are allowed.' });
        }
        
        try {
            const products = await fetchAllProducts(storeName);
            console.log(`Successfully fetched ${products.length} products for ${storeName}`);
            res.json({ products });
        } catch (fetchError) {
            console.error(`Failed to fetch products for ${storeName}:`, fetchError);
            
            // Check if it's a 404 error (store doesn't exist)
            if (fetchError.message.includes('status: 404')) {
                return res.status(404).json({ 
                    error: `Store '${storeName}' not found or has no public products available.` 
                });
            }
            
            // General error
            res.status(500).json({ 
                error: `Failed to fetch products from Shopify: ${fetchError.message}` 
            });
        }
    } catch (error) {
        console.error('Unexpected error in API endpoint:', error);
        res.status(500).json({ error: `Unexpected error: ${error.message}` });
    }
});

// Function to fetch all products from a Shopify store
const fetchAllProducts = async (storeName) => {
    let allProducts = [];
    let page = 1;
    const limit = 250;  // Maximum allowed by Shopify
    
    try {
        console.log(`Starting to fetch products for store: ${storeName}`);
        
        // Set a maximum of 10 pages to avoid timeouts (you can adjust as needed)
        const MAX_PAGES = 10000;
        
        while (page <= MAX_PAGES) {
            const url = `https://${storeName}.myshopify.com/products.json?limit=${limit}&page=${page}`;
            console.log(`Fetching URL: ${url}`);

            try {
                const response = await fetch(url, {
                    timeout: 30000, // 30 second timeout
                    headers: {
                        'User-Agent': 'Shopify-Product-Browser',
                        'Accept': 'application/json'
                    }
                });
                
                // Log the response status
                console.log(`Response status: ${response.status} for page ${page}`);
                
                if (!response.ok) {
                    // Try to get the error message from the response
                    let errorMsg;
                    try {
                        const errorData = await response.text();
                        errorMsg = errorData;
                    } catch (textError) {
                        errorMsg = "Couldn't parse error response";
                    }
                    
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorMsg}`);
                }

                const data = await response.json();
                console.log(`Fetched page ${page}. Products on this page: ${data.products.length}`);

                // Make sure products exist and is an array
                if (!data.products || !Array.isArray(data.products)) {
                    console.error(`Invalid data format on page ${page}:`, JSON.stringify(data).substring(0, 500));
                    throw new Error(`Invalid data format from Shopify API for store: ${storeName}`);
                }

                allProducts = allProducts.concat(data.products);

                if (data.products.length < limit) {
                    // If we get fewer than 250 products, we've reached the last page
                    break;
                }

                page++;
            } catch (fetchError) {
                console.error(`Error fetching page ${page}:`, fetchError);
                // Rethrow with more context
                throw new Error(`Error fetching from Shopify for store ${storeName} on page ${page}: ${fetchError.message}`);
            }
        }

        console.log(`Finished fetching all products. Total pages: ${page}, Total products: ${allProducts.length}`);
        return allProducts;
    } catch (error) {
        console.error('Error in fetchAllProducts:', error);
        throw error; // Rethrow for the API handler to catch
    }
};

// Export the Express API as a Cloud Function with increased timeout
exports.api = functions
  .runWith({
    // Increase timeout to 5 minutes (maximum allowed)
    timeoutSeconds: 300,
    // Increase memory allocation if needed 
    memory: '1GB'
  })
  .https.onRequest(app);