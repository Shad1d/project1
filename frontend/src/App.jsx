import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage.jsx';
import RegisterPage from './pages/Registerpage.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DemoPage from './pages/DemoPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './components/hooks/useNotification.jsx';
import SellPage from './pages/SellPage.jsx';
import ListingPage from './pages/ListingPage.jsx';
import Checkout from './pages/Checkout.jsx';
import Wishlist from './pages/Wishlist.jsx';
import MyOrders from './pages/BuyerOrderPage.jsx';
import Orders from './pages/SellerOrderPage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import OrderChatPage from './pages/OrderChatPage.jsx';

export default function App() {
  return (
    <AuthProvider>
    <NotificationProvider>
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/listings/:id" element={<ListingPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/chat/order/:id" element={<OrderChatPage />} />
        <Route path="/orders" element={<Orders />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route
              path="/chat/order/:orderId"
              element={
                  <OrderChatPage />            }
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