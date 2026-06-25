import { Link, useNavigate } from "react-router-dom";
import { Heart, Tag, User } from "lucide-react";
import {useState} from "react";

export default function Navbar() {
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    return (
      <nav className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 shadow-2xl sticky top-0 z-50 border-b border-slate-700/50">
        <div className="px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-3">
            {/* ── Logo ── */}
            {/*
            <Link> works like an <a> tag but doesn't reload the page.
            "to" is the path it navigates to when clicked.
          */}
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

            {/* ── Right side icons ── */}
            {/*
            These are static for now — they look right but clicking them
            won't do anything special yet.
          */}
            <div className="flex items-center gap-2 sm:gap-4 text-white">
              {/* Wishlist icon */}
              <Link
                to="/wishlist"
                className="hover:text-emerald-400 transition-colors"
                title="Wishlist"
              >
                <Heart className="w-6 h-6 sm:w-7 sm:h-7" />
              </Link>

              {/* Sell button */}
              {/*
              This is just a plain <Link> styled as a button for now.
              Later we'll make it open a login modal if the user is not
              logged in.
            */}
              <Link
                to="/sell"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium rounded-full transition-colors"
              >
                <Tag size={14} />
                <span className="hidden sm:inline">Sell</span>
              </Link>

              {/* User icon — no dropdown yet, just a plain link to profile */}
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
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl border border-slate-600 z-50 animate-in slide-in-from-top-2">
                    {/*
                    For now we always show the "not logged in" version.
                    In a future lesson we'll check real login state and
                    show the user's name/email when they are logged in.
                  */}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false); // close the menu first
                        alert("Login modal will go here!");
                        // we'll replace this alert with a real modal later
                      }}
                      className="block w-full text-left hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 font-medium hover:translate-x-1 rounded-t-xl"
                    >
                      Login
                    </button>

                    <Link
                      to="/register"
                      onClick={() => setUserMenuOpen(false)}
                      className="block hover:bg-slate-700/70 px-4 py-2 cursor-pointer transition-all duration-300 text-white hover:text-emerald-400 hover:translate-x-1 rounded-b-xl"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
            {/* end right side */}
          </div>
        </div>
      </nav>
    );
}