import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, LogOut, User, Menu, ChevronDown, RefreshCw } from 'lucide-react';
import { authService } from '../../services/api';

const MainLayout = () => {
  const [user, setUser] = useState({ name: '', company: '' });
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('orion_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const savedAvatar = localStorage.getItem('orion_avatar_seed');
    if (savedAvatar) {
      setAvatarSeed(savedAvatar);
    } else if (storedUser) {
      const initialSeed = JSON.parse(storedUser).name || 'robot';
      setAvatarSeed(initialSeed);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleRandomizeAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    setAvatarSeed(newSeed);
    localStorage.setItem('orion_avatar_seed', newSeed);
  };

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

const navItems = [
    { path: '/dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans flex flex-col">

      {/* HEADER FULL WIDTH */}
      <header className="bg-white w-full border-b border-slate-200 shadow-sm z-50 relative">
        <div className="max-w-[1440px] mx-auto h-20 px-4 md:px-6 flex items-center justify-between">

          {/* Esquerda: Menu Mobile + Logo Clicável */}
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-50"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* LOGO AGORA É UM LINK PARA /WELCOME */}
            <Link to="/welcome" className="flex items-center gap-3 w-64 group cursor-pointer hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm transform -rotate-3 transition-transform group-hover:rotate-0">
                <span className="font-bold text-xl">Ó</span>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-800 leading-none">
                  PROJETO
                </span>
                <span className="text-[10px] font-bold text-blue-600 tracking-[0.2em] uppercase leading-none mt-1">
                  Órion
                </span>
              </div>
            </Link>
          </div>

          {/* Direita: Perfil */}
          <div className="flex items-center gap-6" ref={profileMenuRef}>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-800 leading-none">
                {user.name || 'Usuário'}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-full mt-1 border border-slate-200">
                {user.company || 'Ambiente'}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden md:block" />

            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 focus:outline-none group"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 p-0.5 ring-2 ring-transparent group-hover:ring-blue-100 transition-all shadow-sm overflow-hidden">
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full bg-white" />
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <button onClick={handleRandomizeAvatar} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                    <RefreshCw size={16} /> Trocar Avatar
                  </button>
                  <div className="my-1 border-t border-slate-50" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <LogOut size={16} /> Sair do Sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-6 flex flex-1 overflow-hidden gap-6 mt-8 mb-6">

        {/* SIDEBAR (Sem o botão Início) */}
        <aside className={`
            ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform' : 'hidden'}
            md:flex md:flex-col md:w-64 md:flex-shrink-0 md:static md:bg-transparent
          `}>
          <div className="md:hidden h-20 flex items-center px-6 border-b border-slate-100 justify-between">
            <span className="text-xl font-bold text-blue-600">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)}><Menu className="h-6 w-6 text-slate-400" /></button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto md:pt-0 pt-4 px-2 md:px-0">
            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Ferramentas</p>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                      group flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'}
                    `}
                >
                  <item.icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:block mt-auto pt-4 border-t border-slate-200/50">
            <p className="text-xs text-center text-slate-400">Versão 1.0.0</p>
          </div>

          <div className="md:hidden p-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
              <p className="text-xs text-slate-400 font-medium">Versão 1.0.0</p>
            </div>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-y-auto p-6 relative">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default MainLayout;