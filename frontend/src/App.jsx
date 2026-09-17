import { useEffect } from "react";
import Homepage from "./pages/Homepage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import NavBar from "./components/layout/NavBar.jsx";
import ProductDetails from "./pages/ProductDetail.jsx";
import CheckEmail from "./pages/CheckEmail.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import SellPage from "./pages/SellPage.jsx";
import ListingPage from "./pages/ListingPage.jsx";
import Wishlist from "./pages/Wishlist.jsx";
import Checkout from "./pages/Checkout.jsx";
import Orders from "./pages/SellerOrderPage.jsx";
import MyOrders from "./pages/BuyerOrderPage.jsx";
import { Navigate, useLocation } from "react-router-dom";
import OrderChatPage from "./pages/OrderChatPage.jsx";
import InboxPage from "./pages/InboxPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}


import { NotificationProvider } from "./components/hooks/useNotification.js";

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <ScrollToTop />
          <NavBar />
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/product/:productId" element={<ProductDetails />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/listings" element={<ListingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route
              path="/chat/order/:orderId"
              element={
                <OrderChatPage />}
            />
            <Route
              path="/inbox"
              element={
                <InboxPage />
              }
            />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}