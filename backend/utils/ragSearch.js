/**
 * RAG Search & Query Intent Processing Engine
 * Provides natural language intent extraction, semantic keyword expansion,
 * relevance scoring, and contextual search summary generation.
 */

// Category dictionary for intent mapping
const CATEGORY_MAP = {
    "electronics": "Electronics & Gadgets",
    "gadgets": "Electronics & Gadgets",
    "phone": "Electronics & Gadgets",
    "laptop": "Electronics & Gadgets",
    "computer": "Electronics & Gadgets",
    "headphone": "Electronics & Gadgets",
    "tv": "Electronics & Gadgets",
    "camera": "Electronics & Gadgets",
    "mobile": "Electronics & Gadgets",
    "furniture": "Furniture & Home",
    "sofa": "Furniture & Home",
    "chair": "Furniture & Home",
    "table": "Furniture & Home",
    "bed": "Furniture & Home",
    "desk": "Furniture & Home",
    "clothing": "Clothing & Accessories",
    "shoes": "Clothing & Accessories",
    "shirt": "Clothing & Accessories",
    "jacket": "Clothing & Accessories",
    "watch": "Clothing & Accessories",
    "books": "Books & Stationery",
    "book": "Books & Stationery",
    "notebook": "Books & Stationery",
    "pen": "Books & Stationery",
    "sports": "Sports & Outdoors",
    "gym": "Sports & Outdoors",
    "bicycle": "Sports & Outdoors",
    "bike": "Sports & Outdoors",
    "football": "Sports & Outdoors",
    "tent": "Sports & Outdoors",
    "toys": "Toys & Games",
    "game": "Toys & Games",
    "ps5": "Toys & Games",
    "playstation": "Toys & Games",
    "xbox": "Toys & Games",
    "tools": "Tools & Equipment",
    "drill": "Tools & Equipment",
    "hammer": "Tools & Equipment",
    "vehicles": "Vehicles & Parts",
    "car": "Vehicles & Parts",
    "scooter": "Vehicles & Parts",
    "parts": "Vehicles & Parts",
    "kitchen": "Kitchen & Appliances",
    "blender": "Kitchen & Appliances",
    "fridge": "Kitchen & Appliances",
    "oven": "Kitchen & Appliances",
    "microwave": "Kitchen & Appliances",
    "instruments": "Musical Instruments",
    "guitar": "Musical Instruments",
    "piano": "Musical Instruments",
    "keyboard": "Musical Instruments",
    "art": "Art & Collectibles",
    "painting": "Art & Collectibles",
};

// Synonym dictionary for query term expansion
const SYNONYMS = {
    "phone": ["smartphone", "mobile", "cellphone", "iphone", "android"],
    "laptop": ["macbook", "notebook", "computer", "pc"],
    "bike": ["bicycle", "cycle", "motorcycle", "scooter"],
    "car": ["vehicle", "automobile", "auto"],
    "couch": ["sofa", "settee", "couch"],
    "tv": ["television", "monitor", "display"],
    "gym": ["fitness", "workout", "exercise"],
    "rent": ["rental", "hire", "lease"],
};

/**
 * Parse natural language query to extract intent and expanded terms.
 */
export function parseQueryIntent(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") {
        return {
            cleanQuery: "",
            tokens: [],
            expandedTerms: [],
            extractedCategory: null,
            maxPriceHint: null,
            minPriceHint: null,
            deliveryHint: false,
            verifiedHint: false,
            listingTypeHint: null,
        };
    }

    const clean = rawQuery.trim().toLowerCase();
    const words = clean.split(/\s+/).filter(Boolean);

    let extractedCategory = null;
    let deliveryHint = false;
    let verifiedHint = false;
    let listingTypeHint = null;
    let minPriceHint = null;
    let maxPriceHint = null;

    // Detect delivery intent
    if (clean.includes("deliver") || clean.includes("shipping") || clean.includes("home delivery")) {
        deliveryHint = true;
    }

    // Detect verified seller intent
    if (clean.includes("verified") || clean.includes("trusted") || clean.includes("authentic")) {
        verifiedHint = true;
    }

    // Detect rental intent
    if (clean.includes("rent") || clean.includes("rental") || clean.includes("for rent")) {
        listingTypeHint = "rent";
    } else if (clean.includes("buy") || clean.includes("sale") || clean.includes("for sale")) {
        listingTypeHint = "sell";
    }

    // Detect category
    for (const word of words) {
        if (CATEGORY_MAP[word]) {
            extractedCategory = CATEGORY_MAP[word];
            break;
        }
    }

    // Detect price intent (e.g. "under 500", "below 1000", "cheap")
    const underMatch = clean.match(/(?:under|below|less than|max|up to)\s*\$?(\d+)/i);
    if (underMatch) {
        maxPriceHint = parseFloat(underMatch[1]);
    }
    const aboveMatch = clean.match(/(?:above|over|more than|min|at least)\s*\$?(\d+)/i);
    if (aboveMatch) {
        minPriceHint = parseFloat(aboveMatch[1]);
    }

    // Synonym expansion
    const expanded = new Set(words);
    words.forEach((word) => {
        if (SYNONYMS[word]) {
            SYNONYMS[word].forEach((syn) => expanded.add(syn));
        }
    });

    return {
        cleanQuery: clean,
        tokens: words,
        expandedTerms: Array.from(expanded),
        extractedCategory,
        minPriceHint,
        maxPriceHint,
        deliveryHint,
        verifiedHint,
        listingTypeHint,
    };
}

/**
 * Calculate RAG Semantic Relevance Score for a listing against query tokens.
 */
export function calculateRelevanceScore(listing, queryInfo) {
    if (!queryInfo.tokens.length) return 1.0;

    let score = 0;
    const titleLower = (listing.title || "").toLowerCase();
    const descLower = (listing.description || "").toLowerCase();
    const catLower = (listing.category || "").toLowerCase();
    const condLower = (listing.condition || "").toLowerCase();

    // Exact query string match in title
    if (queryInfo.cleanQuery && titleLower.includes(queryInfo.cleanQuery)) {
        score += 10.0;
    }

    // Token matches
    queryInfo.expandedTerms.forEach((term) => {
        if (titleLower.includes(term)) {
            score += 4.0;
        }
        if (descLower.includes(term)) {
            score += 1.5;
        }
        if (catLower.includes(term)) {
            score += 3.0;
        }
        if (condLower.includes(term)) {
            score += 1.0;
        }
    });

    // Category intent match bonus
    if (queryInfo.extractedCategory && listing.category === queryInfo.extractedCategory) {
        score += 5.0;
    }

    // Verified seller bonus
    if (listing.sellerObj?.isEmailVerified || listing.seller?.isEmailVerified) {
        score += 1.0;
    }

    // Delivery available bonus
    if (listing.deliveryAvailable) {
        score += 0.5;
    }

    // Recency bonus (within last 3 days)
    if (listing.createdAt) {
        const ageDays = (Date.now() - new Date(listing.createdAt).getTime()) / (1000 * 3600 * 24);
        if (ageDays <= 3) {
            score += 1.0;
        }
    }

    return score;
}

/**
 * Generate natural language RAG insights and search summary.
 */
export function generateRagInsights(query, resultsCount, appliedFilters, intent) {
    if (!query && !Object.keys(appliedFilters).length) {
        return {
            summary: `Showing all ${resultsCount} available items in the marketplace.`,
            interpretedQuery: "All items",
            expandedKeywords: [],
            appliedFiltersSummary: "No filters applied",
        };
    }

    const filterParts = [];
    if (appliedFilters.category) filterParts.push(`Category: ${appliedFilters.category}`);
    if (appliedFilters.minPrice || appliedFilters.maxPrice) {
        if (appliedFilters.minPrice && appliedFilters.maxPrice) {
            filterParts.push(`Price: $${appliedFilters.minPrice} - $${appliedFilters.maxPrice}`);
        } else if (appliedFilters.minPrice) {
            filterParts.push(`Price >= $${appliedFilters.minPrice}`);
        } else {
            filterParts.push(`Price <= $${appliedFilters.maxPrice}`);
        }
    }
    if (appliedFilters.maxDistance) filterParts.push(`Within ${appliedFilters.maxDistance} km`);
    if (appliedFilters.deliveryAvailable) filterParts.push("Delivery available");
    if (appliedFilters.sellerVerified) filterParts.push("Verified sellers only");
    if (appliedFilters.listingType && appliedFilters.listingType !== "all") {
        filterParts.push(appliedFilters.listingType === "sell" ? "For Sale" : "For Rent");
    }

    let summaryText = "";
    if (resultsCount === 0) {
        summaryText = `No listings directly matched your query "${query || "filters"}". Try broadening price range or clearing distance filters.`;
    } else {
        const catStr = intent?.extractedCategory ? ` in ${intent.extractedCategory}` : "";
        summaryText = `RAG search retrieved ${resultsCount} item${resultsCount > 1 ? "s" : ""}${catStr} matching your request.`;
    }

    return {
        summary: summaryText,
        interpretedQuery: query ? `Keyword & Intent: "${query}"` : "Filtered search",
        expandedKeywords: intent?.expandedTerms || [],
        appliedFiltersSummary: filterParts.length ? filterParts.join(" • ") : "None",
    };
}