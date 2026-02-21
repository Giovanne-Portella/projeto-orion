import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard'; // Lista de Clientes (index.jsx)
import QueueManager from './pages/Dashboard/QueueManager'; // Gerenciador do Cliente
import { authService } from './services/api';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/welcome" replace />} />
          <Route path="welcome" element={<Welcome />} />
          
          {/* ROTA 1: Painel Geral (Lista de Clientes) */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* ROTA 2: Gerenciador Específico do Cliente */}
          <Route path="dashboard/:clientId" element={<QueueManager />} />
          
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;