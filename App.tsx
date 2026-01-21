import React, { useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ContractReview from './pages/ContractReview';
import Layout from './components/Layout';

// Wrapper for Layout to handle location-based active states
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/profile" 
          element={
            <AppLayout>
              <Profile />
            </AppLayout>
          } 
        />
        <Route 
          path="/review" 
          element={
            <AppLayout>
              <ContractReview />
            </AppLayout>
          } 
        />
      </Routes>
    </HashRouter>
  );
};

export default App;