import React from "react";

const DATA = {
  recent: [
    { id: 1, title: "Samsung S23 FE", price: "৳28,500", emoji: "📱" },
    { id: 2, title: "Nike Air Max 97", price: "৳4,200", emoji: "👟" },
    { id: 3, title: "MacBook Air M2", price: "৳95,000", emoji: "💻" },
    { id: 4, title: "Office Chair", price: "৳3,800", emoji: "🪑" },
    { id: 5, title: "Sony WH-1000XM5", price: "৳22,000", emoji: "🎧" },
  ],
  nearby: [
    { id: 6, title: "Organic Veggies Box", price: "৳650", emoji: "🥗" },
    { id: 7, title: "3-Seater Sofa", price: "৳14,000", emoji: "🛋️" },
    { id: 8, title: "HSC Books Set", price: "৳900", emoji: "📚" },
    { id: 9, title: "Kids Bicycle", price: "৳2,200", emoji: "🚲" },
    { id: 10, title: "Electric Rice Cooker", price: "৳1,800", emoji: "🍚" },
  ],
  rent: [
    { id: 11, title: "Canon DSLR Kit", price: "৳1,200/day", emoji: "📷" },
    { id: 12, title: "Event Tent 10×10", price: "৳3,500/day", emoji: "🎪" },
    { id: 13, title: "Power Drill Set", price: "৳400/day", emoji: "🔧" },
    { id: 14, title: "Acoustic Guitar", price: "৳350/day", emoji: "🎸" },
    { id: 15, title: "Projector+Screen", price: "৳2,000/day", emoji: "📽️" },
  ],
};

const ProductCard = ({ title, price, emoji }) => {
  return (
    <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-40 bg-emerald-50 flex items-center justify-center">
        <span className="text-emerald-300 text-5xl font-medium">
          {emoji}
        </span>
      </div>
      <div className="p-4">
        <div>
          <h3 className="font-semibold text-gray-800 mb-1">
            {title}
          </h3>
          <p className="text-emerald-600 text-lg font-medium">
            {price}
          </p>
        </div>
      </div>
    </div>
  )
}

const ProductSection = ({ title, accentColor, tag, products }) => {
  return (
    <section className="mb-16">
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-1 h-8 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span
          className="text-xs font-semibold uppercase tracking-widest inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700"
        >
          {tag}
        </span>
        <h2 className="text-2xl font-bold text-gray-800">
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            title={product.title}
            price={product.price}
            emoji={product.emoji}
          />
        ))}
      </div>
    </section>
  )
}

const Homepage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50 to-teal-50">
      <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-6 py-14 mb-12">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            // backgroundImage:
            //   "url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80)",
            // backgroundSize: "cover",
            // backgroundPosition: "center",
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="container mx-auto max-w-3xl text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Community Marketplace
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Buy, Sell &amp; Rent
            <br />
            <span className="text-emerald-100">Anything, Anywhere</span>
          </h1>
          <p className="text-emerald-50 text-lg mb-8">
            Discover deals in your neighbourhood or list your items in seconds.
          </p>
        </div>
      </div>
      <main className="px-6 py-12">
        <div className="container mx-auto max-w-7xl">
          <ProductSection
            title="Recent Uploads"
            accentColor="#059669" // emerald
            tag="New"
            products={DATA.recent}
          />
          <ProductSection
            title="Nearby Products"
            accentColor="#0d9488" // teal
            tag="Nearby"
            products={DATA.nearby}
          />
          <ProductSection
            title="Products For Rent"
            accentColor="#10b981" // green
            tag="Rent"
            products={DATA.rent}
          />
        </div>
      </main>
    </div>
  );
};

export default Homepage;