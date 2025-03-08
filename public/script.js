document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    const elements = {
        storeNameInput: document.getElementById('store-name'),
        fetchButton: document.getElementById('fetch-button'),
        loader: document.getElementById('loader'),
        infoPanel: document.getElementById('info-panel'),
        productsTable: document.getElementById('products-table'),
        productsBody: document.getElementById('products-body'),
        tableScrollHint: document.getElementById('table-scroll-hint'),
        currentStoreSpan: document.getElementById('current-store'),
        countSpan: document.getElementById('count'),
        showingCountSpan: document.getElementById('showing-count'),
        columnFilters: document.querySelectorAll('.column-filter'),
        sortSelect: document.getElementById('sort-select'),
        errorMessage: document.getElementById('error-message'),
        errorText: document.getElementById('error-text'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageNumbersContainer: document.getElementById('page-numbers')
    };

    // Application state
    const state = {
        allProducts: [],
        filteredProducts: [],
        currentSortColumn: '',
        sortDirection: 'asc',
        expandedProducts: new Set(),
        productsPerPage: 20,
        currentPage: 1,
        totalPages: 1,
        filterState: {
            title: '',
            vendor: '',
            type: '',
            price: '',
            created: ''
        }
    };

    // Event listeners - use event delegation where possible
    elements.fetchButton.addEventListener('click', fetchProducts);
    elements.sortSelect.addEventListener('change', handleSortSelect);
    elements.storeNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchProducts();
    });

    // Add click listeners to table headers for sorting using event delegation
    document.querySelector('.products-table thead').addEventListener('click', (e) => {
        // Find closest th element (if any)
        const th = e.target.closest('th[data-sort]');
        
        // Skip if no th found or if clicking on filter input
        if (!th || e.target.tagName === 'INPUT') return;
        
        sortProducts(th.getAttribute('data-sort'));
    });

    // Add input listeners to column filters using event delegation
    document.querySelector('.products-table thead').addEventListener('input', (e) => {
        if (e.target.classList.contains('column-filter')) {
            const column = e.target.getAttribute('data-column');
            state.filterState[column] = e.target.value.toLowerCase();
            applyFilters();
        }
    });

    // Stop propagation for filter clicks to prevent sorting
    document.querySelector('.products-table thead').addEventListener('click', (e) => {
        if (e.target.classList.contains('column-filter')) {
            e.stopPropagation();
        }
    });

    // Pagination event listeners
    elements.prevPageButton.addEventListener('click', () => {
        if (state.currentPage > 1) {
            goToPage(state.currentPage - 1);
        }
    });
    
    elements.nextPageButton.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            goToPage(state.currentPage + 1);
        }
    });

    // Fetch products directly from Shopify using JSONP technique
    function fetchProducts() {
        const storeName = elements.storeNameInput.value.trim();
        
        if (!storeName) {
            showError('Please enter a store name');
            return;
        }

        // Reset UI state
        resetUI();
        showLoader(true);
        hideError();

        // Use an array to collect all products
        window.allProducts = [];
        let fetchPage = 1;
        const limit = 250; // Maximum allowed by Shopify API
        
        // Create a function to handle the JSONP response
        window.handleShopifyProducts = function(data) {
            // Check if we have products
            if (data && data.products && Array.isArray(data.products)) {
                // Add products to our collection
                window.allProducts = window.allProducts.concat(data.products);
                
                // Update loading status
                const loadingMessage = document.querySelector('#loader p');
                const productCount = window.allProducts.length.toLocaleString();
                
                // For large stores, show more informative progress
                if (fetchPage > 100) {
                    loadingMessage.innerHTML = `<strong>Large store detected!</strong><br>
                    Fetched page ${fetchPage}. Products so far: ${productCount}<br>
                    <small>(No limit - will continue until all products are loaded)</small>`;
                } else {
                    loadingMessage.textContent = `Fetched page ${fetchPage}. Products so far: ${productCount}`;
                }
                
                // If we got fewer products than the limit, we've reached the end
                if (data.products.length < limit) {
                    finishLoading();
                } else {
                    // Otherwise, fetch the next page
                    fetchPage++;
                    
                    // No arbitrary page limit - continue fetching all products
                    // Add a message for large stores to show progress
                    if (fetchPage % 100 === 0) {
                        console.log(`Fetched ${fetchPage} pages (${window.allProducts.length} products so far). Continuing...`);
                    }
                    
                    fetchNextPage();
                }
            } else {
                // Handle empty or invalid response
                if (window.allProducts.length === 0) {
                    showError(`Store "${storeName}" not found or has no public products.`);
                    showLoader(false);
                } else {
                    finishLoading();
                }
            }
        };
        
        // Function to handle errors
        window.handleShopifyError = function() {
            if (window.allProducts.length === 0) {
                showError(`Could not connect to store "${storeName}". Please check the store name and try again.`);
                showLoader(false);
            } else {
                // If we have some products and hit a timeout on a later page
                const productCount = window.allProducts.length.toLocaleString();
                
                if (fetchPage > 100) {
                    // For very large stores, could be a timeout but we have data
                    showLoader(false);
                    showError(`Loaded ${productCount} products from ${fetchPage-1} pages, but request timed out. The partial data is displayed.`);
                    // Still show the products we've gathered
                    finishLoading();
                } else {
                    // For smaller stores, just finish with what we have
                    finishLoading();
                    showLoader(false);
                }
            }
        };
        
        // Function to fetch the next page
        function fetchNextPage() {
            // Create a script element for JSONP
            const script = document.createElement('script');
            
            // Create the JSONP URL for this page
            script.src = `https://${storeName}.myshopify.com/products.json?limit=${limit}&page=${fetchPage}&callback=handleShopifyProducts`;
            
            // Set error handler
            script.onerror = window.handleShopifyError;
            
            // Set a timeout in case the request hangs
            // Use longer timeout for large stores (more products/pages take longer to process)
            const timeoutDuration = fetchPage > 100 ? 30000 : 15000; // 30 seconds for large stores, 15 for others
            const timeout = setTimeout(() => {
                if (script.parentNode) script.parentNode.removeChild(script);
                window.handleShopifyError();
            }, timeoutDuration);
            
            // Add script to document to start the request
            document.body.appendChild(script);
            
            // Remove the script after it's executed
            script.onload = function() {
                clearTimeout(timeout);
                document.body.removeChild(script);
            };
        }
        
        // Function to finish the loading process
        function finishLoading() {
            // Store the fetched products in our app's state
            state.allProducts = window.allProducts;
            state.filteredProducts = [...state.allProducts];
            
            // Update UI
            elements.currentStoreSpan.textContent = storeName;
            elements.countSpan.textContent = state.allProducts.length;
            
            // Reset pagination
            state.currentPage = 1;
            updatePagination();
            
            // Render first page
            renderProductsPage();
            showInfoPanel(true);
            showProductsTable(true);
            showLoader(false);
        }
        
        // Start fetching the first page
        fetchNextPage();
    }

    // Apply all filters and sorting
    function applyFilters() {
        // Start with all products
        state.filteredProducts = [...state.allProducts];
        
        // Apply column-specific filters
        for (const [column, value] of Object.entries(state.filterState)) {
            if (!value) continue;
            
            state.filteredProducts = state.filteredProducts.filter(product => {
                switch(column) {
                    case 'title':
                        return product.title && product.title.toLowerCase().includes(value);
                    case 'vendor':
                        return product.vendor && product.vendor.toLowerCase().includes(value);
                    case 'type':
                        return product.product_type && product.product_type.toLowerCase().includes(value);
                    case 'price':
                        const price = getLowestPrice(product);
                        return price.toString().includes(value);
                    case 'created':
                        return product.created_at && formatDate(product.created_at).toLowerCase().includes(value);
                    default:
                        return true;
                }
            });
        }
        
        // Update count
        elements.countSpan.textContent = state.allProducts.length;
        
        // Reset to first page when filtering
        state.currentPage = 1;
        updatePagination();
        
        // Apply current sort if any
        if (state.currentSortColumn) {
            sortProducts(state.currentSortColumn, state.sortDirection, false);
        } else {
            renderProductsPage();
        }
    }

    // Sort products by selected column
    function sortProducts(column, direction = null, toggleDirection = true) {
        // If clicking the same column, toggle direction
        if (column === state.currentSortColumn && toggleDirection) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else if (direction) {
            state.sortDirection = direction;
        } else {
            state.sortDirection = 'asc';
        }
        
        state.currentSortColumn = column;
        
        // Reset all sort icons
        document.querySelectorAll('.products-table th .th-title i').forEach(icon => {
            icon.className = 'fas fa-sort';
        });
        
        // Set the correct icon for the current sort column
        const th = document.querySelector(`.products-table th[data-sort="${column}"] .th-title i`);
        if (th) {
            th.className = state.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
        
        // Sort the products
        state.filteredProducts.sort((a, b) => {
            let valueA, valueB;
            
            switch (column) {
                case 'title':
                    valueA = a.title || '';
                    valueB = b.title || '';
                    break;
                case 'vendor':
                    valueA = a.vendor || '';
                    valueB = b.vendor || '';
                    break;
                case 'type':
                    valueA = a.product_type || '';
                    valueB = b.product_type || '';
                    break;
                case 'price':
                    // Get the lowest variant price
                    valueA = getLowestPrice(a);
                    valueB = getLowestPrice(b);
                    return state.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
                case 'created':
                    valueA = new Date(a.created_at || 0);
                    valueB = new Date(b.created_at || 0);
                    return state.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
                default:
                    return 0;
            }
            
            // String comparison
            if (state.sortDirection === 'asc') {
                return valueA.localeCompare(valueB);
            } else {
                return valueB.localeCompare(valueA);
            }
        });
        
        renderProductsPage();
    }

    // Handle sort dropdown change
    function handleSortSelect() {
        const value = elements.sortSelect.value;
        
        if (!value) return;
        
        const [column, direction] = value.split('_');
        
        let sortCol = column;
        if (column === 'date') {
            sortCol = 'created';
        }
        
        sortProducts(sortCol, direction, false);
    }

    // Get the lowest price from product variants
    function getLowestPrice(product) {
        if (!product.variants || product.variants.length === 0) {
            return 0;
        }
        
        let lowestPrice = Infinity;
        product.variants.forEach(variant => {
            const price = parseFloat(variant.price || 0);
            if (price && price < lowestPrice) {
                lowestPrice = price;
            }
        });
        
        return lowestPrice === Infinity ? 0 : lowestPrice;
    }

    // Format price to currency - memoize for performance
    const formatPriceCache = new Map();
    function formatPrice(price) {
        const cacheKey = price.toString();
        if (formatPriceCache.has(cacheKey)) {
            return formatPriceCache.get(cacheKey);
        }
        
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
        
        formatPriceCache.set(cacheKey, formatted);
        return formatted;
    }

    // Format date - memoize for performance
    const formatDateCache = new Map();
    function formatDate(dateString) {
        if (formatDateCache.has(dateString)) {
            return formatDateCache.get(dateString);
        }
        
        const formatted = new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        formatDateCache.set(dateString, formatted);
        return formatted;
    }

    // Toggle expand/collapse variants
    function toggleVariants(product, row) {
        const productId = product.id;
        
        // Check if this product is already expanded
        if (state.expandedProducts.has(productId)) {
            // Find and remove the variant row
            const variantRow = row.nextElementSibling;
            if (variantRow && variantRow.classList.contains('variant-row-container')) {
                row.parentNode.removeChild(variantRow);
            }
            state.expandedProducts.delete(productId);
            
            // Update the button icon
            const expandButton = row.querySelector('.expand-button');
            expandButton.innerHTML = '<i class="fas fa-chevron-down"></i> Show Variants';
        } else {
            // Create a new row to contain the variants
            const newRow = document.createElement('tr');
            newRow.className = 'variant-row-container';
            
            // Create a single cell that spans all columns
            const cell = document.createElement('td');
            cell.colSpan = 6; // Match the number of columns in the main table
            
            // Add touch-friendly class for mobile
            if (window.innerWidth <= 768) {
                cell.className = 'mobile-optimized';
            }
            
            // Create variants section
            const variantContainer = document.createElement('div');
            variantContainer.id = `variants-${productId}`;
            variantContainer.className = 'variant-container';
            
            // Create variant header
            const variantHeader = document.createElement('div');
            variantHeader.className = 'variant-header';
            variantHeader.innerHTML = `<span>Variants (${product.variants.length})</span>`;
            variantContainer.appendChild(variantHeader);
            
            // Create variant table
            if (product.variants.length > 0) {
                const variantTable = document.createElement('table');
                variantTable.className = 'variant-table';
                
                // Create table header
                const tableHeader = document.createElement('thead');
                const headerRow = document.createElement('tr');
                
                const headers = ['Title', 'SKU', 'Price', 'Available', 'Option1', 'Option2', 'Option3', 'Actions'];
                headers.forEach(header => {
                    const th = document.createElement('th');
                    th.textContent = header;
                    headerRow.appendChild(th);
                });
                
                tableHeader.appendChild(headerRow);
                variantTable.appendChild(tableHeader);
                
                // Create table body
                const tableBody = document.createElement('tbody');
                
                // Create document fragment to improve performance
                const fragment = document.createDocumentFragment();
                
                product.variants.forEach(variant => {
                    const variantRow = document.createElement('tr');
                    variantRow.className = 'variant-row';
                    
                    // Title cell
                    const titleCell = document.createElement('td');
                    titleCell.textContent = variant.title || 'Default Title';
                    variantRow.appendChild(titleCell);
                    
                    // SKU cell
                    const skuCell = document.createElement('td');
                    skuCell.textContent = variant.sku || 'N/A';
                    variantRow.appendChild(skuCell);
                    
                    // Price cell
                    const priceCell = document.createElement('td');
                    priceCell.textContent = variant.price ? formatPrice(parseFloat(variant.price)) : 'N/A';
                    variantRow.appendChild(priceCell);
                    
                    // Available cell
                    const availableCell = document.createElement('td');
                    availableCell.textContent = variant.available ? 'Yes' : 'No';
                    variantRow.appendChild(availableCell);
                    
                    // Option1 cell
                    const option1Cell = document.createElement('td');
                    option1Cell.textContent = variant.option1 || 'N/A';
                    variantRow.appendChild(option1Cell);
                    
                    // Option2 cell
                    const option2Cell = document.createElement('td');
                    option2Cell.textContent = variant.option2 || 'N/A';
                    variantRow.appendChild(option2Cell);
                    
                    // Option3 cell
                    const option3Cell = document.createElement('td');
                    option3Cell.textContent = variant.option3 || 'N/A';
                    variantRow.appendChild(option3Cell);
                    
                    // Actions cell
                    const actionsCell = document.createElement('td');
                    
                    const checkoutButton = document.createElement('button');
                    checkoutButton.className = 'action-button';
                    checkoutButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy';
                    checkoutButton.addEventListener('click', () => {
                        const storeName = elements.storeNameInput.value.trim();
                        const checkoutUrl = `https://${storeName}.myshopify.com/cart/${variant.id}:1`;
                        window.open(checkoutUrl, '_blank');
                    });
                    
                    actionsCell.appendChild(checkoutButton);
                    variantRow.appendChild(actionsCell);
                    
                    fragment.appendChild(variantRow);
                });
                
                tableBody.appendChild(fragment);
                variantTable.appendChild(tableBody);
                variantContainer.appendChild(variantTable);
            } else {
                const noVariantsMessage = document.createElement('p');
                noVariantsMessage.textContent = 'No variants found for this product.';
                noVariantsMessage.style.padding = '1rem';
                noVariantsMessage.style.textAlign = 'center';
                variantContainer.appendChild(noVariantsMessage);
            }
            
            // Add the variant container to the cell
            cell.appendChild(variantContainer);
            newRow.appendChild(cell);
            
            // Insert the new row after the product row
            row.parentNode.insertBefore(newRow, row.nextSibling);
            state.expandedProducts.add(productId);
            
            // Update the button icon
            const expandButton = row.querySelector('.expand-button');
            expandButton.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Variants';
        }
    }

    // Update pagination controls
    function updatePagination() {
        state.totalPages = Math.ceil(state.filteredProducts.length / state.productsPerPage);
        
        // Update buttons state
        elements.prevPageButton.disabled = state.currentPage <= 1;
        elements.nextPageButton.disabled = state.currentPage >= state.totalPages;
        
        // Generate page numbers
        elements.pageNumbersContainer.innerHTML = '';
        
        // Determine visible page range
        let startPage = Math.max(1, state.currentPage - 2);
        let endPage = Math.min(state.totalPages, startPage + 4);
        
        // Adjust if we're near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // First page link if not in range
        if (startPage > 1) {
            fragment.appendChild(createPageNumberButton(1));
            if (startPage > 2) {
                fragment.appendChild(createEllipsis());
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageNumberButton(i));
        }
        
        // Last page link if not in range
        if (endPage < state.totalPages) {
            if (endPage < state.totalPages - 1) {
                fragment.appendChild(createEllipsis());
            }
            fragment.appendChild(createPageNumberButton(state.totalPages));
        }
        
        // Add all elements at once
        elements.pageNumbersContainer.appendChild(fragment);
    }
    
    // Create a page number button (doesn't add to DOM)
    function createPageNumberButton(pageNum) {
        const pageButton = document.createElement('div');
        pageButton.className = `page-number ${pageNum === state.currentPage ? 'active' : ''}`;
        pageButton.textContent = pageNum;
        pageButton.addEventListener('click', () => goToPage(pageNum));
        return pageButton;
    }
    
    // Create ellipsis for pagination (doesn't add to DOM)
    function createEllipsis() {
        const ellipsis = document.createElement('div');
        ellipsis.className = 'page-number';
        ellipsis.textContent = '...';
        ellipsis.style.cursor = 'default';
        return ellipsis;
    }
    
    // Go to specific page
    function goToPage(pageNum) {
        state.currentPage = pageNum;
        renderProductsPage();
        updatePagination();
        
        // Scroll to top of table
        elements.productsTable.scrollIntoView({ behavior: 'smooth' });
    }

    // Render current page of products
    function renderProductsPage() {
        // Clear any expanded products when changing pages
        state.expandedProducts.clear();
        
        const startIndex = (state.currentPage - 1) * state.productsPerPage;
        const endIndex = Math.min(startIndex + state.productsPerPage, state.filteredProducts.length);
        const currentPageProducts = state.filteredProducts.slice(startIndex, endIndex);
        
        elements.showingCountSpan.textContent = `${startIndex + 1}-${endIndex} of ${state.filteredProducts.length}`;
        
        // Clear table body
        elements.productsBody.innerHTML = '';
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        if (currentPageProducts.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.textContent = 'No products found';
            cell.style.textAlign = 'center';
            cell.style.padding = '2rem';
            row.appendChild(cell);
            fragment.appendChild(row);
        } else {
            currentPageProducts.forEach(product => {
                const row = document.createElement('tr');
                row.setAttribute('data-product-id', product.id);
                
                // Title cell
                const titleCell = document.createElement('td');
                titleCell.textContent = product.title || 'N/A';
                row.appendChild(titleCell);
                
                // Vendor cell
                const vendorCell = document.createElement('td');
                vendorCell.textContent = product.vendor || 'N/A';
                row.appendChild(vendorCell);
                
                // Type cell
                const typeCell = document.createElement('td');
                typeCell.textContent = product.product_type || 'N/A';
                row.appendChild(typeCell);
                
                // Price cell
                const priceCell = document.createElement('td');
                const price = getLowestPrice(product);
                priceCell.textContent = price ? formatPrice(price) : 'N/A';
                row.appendChild(priceCell);
                
                // Created date cell
                const createdCell = document.createElement('td');
                createdCell.textContent = product.created_at ? formatDate(product.created_at) : 'N/A';
                row.appendChild(createdCell);
                
                // Actions cell
                const actionsCell = document.createElement('td');
                
                // Create buttons
                const buttonsHTML = `
                    <button class="action-button"><i class="fas fa-external-link-alt"></i> View</button>
                    <button class="action-button" style="margin-left: 0.5rem"><i class="fas fa-code"></i> JSON</button>
                    <button class="expand-button" style="margin-left: 0.5rem"><i class="fas fa-chevron-down"></i> Show Variants</button>
                `;
                
                actionsCell.innerHTML = buttonsHTML;
                
                // Add event listeners after DOM insertion to improve performance
                actionsCell.querySelector('.action-button:first-child').addEventListener('click', () => {
                    const storeName = elements.storeNameInput.value.trim();
                    const productUrl = `https://${storeName}.myshopify.com/products/${product.handle}`;
                    window.open(productUrl, '_blank');
                });
                
                actionsCell.querySelector('.action-button:nth-child(2)').addEventListener('click', () => {
                    const storeName = elements.storeNameInput.value.trim();
                    const jsonUrl = `https://${storeName}.myshopify.com/products/${product.handle}.json`;
                    window.open(jsonUrl, '_blank');
                });
                
                actionsCell.querySelector('.expand-button').addEventListener('click', () => {
                    toggleVariants(product, row);
                });
                
                row.appendChild(actionsCell);
                fragment.appendChild(row);
            });
        }
        
        // Add all rows at once for better performance
        elements.productsBody.appendChild(fragment);
    }

    // UI utility functions
    function resetUI() {
        elements.productsBody.innerHTML = '';
        state.expandedProducts.clear();
        showInfoPanel(false);
        showProductsTable(false);
        
        // Reset filters
        elements.columnFilters.forEach(filter => {
            filter.value = '';
        });
        
        Object.keys(state.filterState).forEach(key => {
            state.filterState[key] = '';
        });
    }

    function showLoader(show) {
        elements.loader.classList.toggle('active', show);
    }

    function showInfoPanel(show) {
        elements.infoPanel.classList.toggle('hidden', !show);
    }

    function showProductsTable(show) {
        elements.productsTable.classList.toggle('hidden', !show);
        
        // Show scroll hint on mobile devices
        if (show) {
            updateScrollHintVisibility();
        } else {
            elements.tableScrollHint.classList.add('hidden');
        }
    }
    
    // Update scroll hint visibility based on screen width
    function updateScrollHintVisibility() {
        elements.tableScrollHint.classList.toggle('hidden', window.innerWidth > 768);
    }
    
    // Update table scroll hint visibility on window resize
    window.addEventListener('resize', () => {
        if (!elements.productsTable.classList.contains('hidden')) {
            updateScrollHintVisibility();
        }
    });

    function showError(message) {
        elements.errorText.textContent = message;
        elements.errorMessage.classList.remove('hidden');
    }

    function hideError() {
        elements.errorMessage.classList.add('hidden');
    }
});