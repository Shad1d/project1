import React from 'react';

const Homepage = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 px-6 py-14 mb-12">
                <div
                    className="absolute inset-0 opacity-50"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
                <div className="relative container mx-auto max-w-3xl text-center">
                    <span className="inline-block bg-white/20 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                        Community Marketplace
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                        Buy, Sell &amp; Rent
                        <br />
                        <span className="text-yellow-300">Anything, Anywhere</span>
                    </h1>
                    <p className="text-indigo-200 text-lg mb-8">
                        Discover deals in your neighbourhood or list your items in
                        seconds.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Homepage;
