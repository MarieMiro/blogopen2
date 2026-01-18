import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

import Header from "./components/Header";
import Hero from "./components/Hero";
import Features from "./components/Features";
import TrustIndex from "./components/TrustIndex";
import BenefitsBrands from "./components/BenefitsBrands";
import BenefitsBloggers from "./components/BenefitsBloggers";
import HowItWorks from "./components/HowItWorks";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

import Modal from "./components/Modal";
import LoginModal from "./components/LoginModal";

import BrandLayout from "./pages/brand/BrandLayout";
import BrandProfile from "./pages/brand/BrandProfile";
import BrandBloggers from "./pages/brand/BrandBloggers";
import BrandMessages from "./pages/brand/BrandMessages";
import BloggerProfile from "./pages/blogger/BloggerProfile";
import BloggerLayout from "./pages/blogger/BloggerLayout";
import BloggerBrands from "./pages/blogger/BloggerBrands";
import BloggerMessages from "./pages/blogger/BloggerMessages";
import BloggerPublicProfile from "./pages/brand/BloggerPublicProfile";
import BrandPublicProfile from "./pages/blogger/BrandPublicProfile";

import RequireAuth from "./components/RequireAuth";

import "./styles/main.css";


import { API_BASE } from "./api";

function App() {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [theme, setTheme] = useState("light");
  const [user, setUser] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  const handleThemeToggle = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const openSignup = () => setIsSignupOpen(true);
  const closeSignup = () => setIsSignupOpen(false);

  const openLogin = () => setIsLoginOpen(true);
  const closeLogin = () => setIsLoginOpen(false);

  const goToDashboardByRole = (role) => {
    if (role === "brand") navigate("/dashboard/brand");
    else navigate("/dashboard/blogger"); 
  };

  // АВТОЛОГИН
  useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me/`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (alive) setUser(null);
        return;
      }

      const data = await res.json(); 
      if (!alive) return;

      if (data?.ok) setUser(data);
      else setUser(null);
    } catch {
      if (alive) setUser(null);
    } finally {
      if (alive) setAuthLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, []);

  
  if (authLoading) {
    return <div className={`app ${theme}`} style={{ padding: 24 }}>Загрузка…</div>;
  }

  return (
    <div className={`app ${theme}`} id="top">
      <Routes>
        {/* Главная */}
        <Route
          path="/"
          element={
            <>
              <Header
                onThemeToggle={handleThemeToggle}
                onLoginClick={openLogin}
                theme={theme}
                user={user}
              />

              <main>
                <Hero onSignupClick={openSignup} />
                <Features />
                <TrustIndex />
                <BenefitsBrands />
                <BenefitsBloggers />
                <HowItWorks />
                <Pricing />
                <CTA onSignupClick={openSignup} />
              </main>

              <Footer />

              {/* Signup modal */}
              {isSignupOpen && (
                <Modal
                  onClose={closeSignup}
                  onSuccess={(userData) => {
                    setUser(userData);
                    closeSignup();
                    goToDashboardByRole(userData.role);
                  }}
                  onOpenLogin={() => {closeSignup();
                    openLogin();
                  }}
                />
              )}

              {/* Login modal */}
              {isLoginOpen && (
                <LoginModal
                  onClose={closeLogin}
                  onSuccess={(userData) => {
                    setUser(userData);
                    closeLogin();
                    goToDashboardByRole(userData.role);
                  }}
                />
              )}
            </>
          }
        />

        {/* Кабинет бренда */}
        <Route
          path="/dashboard/brand"
          element={
            <RequireAuth user={user}>
              <BrandLayout />
            </RequireAuth>
          }
        >
          <Route index element={<BrandProfile />} />
          <Route path="bloggers" element={<BrandBloggers />} />
          <Route path="bloggers/:id" element={<BloggerPublicProfile/>} />
          <Route path="messages" element={<BrandMessages />} />
        </Route>

        {/* Кабинет блогера */}
         <Route path="/dashboard/blogger" 
          element={
            <RequireAuth user={user}>
              <BloggerLayout/>
            </RequireAuth>
          } 
          > 
          <Route index element={<BloggerProfile />} />
          <Route path="brands" element={<BloggerBrands />} />
          <Route path="brands/:id" element={<BrandPublicProfile/>} />
          <Route path="messages" element={<BloggerMessages />} />
          </Route>
      </Routes>
    </div>
  );
}

export default App;