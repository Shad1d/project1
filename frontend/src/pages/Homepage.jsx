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

const ProductCard = ({title, price, emoji}) => {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden">
      <div className="h-40 bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 text-5xl font-medium">
          {emoji}
        </span>
      </div>
      <div className="p-4">
        <div>
          <h3 className="font-black mb-1">
            {title}
          </h3>
          <p className="text-green-400 text-lg">
            {price}
          </p>
        </div>
      </div>
    </div>
  )
}

const ProductSection = ({title, accentColor, tag, products}) => {
  return (
    <section className="mb-16">
      <div className="flex items-center gap-4 mb-6">
        <div
        className="w-3 h-10 rounded-full"
        style={{backgroundColor: accentColor}}
        />
        <span
        className="text-xs font-bold uppercase tracking-widest inline-block px-2 py-0.5 rounded-full mb-1"
        >
          {tag}
        </span>
        <h2 className="text-2xl font-extrabold">
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
    <div className="min-h-screen bg-sky-200">
      <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 px-6 py-14 mb-12">
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
          <span className="inline-block bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Community Marketplace
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Buy, Sell &amp; Rent
            <br />
            <span className="text-yellow-300">Anything, Anywhere</span>
          </h1>
          <p className="text-indigo-200 text-lg mb-8">
            Discover deals in your neighbourhood or list your items in seconds.
          </p>
        </div>
      </div>
      <main>
        <ProductSection
          title="Recent Uploads"
          accentColor="#7c3aed" // purple
          tag="New"
          products={DATA.recent}
        />
        <ProductSection
          title="Nearby Products"
          accentColor="#059669" // green
          tag="Nearby"
          products={DATA.nearby}
        />
        <ProductSection
          title="Products For Rent"
          accentColor="#d97706" // amber
          tag="Rent"
          products={DATA.rent}
        />
      </main>
    </div>
  );
};

export default Homepage;