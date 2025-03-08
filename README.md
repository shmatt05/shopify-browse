# Shopify Product Browser

A lightweight, client-side web application that allows you to browse products from any Shopify store. Deployed with Firebase Hosting on the free plan.

## Features

- Simple, intuitive user interface
- Fetch all products from any Shopify store
- View products in a sortable and filterable table
- Column-specific filtering
- Pagination to handle large product lists
- Expandable variants with direct checkout links
- JSON view option for each product
- See product details like title, vendor, type, price, and creation date
- Open product pages directly from the app

## Live Demo

Visit the live application at: https://shopify-browse.firebaseapp.com

## How It Works

This application makes direct requests to the Shopify product API using JSONP (JSON with Padding), a technique that allows cross-origin requests without CORS restrictions. All product data is fetched and processed client-side, eliminating the need for backend servers.

## Performance Optimizations

The application includes several performance optimizations:
- Cached DOM references
- Efficient event delegation
- DocumentFragment for DOM operations
- Memoized formatting functions
- Optimized CSS loading with preconnect
- Minimal dependencies

## Firebase Deployment Instructions (Free Plan)

### Prerequisites

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Log in to Firebase:
```bash
firebase login
```

### Deployment Steps

1. Deploy to Firebase Hosting:
```bash
firebase deploy --only hosting
```

That's it! Your application will be deployed and accessible online.

### Local Development

To test the application locally before deployment:

1. First, install dependencies:
```bash
npm install
```

2. Then start the development server:
```bash
npm run dev
```

This will start a local server at http://localhost:3000 hosting your application.

## Project Structure

- `/public` - Contains all the frontend code (HTML, CSS, JavaScript)

## Using the Application

1. Enter the name of a Shopify store (the part before `.myshopify.com`) in the input field
2. Click "Fetch Products" to retrieve all products from the store
3. Use the column filters to search for specific products
4. Click on table headers to sort by that column
5. Use the dropdown to sort by different criteria
6. Click the "Show Variants" button to see all variants of a product
7. Click the various action buttons to:
   - View the product on the Shopify store
   - View the product's JSON data
   - Add a specific variant to cart

## Notes

- The application uses JSONP to make direct requests to the Shopify API without CORS restrictions
- Works with any public Shopify store without additional setup
- The app will fetch ALL products from any store, with virtually no limits
- No proxy servers or server-side code required

This application uses the public Shopify API to fetch products. It has the following limitations:

- Only publicly accessible products will be retrieved
- Some stores may have API rate limits or restrictions
- The app will only fetch a maximum of 250 products per page (Shopify API limit), though it will paginate through all available products

## License

MIT