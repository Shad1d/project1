import { Link } from "react-router-dom";
import { Heart, Tag, User } from "lucide-react";
import {useState} from "react";

export default function Navbar() {
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
              <Link
                to="/profile"
                className="hover:text-emerald-400 transition-colors"
                title="Profile"
              >
                <User className="w-6 h-6 sm:w-7 sm:h-7" />
              </Link>
            </div>
            {/* end right side */}
          </div>
        </div>
      </nav>
    );
}