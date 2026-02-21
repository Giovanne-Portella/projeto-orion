import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, ArrowRight, Zap, BarChart3 } from 'lucide-react';

export default function Welcome() {
  const [user, setUser] = useState({ name: '', company: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('orion_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      
      {/* Cabeçalho de Boas-Vindas */}
      <div className="mb-12 animate-in slide-in-from-bottom-4 duration-700 fade-in">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3">
          Olá, <span className="text-blue-600">{user.name || 'Visitante'}</span>!
        </h1><br />
        <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
          Bem-vindo(a) ao ambiente <b>{user.company || 'Órion'}</b>. <br/><br />
          Aqui você pode gerenciar suas filas de disparo, importar mailings e acompanhar o desempenho das suas campanhas. 
        
        </p>
      </div>

    </div>
  );
}