import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, User, Tag } from "lucide-react";
import LoginModal from "../auth/LoginModal.jsx";

export default function NavBar() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();
    const handleSearch = (e) => {
        e.preventDefault();
        // e is an event
        // preventDefault() stops the form from doing its default action (which is to reload the page).

        if (!searchTerm.trim()) return;

        navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    };
    // ── Render ───────────────────────────────────────────────────
    return (
        <nav className="bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-800 shadow-2xl sticky top-0 z-50 border-b border-emerald-700/50">
            <div className="px-4 sm:px-8 py-3 sm:py-4">
                <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-3">
                    {/* ── Logo ── */}
                    <Link
                        to="/"
                        className="text-2xl sm:text-4xl font-extrabold flex items-center gap-1 sm:gap-3 text-white hover:text-emerald-400 transition-all duration-500 hover:scale-110 select-none group focus:outline-none shrink-0"
                    >
                        <span className="transition-transform duration-500 group-hover:rotate-12">
                            🛒
                        </span>
                        <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            GroCart
                        </span>
                    </Link>

                    <form
                        onSubmit={handleSearch}
                        className="flex-1 max-w-md mx-2 sm:mx-6"
                    >
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 rounded-full bg-emerald-100 text-emerald-900 placeholder-emerald-500 border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                    </form>
                    {/* ── Right controls ── */}
                    <div className="flex items-center gap-2 sm:gap-4 text-white">
                        {/* Wishlist */}
                        <Link
                            to="/wishlist"
                            className="hover:text-emerald-400 transition-colors"
                            title="Wishlist"
                        >
                            <Heart className="w-6 h-6 sm:w-7 sm:h-7" />
                        </Link>

                        {/* Sell */}
                        <Link
                            to="/sell"
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-full transition-colors"
                        >
                            <Tag size={14} />
                            <span className="hidden sm:inline">Sell</span>
                        </Link>

                        {/* ── User dropdown ── */}
                        {/*
              This wrapper div has "relative" so the dropdown panel
              can use "absolute" positioning INSIDE it — not relative
              to the whole page.
            */}
                        <div className="relative">
                            {/* The button that opens/closes the menu */}
                            <button
                                onClick={() => setUserMenuOpen((v) => !v)}
                                //   (v) => !v  means: "take the current value and flip it".
                                //   true  → false  (closes the menu)
                                //   false → true   (opens the menu)
                                //   This pattern is called a "toggle".

                                className="p-1 rounded-full hover:bg-slate-700/50 transition-all duration-300 flex items-center gap-2 hover:scale-105"
                            >
                                <User className="w-6 h-6 sm:w-7 sm:h-7 text-white hover:text-emerald-400 transition-colors" />
                            </button>

                            {/* The dropdown panel */}
                            {/*
                {userMenuOpen && <div>...} is called "short-circuit rendering".
                  If userMenuOpen is false → nothing is rendered (menu is hidden).
                  If userMenuOpen is true  → the <div> appears.

                React re-renders whenever state changes, so clicking the
                button above instantly makes this appear or disappear.
              */}
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-emerald-700/95 backdrop-blur-md shadow-2xl rounded-xl border border-emerald-600 z-50 animate-in slide-in-from-top-2">
                                    {/*
                    For now we always show the "not logged in" version.
                    In a future lesson we'll check real login state and
                    show the user's name/email when they are logged in.
                  */}
                                    <button
                                        onClick={() => {
                                            setUserMenuOpen(false); // close the menu first
                                            setIsLoginModalOpen(true); // then open the login modal
                                            // we'll replace this alert with a real modal later
                                        }}
                                        className="block w-full text-left hover:bg-emerald-600/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-100 font-medium hover:translate-x-1 rounded-t-xl"
                                    >
                                        Login
                                    </button>

                                    <Link
                                        to="/register"
                                        onClick={() => setUserMenuOpen(false)}
                                        className="block hover:bg-emerald-600/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-100 hover:translate-x-1 rounded-b-xl"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>
                        {/* end user dropdown */}
                    </div>
                    {/* end right controls */}
                </div>
            </div>
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLoginSuccess={() => {
                    setIsLoginModalOpen(false);
                }}
            />
        </nav>
    );
}

// ============================================================
// RECAP — what happened in Step 2?
//
// useState(false)
//   Declares a piece of state. React remembers this value
//   between re-renders. Changing it via the setter causes
//   the component to re-render with the new value.
//
// onClick={() => setUserMenuOpen((v) => !v)}
//   Every click on the User button flips the boolean.
//   React re-renders, and the dropdown appears or disappears.
//
// {userMenuOpen && <div>...</div>}
//   Short-circuit rendering. If the left side is false, React
//   renders nothing. If true, it renders the JSX on the right.
//
// onClick={() => setUserMenuOpen(false)}
//   On the menu links, we manually close the menu so it doesn't
//   stay open after the user has made their choice.
//
// KNOWN ISSUE in this step:
//   Clicking anywhere OUTSIDE the dropdown does NOT close it.
//   You have to click the User icon again to close it.
//   We fix this in Step 3 using useRef.
//
// NEXT STEP → Add the search bar, and fix the click-outside
// problem using useRef and useEffect.
// ============================================================
