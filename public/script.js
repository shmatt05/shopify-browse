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
        pageNumbersContainer: document.getElementById('page-numbers'),
        exportHtmlButton: document.getElementById('export-html-button'),
        vendorReportButton: document.getElementById('vendor-report-button'),
        filterContainer: document.querySelector('.filter-container'),
        availableOnlyCheckbox: document.getElementById('available-only-checkbox'),
        sizeFilterContainer: document.getElementById('size-filter-container'),
        sizeFilter: document.getElementById('size-filter'),
        clearSizesButton: document.getElementById('clear-sizes'),
        checkoutBar: document.getElementById('checkout-bar'),
        selectedCountSpan: document.getElementById('selected-count'),
        uncheckAllBtn: document.getElementById('uncheck-all-btn'),
        checkoutNowBtn: document.getElementById('checkout-now-btn'),
        brandFilter: null, // Will be created dynamically
        genderFilter: null, // Will be created dynamically
        typeFilter: null // Will be created dynamically
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
            created: '',
            brand: '',
            gender: ''
        },
        showAvailableOnly: false,
        selectedSizes: [],
        selectedVariants: new Map(), // Map of variantId -> { id, title, price }
        brandOptions: [],
        genderOptions: [],
        typeOptions: [],
        sizeOptions: []
    };

    // Event listeners - use event delegation where possible
    elements.fetchButton.addEventListener('click', fetchProducts);
    elements.sortSelect.addEventListener('change', handleSortSelect);
    elements.storeNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchProducts();
    });
    elements.exportHtmlButton.addEventListener('click', exportProductsToHtml);
    elements.vendorReportButton.addEventListener('click', generateVendorReport);
    elements.availableOnlyCheckbox.addEventListener('change', (e) => {
        state.showAvailableOnly = e.target.checked;
        applyFilters();
    });
    
    elements.sizeFilter.addEventListener('change', (e) => {
        state.selectedSizes = Array.from(e.target.selectedOptions).map(option => option.value);
        applyFilters();
    });
    
    elements.clearSizesButton.addEventListener('click', () => {
        elements.sizeFilter.selectedIndex = -1;
        state.selectedSizes = [];
        applyFilters();
    });

    elements.uncheckAllBtn.addEventListener('click', clearAllSelectedVariants);
    elements.checkoutNowBtn.addEventListener('click', checkoutSelectedVariants);

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

            // Initialize filteredProducts with all products
            state.filteredProducts = [...state.allProducts];

            // Extract brand, gender, and type options
            extractProductAttributes();

            // Create filter dropdowns if they don't exist
            createFilterDropdowns();

            // Apply automatic filter for "The Style Vault" vendor
            if (state.allProducts.some(product => product.vendor === "The Style Vault")) {
                state.filterState.vendor = "The Style Vault";
                // Update the vendor input filter to reflect this
                const vendorFilter = document.querySelector('.column-filter[data-column="vendor"]');
                if (vendorFilter) {
                    vendorFilter.value = "The Style Vault";
                }
            }

            // Apply filters
            applyFilters();

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

    // Extract brand, gender, type, and sizes from products
    function extractProductAttributes() {
        const brands = new Set();
        const genders = new Set();
        const types = new Set();
        const sizes = new Set();

        // Use filteredProducts instead of allProducts to only show options from filtered items
        state.filteredProducts.forEach(product => {
            // Extract brand and gender from title (e.g., "Smythson | Men | Box | Midnight Blue")
            if (product.title) {
                const parts = product.title.split('|').map(part => part.trim());
                if (parts.length >= 1) {
                    const brand = parts[0];
                    brands.add(brand);
                }
                if (parts.length >= 2) {
                    const gender = parts[1];
                    genders.add(gender);
                }
            }

            // Add product type
            if (product.product_type) {
                types.add(product.product_type);
            }

            // Extract sizes from variant titles
            if (product.variants && product.variants.length > 0) {
                product.variants.forEach(variant => {
                    if (variant.title) {
                        // Extract numbers from variant title (e.g., "Unisex / 39" -> "39")
                        // Match numbers that could be sizes (including decimals like 8.5)
                        const sizeMatches = variant.title.match(/\b\d+(?:\.\d+)?\b/g);
                        if (sizeMatches) {
                            sizeMatches.forEach(size => sizes.add(size));
                        }
                    }
                });
            }
        });

        // Convert sets to sorted arrays
        state.brandOptions = Array.from(brands).sort();
        state.genderOptions = Array.from(genders).sort();
        state.typeOptions = Array.from(types).sort();
        
        // Sort sizes numerically
        state.sizeOptions = Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
    }

    // Create dropdown filters
    function createFilterDropdowns() {
        // Create brand filter
        if (!elements.brandFilter) {
            elements.brandFilter = createDropdown('brand', 'Brand', state.brandOptions);
            elements.filterContainer.appendChild(elements.brandFilter);
        } else {
            updateDropdownOptions(elements.brandFilter, state.brandOptions);
        }

        // Create gender filter
        if (!elements.genderFilter) {
            elements.genderFilter = createDropdown('gender', 'Gender', state.genderOptions);
            elements.filterContainer.appendChild(elements.genderFilter);
        } else {
            updateDropdownOptions(elements.genderFilter, state.genderOptions);
        }

        // Create type filter
        if (!elements.typeFilter) {
            elements.typeFilter = createDropdown('type', 'Type', state.typeOptions);
            elements.filterContainer.appendChild(elements.typeFilter);
        } else {
            updateDropdownOptions(elements.typeFilter, state.typeOptions);
        }

        // Update size filter
        updateSizeFilter();
    }

    // Update size filter options
    function updateSizeFilter() {
        // Clear existing options
        elements.sizeFilter.innerHTML = '';

        // Show or hide the size filter container based on whether we have sizes
        if (state.sizeOptions.length > 0) {
            elements.sizeFilterContainer.classList.remove('hidden');

            // Add size options
            state.sizeOptions.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                
                // Keep selected sizes selected
                if (state.selectedSizes.includes(size)) {
                    option.selected = true;
                }
                
                elements.sizeFilter.appendChild(option);
            });
        } else {
            elements.sizeFilterContainer.classList.add('hidden');
        }
    }

    // Create a dropdown filter
    function createDropdown(name, label, options) {
        const select = document.createElement('select');
        select.id = `${name}-filter`;
        select.className = 'dropdown-filter';
        select.setAttribute('data-filter', name);

        // Add "All" option
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = `All ${label}`;
        select.appendChild(allOption);

        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        // Add event listener
        select.addEventListener('change', function() {
            state.filterState[name] = this.value;

            // If this is brand or gender, we need to update the other dropdowns
            if (name === 'brand' || name === 'gender') {
                updateFilterDropdowns();
            }

            applyFilters();
        });

        return select;
    }

    // Update dropdown options based on current filters
    function updateFilterDropdowns() {
        // Get current filter values
        const currentBrand = state.filterState.brand;
        const currentGender = state.filterState.gender;

        // Filter products based on current filters
        // Use filteredProducts instead of allProducts to only show options from filtered items
        const filteredForDropdowns = state.filteredProducts.filter(product => {
            const parts = product.title ? product.title.split('|').map(part => part.trim()) : [];
            const productBrand = parts.length >= 1 ? parts[0] : '';
            const productGender = parts.length >= 2 ? parts[1] : '';

            // Check if product matches current filters
            const matchesBrand = !currentBrand || productBrand === currentBrand;
            const matchesGender = !currentGender || productGender === currentGender;

            return matchesBrand && matchesGender;
        });

        // Extract available options from filtered products
        const availableBrands = new Set();
        const availableGenders = new Set();
        const availableTypes = new Set();

        filteredForDropdowns.forEach(product => {
            const parts = product.title ? product.title.split('|').map(part => part.trim()) : [];
            if (parts.length >= 1) availableBrands.add(parts[0]);
            if (parts.length >= 2) availableGenders.add(parts[1]);
            if (product.product_type) availableTypes.add(product.product_type);
        });

        // Update dropdowns while preserving current selections
        if (elements.brandFilter && !currentBrand) {
            updateDropdownOptions(elements.brandFilter, Array.from(availableBrands).sort());
        }

        if (elements.genderFilter && !currentGender) {
            updateDropdownOptions(elements.genderFilter, Array.from(availableGenders).sort());
        }

        if (elements.typeFilter) {
            updateDropdownOptions(elements.typeFilter, Array.from(availableTypes).sort());
        }
    }

    // Update options in a dropdown
    function updateDropdownOptions(dropdown, options) {
        const currentValue = dropdown.value;
        const filterName = dropdown.getAttribute('data-filter');

        // Clear existing options (except the first "All" option)
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }

        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            dropdown.appendChild(optionElement);
        });

        // Restore selected value if it still exists in options
        if (currentValue && options.includes(currentValue)) {
            dropdown.value = currentValue;
        } else {
            dropdown.value = '';
            // Update filter state if the value was reset
            if (currentValue) {
                state.filterState[filterName] = '';
            }
        }
    }

    // Apply all filters and sorting
    function applyFilters() {
        // Start with all products
        state.filteredProducts = [...state.allProducts];

        // Apply availability filter first
        if (state.showAvailableOnly) {
            state.filteredProducts = state.filteredProducts.filter(product => {
                // Check if product has at least one available variant
                return product.variants && product.variants.some(variant => variant.available === true);
            });
        }

        // Apply size filter (OR logic - show product if it has ANY of the selected sizes)
        if (state.selectedSizes.length > 0) {
            state.filteredProducts = state.filteredProducts.filter(product => {
                if (!product.variants) return false;
                
                // Check each variant
                for (const variant of product.variants) {
                    if (!variant.title) continue;
                    
                    // Extract numbers from variant title
                    const sizeMatches = variant.title.match(/\b\d+(?:\.\d+)?\b/g);
                    if (!sizeMatches) continue;
                    
                    // Check if ANY of the variant's sizes matches ANY selected size (OR logic)
                    for (const size of sizeMatches) {
                        if (state.selectedSizes.includes(size)) {
                            return true; // Product has at least one matching size, include it
                        }
                    }
                }
                return false; // No matching sizes found
            });
        }

        // Apply column-specific filters
        for (const [column, value] of Object.entries(state.filterState)) {
            if (!value) continue;

            state.filteredProducts = state.filteredProducts.filter(product => {
                switch(column) {
                    case 'title':
                        return product.title && product.title.toLowerCase().includes(value.toLowerCase());
                    case 'vendor':
                        return product.vendor && product.vendor.toLowerCase().includes(value.toLowerCase());
                    case 'type':
                        return product.product_type && product.product_type.toLowerCase().includes(value.toLowerCase());
                    case 'price':
                        const price = getLowestPrice(product);
                        return price.toString().includes(value.toLowerCase());
                    case 'created':
                        return product.created_at && formatDate(product.created_at).toLowerCase().includes(value.toLowerCase());
                    case 'brand':
                        if (product.title) {
                            const parts = product.title.split('|').map(part => part.trim());
                            return parts.length >= 1 && parts[0] === value;
                        }
                        return false;
                    case 'gender':
                        if (product.title) {
                            const parts = product.title.split('|').map(part => part.trim());
                            return parts.length >= 2 && parts[1] === value;
                        }
                        return false;
                    default:
                        return true;
                }
            });
        }

        // Update count
        elements.countSpan.textContent = state.allProducts.length;
        elements.showingCountSpan.textContent = `${state.filteredProducts.length} of ${state.allProducts.length}`;

        // Update dropdown options based on filtered products
        extractProductAttributes();
        createFilterDropdowns();

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
            cell.colSpan = 7; // Match the number of columns in the main table (including image column)

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
            
            // Count available variants if filter is on
            const availableCount = product.variants.filter(v => v.available === true).length;
            const headerText = state.showAvailableOnly 
                ? `Available Variants (${availableCount} of ${product.variants.length})`
                : `Variants (${product.variants.length})`;
            variantHeader.innerHTML = `<span>${headerText}</span>`;
            variantContainer.appendChild(variantHeader);

            // Filter variants if showAvailableOnly is enabled (for checking if we have variants to show)
            const filteredVariants = state.showAvailableOnly 
                ? product.variants.filter(v => v.available === true)
                : product.variants;

            // Create variant table
            if (filteredVariants.length > 0) {
                const variantTable = document.createElement('table');
                variantTable.className = 'variant-table';

                // Create table header
                const tableHeader = document.createElement('thead');
                const headerRow = document.createElement('tr');

                const headers = ['', 'Title', 'SKU', 'Price', 'Available', 'Option1', 'Option2', 'Option3', 'Actions'];
                headers.forEach((header, index) => {
                    const th = document.createElement('th');
                    if (index === 0) {
                        th.innerHTML = '<i class="fas fa-check-square" style="opacity: 0.5;"></i>';
                        th.className = 'variant-checkbox-cell';
                    } else {
                        th.textContent = header;
                    }
                    headerRow.appendChild(th);
                });

                tableHeader.appendChild(headerRow);
                variantTable.appendChild(tableHeader);

                // Create table body
                const tableBody = document.createElement('tbody');

                // Create document fragment to improve performance
                const fragment = document.createDocumentFragment();

                // Filter variants if showAvailableOnly is enabled
                const variantsToShow = state.showAvailableOnly 
                    ? product.variants.filter(v => v.available === true)
                    : product.variants;

                variantsToShow.forEach(variant => {
                    const variantRow = document.createElement('tr');
                    variantRow.className = 'variant-row';

                    // Checkbox cell
                    const checkboxCell = document.createElement('td');
                    checkboxCell.className = 'variant-checkbox-cell';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'variant-checkbox';
                    checkbox.dataset.variantId = variant.id;
                    checkbox.dataset.variantTitle = variant.title || 'Default Title';
                    checkbox.dataset.variantPrice = variant.price || '0';
                    
                    // Check if this variant is already selected
                    if (state.selectedVariants.has(variant.id.toString())) {
                        checkbox.checked = true;
                    }
                    
                    checkbox.addEventListener('change', (e) => {
                        handleVariantCheckboxChange(e, variant);
                    });
                    checkboxCell.appendChild(checkbox);
                    variantRow.appendChild(checkboxCell);

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
                noVariantsMessage.textContent = state.showAvailableOnly 
                    ? 'No available variants for this product.'
                    : 'No variants found for this product.';
                noVariantsMessage.style.padding = '1rem';
                noVariantsMessage.style.textAlign = 'center';
                noVariantsMessage.style.color = '#888';
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
            cell.colSpan = 7; // Match the number of columns in the main table (including image column)
            cell.textContent = 'No products found';
            cell.style.textAlign = 'center';
            cell.style.padding = '2rem';
            row.appendChild(cell);
            fragment.appendChild(row);
        } else {
            currentPageProducts.forEach(product => {
                const row = document.createElement('tr');
                row.setAttribute('data-product-id', product.id);

                // Image cell
                const imageCell = document.createElement('td');
                imageCell.className = 'product-image-cell';

                // Check if product has images
                if (product.images && product.images.length > 0) {
                    const imageContainer = document.createElement('div');
                    imageContainer.className = 'product-image-zoom-container';

                    // Create thumbnail image
                    const thumbnailImg = document.createElement('img');
                    thumbnailImg.className = 'product-image-thumbnail';
                    thumbnailImg.src = product.images[0].src;
                    thumbnailImg.alt = product.title || 'Product image';
                    imageContainer.appendChild(thumbnailImg);

                    // Create zoom image
                    const zoomImg = document.createElement('img');
                    zoomImg.className = 'product-image-zoom';
                    zoomImg.src = product.images[0].src;
                    zoomImg.alt = product.title || 'Product image';
                    imageContainer.appendChild(zoomImg);

                    imageCell.appendChild(imageContainer);
                } else {
                    // No image placeholder
                    imageCell.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #f4f6f8;"><i class="fas fa-image" style="color: #dfe3e8;"></i></div>';
                }

                row.appendChild(imageCell);

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

        // Reset dropdown filters if they exist
        if (elements.brandFilter) {
            elements.brandFilter.value = '';
        }
        if (elements.genderFilter) {
            elements.genderFilter.value = '';
        }
        if (elements.typeFilter) {
            elements.typeFilter.value = '';
        }

        // Reset availability checkbox
        elements.availableOnlyCheckbox.checked = false;
        state.showAvailableOnly = false;

        // Reset size filter
        elements.sizeFilter.selectedIndex = -1;
        elements.sizeFilterContainer.classList.add('hidden');
        state.selectedSizes = [];

        // Reset selected variants
        state.selectedVariants.clear();
        elements.checkoutBar.classList.add('hidden');

        // Reset filter state
        Object.keys(state.filterState).forEach(key => {
            state.filterState[key] = '';
        });

        // Reset filter options
        state.brandOptions = [];
        state.genderOptions = [];
        state.typeOptions = [];
        state.sizeOptions = [];
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

    // Handle variant checkbox change
    function handleVariantCheckboxChange(event, variant) {
        const checkbox = event.target;
        const variantId = variant.id.toString();

        if (checkbox.checked) {
            state.selectedVariants.set(variantId, {
                id: variant.id,
                title: variant.title || 'Default Title',
                price: variant.price || '0'
            });
        } else {
            state.selectedVariants.delete(variantId);
        }

        updateCheckoutBar();
    }

    // Update checkout bar visibility and count
    function updateCheckoutBar() {
        const count = state.selectedVariants.size;

        if (count > 0) {
            elements.checkoutBar.classList.remove('hidden');
            elements.selectedCountSpan.textContent = count === 1 
                ? '1 item selected' 
                : `${count} items selected`;
        } else {
            elements.checkoutBar.classList.add('hidden');
        }
    }

    // Clear all selected variants
    function clearAllSelectedVariants() {
        state.selectedVariants.clear();
        
        // Uncheck all visible checkboxes
        document.querySelectorAll('.variant-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        updateCheckoutBar();
    }

    // Checkout selected variants
    function checkoutSelectedVariants() {
        if (state.selectedVariants.size === 0) return;

        const storeName = elements.storeNameInput.value.trim();
        
        // Build cart URL with all selected variants
        const cartItems = Array.from(state.selectedVariants.values())
            .map(variant => `${variant.id}:1`)
            .join(',');

        const checkoutUrl = `https://${storeName}.myshopify.com/cart/${cartItems}`;
        window.open(checkoutUrl, '_blank');
    }

    // Function to export products to HTML
    function exportProductsToHtml() {
        // Check if we have products to export
        if (state.filteredProducts.length === 0) {
            showError('No products to export. Please fetch products first.');
            return;
        }

        // Show loading indicator
        showLoader(true);
        // Change loader text to indicate HTML generation
        const loaderText = document.querySelector('#loader p');
        const originalLoaderText = loaderText.textContent;
        loaderText.textContent = 'Generating HTML... This may take a moment.';

        try {
            // Get store name for the file title
            const storeName = elements.currentStoreSpan.textContent;

            // Create HTML content
            let htmlContent = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
            htmlContent += '    <meta charset="UTF-8">\n';
            htmlContent += '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
            htmlContent += '    <title>' + storeName + ' Products</title>\n';
            htmlContent += '    <style>\n';
            htmlContent += '        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }\n';
            htmlContent += '        h1 { color: #333; text-align: center; margin-bottom: 20px; }\n';
            htmlContent += '        table { width: 100%; border-collapse: collapse; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }\n';
            htmlContent += '        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }\n';
            htmlContent += '        th { background-color: #5c6ac4; color: white; font-weight: bold; }\n';
            htmlContent += '        tr:hover { background-color: #f5f5f5; }\n';
            htmlContent += '        img { max-width: 100px; max-height: 100px; display: block; }\n';
            htmlContent += '        .variants-section { padding: 10px 15px; background-color: #f9fafb; }\n';
            htmlContent += '        .variants-title { font-weight: bold; margin-bottom: 8px; color: #5c6ac4; font-size: 14px; }\n';
            htmlContent += '        .variants-table { width: 100%; margin-top: 5px; background-color: white; font-size: 13px; }\n';
            htmlContent += '        .variants-table th { background-color: #7c8fd4; padding: 6px 10px; font-size: 12px; }\n';
            htmlContent += '        .variants-table td { padding: 6px 10px; }\n';
            htmlContent += '        .no-variants { color: #999; font-style: italic; font-size: 13px; }\n';
            htmlContent += '    </style>\n';
            htmlContent += '</head>\n<body>\n';
            htmlContent += '    <h1>' + storeName + ' Products</h1>\n';
            htmlContent += '    <table>\n';
            htmlContent += '        <thead>\n';
            htmlContent += '            <tr>\n';
            htmlContent += '                <th>Image</th>\n';
            htmlContent += '                <th>Item Name</th>\n';
            htmlContent += '                <th>Item Price</th>\n';
            htmlContent += '            </tr>\n';
            htmlContent += '        </thead>\n';
            htmlContent += '        <tbody>\n';

            // Add each product to the HTML table
            state.filteredProducts.forEach(product => {
                // Get image URL
                const imageUrl = product.images && product.images.length > 0 
                    ? product.images[0].src 
                    : '';

                // Get product title
                const title = product.title || 'N/A';

                // Get product price
                const price = getLowestPrice(product);
                const formattedPrice = price ? formatPrice(price) : 'N/A';

                // Add row to HTML table
                htmlContent += '            <tr>\n';
                htmlContent += '                <td>' + (imageUrl ? '<img src="' + imageUrl + '" alt="' + title + '">' : 'No image') + '</td>\n';
                htmlContent += '                <td>' + title + '</td>\n';
                htmlContent += '                <td>' + formattedPrice + '</td>\n';
                htmlContent += '            </tr>\n';

                // Add available variants section
                const availableVariants = product.variants ? product.variants.filter(v => v.available) : [];
                if (availableVariants.length > 0) {
                    htmlContent += '            <tr>\n';
                    htmlContent += '                <td colspan="3" class="variants-section">\n';
                    htmlContent += '                    <div class="variants-title">Available Variants (' + availableVariants.length + '):</div>\n';
                    htmlContent += '                    <table class="variants-table">\n';
                    htmlContent += '                        <thead>\n';
                    htmlContent += '                            <tr>\n';
                    htmlContent += '                                <th>Variant</th>\n';
                    htmlContent += '                                <th>SKU</th>\n';
                    htmlContent += '                                <th>Price</th>\n';
                    htmlContent += '                                <th>Options</th>\n';
                    htmlContent += '                            </tr>\n';
                    htmlContent += '                        </thead>\n';
                    htmlContent += '                        <tbody>\n';

                    availableVariants.forEach(variant => {
                        const variantTitle = variant.title || 'Default Title';
                        const variantSku = variant.sku || 'N/A';
                        const variantPrice = variant.price ? formatPrice(parseFloat(variant.price)) : 'N/A';
                        
                        // Build options string
                        const options = [];
                        if (variant.option1) options.push(variant.option1);
                        if (variant.option2) options.push(variant.option2);
                        if (variant.option3) options.push(variant.option3);
                        const optionsStr = options.length > 0 ? options.join(' / ') : 'N/A';

                        htmlContent += '                            <tr>\n';
                        htmlContent += '                                <td>' + variantTitle + '</td>\n';
                        htmlContent += '                                <td>' + variantSku + '</td>\n';
                        htmlContent += '                                <td>' + variantPrice + '</td>\n';
                        htmlContent += '                                <td>' + optionsStr + '</td>\n';
                        htmlContent += '                            </tr>\n';
                    });

                    htmlContent += '                        </tbody>\n';
                    htmlContent += '                    </table>\n';
                    htmlContent += '                </td>\n';
                    htmlContent += '            </tr>\n';
                } else {
                    // Show message if no variants are available
                    htmlContent += '            <tr>\n';
                    htmlContent += '                <td colspan="3" class="variants-section">\n';
                    htmlContent += '                    <div class="no-variants">No variants currently available</div>\n';
                    htmlContent += '                </td>\n';
                    htmlContent += '            </tr>\n';
                }
            });

            // Close the HTML content
            htmlContent += '        </tbody>\n';
            htmlContent += '    </table>\n';
            htmlContent += '</body>\n</html>';

            // Create a blob with the HTML content
            const blob = new Blob([htmlContent], { type: 'text/html' });

            // Create a download link
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = storeName.replace(/\s+/g, '-') + '-products.html';

            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Hide loader and restore original text
            showLoader(false);
            loaderText.textContent = originalLoaderText;
        } catch (error) {
            console.error('Error generating HTML:', error);
            showError('Error generating HTML. Please try again.');
            showLoader(false);
            loaderText.textContent = originalLoaderText;
        }
    }

    // Function to generate vendor report
    function generateVendorReport() {
        // Check if we have products
        if (state.allProducts.length === 0) {
            showError('No products to analyze. Please fetch products first.');
            return;
        }

        const storeName = elements.currentStoreSpan.textContent;
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));

        // Separate events from other vendors
        const recentEvents = [];
        const vendorStats = {};

        state.allProducts.forEach(product => {
            const productType = (product.product_type || '').toLowerCase();
            const vendor = product.vendor || 'Unknown';
            const vendorLower = vendor.toLowerCase();
            const createdAt = new Date(product.created_at);

            // Check if this is an event (type is "event" case-insensitive)
            const isEvent = productType === 'event';

            if (isEvent) {
                // Check if added in past 3 days
                if (createdAt >= threeDaysAgo) {
                    recentEvents.push({
                        title: product.title,
                        vendor: vendor,
                        createdAt: createdAt,
                        price: getLowestPrice(product),
                        type: product.product_type
                    });
                }
            } else {
                // Regular vendor - aggregate stats
                if (!vendorStats[vendor]) {
                    vendorStats[vendor] = {
                        name: vendor,
                        firstDate: createdAt,
                        lastDate: createdAt,
                        count: 0
                    };
                }

                vendorStats[vendor].count++;

                if (createdAt < vendorStats[vendor].firstDate) {
                    vendorStats[vendor].firstDate = createdAt;
                }
                if (createdAt > vendorStats[vendor].lastDate) {
                    vendorStats[vendor].lastDate = createdAt;
                }
            }
        });

        // Sort recent events by date (newest first)
        recentEvents.sort((a, b) => b.createdAt - a.createdAt);

        // Convert vendor stats to array and sort by count (descending)
        const vendorArray = Object.values(vendorStats).sort((a, b) => b.count - a.count);

        // Generate HTML report
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vendor Report - ${storeName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 10px;
            font-size: 2rem;
        }
        .subtitle {
            color: rgba(255,255,255,0.8);
            text-align: center;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .card h2 {
            color: #333;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card h2 .count {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
            font-size: 0.85rem;
            text-transform: uppercase;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .event-row {
            border-left: 4px solid #667eea;
        }
        .event-row td:first-child {
            padding-left: 16px;
        }
        .vendor-name {
            font-weight: 600;
            color: #333;
        }
        .date {
            color: #888;
            font-size: 0.9rem;
        }
        .count-badge {
            background: #e8f5e9;
            color: #2e7d32;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .no-data {
            color: #888;
            text-align: center;
            padding: 30px;
            font-style: italic;
        }
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-box {
            background: rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            color: white;
        }
        .stat-box .number {
            font-size: 2rem;
            font-weight: 700;
        }
        .stat-box .label {
            font-size: 0.85rem;
            opacity: 0.9;
        }
        .sortable {
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        .sortable:hover {
            background: #e9ecef;
        }
        .sort-icon {
            opacity: 0.4;
            margin-left: 4px;
            font-size: 0.8rem;
        }
        .sortable.active .sort-icon {
            opacity: 1;
            color: #667eea;
        }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .card { padding: 16px; }
            th, td { padding: 8px; font-size: 0.85rem; }
            h1 { font-size: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Vendor Report</h1>
        <p class="subtitle">${storeName} • Generated ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div class="summary-stats">
            <div class="stat-box">
                <div class="number">${state.allProducts.length}</div>
                <div class="label">Total Products</div>
            </div>
            <div class="stat-box">
                <div class="number">${recentEvents.length}</div>
                <div class="label">Recent Events (3 days)</div>
            </div>
            <div class="stat-box">
                <div class="number">${vendorArray.length}</div>
                <div class="label">Unique Vendors</div>
            </div>
        </div>

        <div class="card">
            <h2>🎉 Events Added (Past 3 Days) <span class="count">${recentEvents.length}</span></h2>
            ${recentEvents.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Event Name</th>
                        <th>Vendor</th>
                        <th>Added Date</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentEvents.map(event => `
                    <tr class="event-row">
                        <td>${event.title}</td>
                        <td>${event.vendor}</td>
                        <td class="date">${event.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>${event.price ? formatPrice(event.price) : 'N/A'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p class="no-data">No events added in the past 3 days</p>'}
        </div>

        <div class="card">
            <h2>🏪 Vendors Overview <span class="count">${vendorArray.length}</span></h2>
            ${vendorArray.length > 0 ? `
            <table id="vendor-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="name">Vendor Name <span class="sort-icon">↕</span></th>
                        <th class="sortable" data-sort="first">First Product <span class="sort-icon">↕</span></th>
                        <th class="sortable" data-sort="last">Latest Product <span class="sort-icon">↕</span></th>
                        <th class="sortable" data-sort="count">Products <span class="sort-icon">↓</span></th>
                    </tr>
                </thead>
                <tbody>
                    ${vendorArray.map(vendor => `
                    <tr data-name="${vendor.name}" data-first="${vendor.firstDate.getTime()}" data-last="${vendor.lastDate.getTime()}" data-count="${vendor.count}">
                        <td class="vendor-name">${vendor.name}</td>
                        <td class="date">${vendor.firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td class="date">${vendor.lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td><span class="count-badge">${vendor.count}</span></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p class="no-data">No vendor data available</p>'}
        </div>
    </div>

    <script>
        // Sorting functionality for vendor table
        document.addEventListener('DOMContentLoaded', function() {
            const table = document.getElementById('vendor-table');
            if (!table) return;
            
            const headers = table.querySelectorAll('th.sortable');
            let currentSort = { column: 'count', direction: 'desc' };
            
            headers.forEach(header => {
                header.addEventListener('click', function() {
                    const column = this.dataset.sort;
                    
                    // Toggle direction if same column, otherwise default direction
                    if (currentSort.column === column) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.column = column;
                        // Default: name asc, dates desc, count desc
                        currentSort.direction = column === 'name' ? 'asc' : 'desc';
                    }
                    
                    sortTable(column, currentSort.direction);
                    updateSortIcons(this, currentSort.direction);
                });
            });
            
            function sortTable(column, direction) {
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                rows.sort((a, b) => {
                    let aVal, bVal;
                    
                    if (column === 'name') {
                        aVal = a.dataset.name.toLowerCase();
                        bVal = b.dataset.name.toLowerCase();
                        return direction === 'asc' 
                            ? aVal.localeCompare(bVal) 
                            : bVal.localeCompare(aVal);
                    } else if (column === 'first') {
                        aVal = parseInt(a.dataset.first);
                        bVal = parseInt(b.dataset.first);
                    } else if (column === 'last') {
                        aVal = parseInt(a.dataset.last);
                        bVal = parseInt(b.dataset.last);
                    } else if (column === 'count') {
                        aVal = parseInt(a.dataset.count);
                        bVal = parseInt(b.dataset.count);
                    }
                    
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;
                });
                
                rows.forEach(row => tbody.appendChild(row));
            }
            
            function updateSortIcons(activeHeader, direction) {
                headers.forEach(h => {
                    h.classList.remove('active');
                    h.querySelector('.sort-icon').textContent = '↕';
                });
                activeHeader.classList.add('active');
                activeHeader.querySelector('.sort-icon').textContent = direction === 'asc' ? '↑' : '↓';
            }
        });
    </script>
</body>
</html>`;

        // Open in new tab
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

});
