import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, AlertTriangle, CheckCircle, XOctagon, 
  Activity, MoreVertical, Zap, Server 
} from 'lucide-react';

// MOCK: Dados iniciais dos clientes (Futuramente virá da API/WebSocket)
const INITIAL_CLIENTS = [
  { id: 'cli-001', name: 'Bellinati Perez', environment: 'Produção', status: 'CRITICAL', metaErrors: 12, systemErrors: 2, activeQueues: 5, health: 45 },
  { id: 'cli-002', name: 'Paschoalotto', environment: 'Produção', status: 'HEALTHY', metaErrors: 0, systemErrors: 0, activeQueues: 12, health: 98 },
  { id: 'cli-003', name: 'Recovery', environment: 'Homologação', status: 'WARNING', metaErrors: 3, systemErrors: 1, activeQueues: 2, health: 75 },
  { id: 'cli-004', name: 'Banco Pan', environment: 'Produção', status: 'HEALTHY', metaErrors: 0, systemErrors: 0, activeQueues: 8, health: 95 },
  { id: 'cli-005', name: 'Itaú Unibanco', environment: 'Produção', status: 'HEALTHY', metaErrors: 1, systemErrors: 0, activeQueues: 20, health: 92 },
  { id: 'cli-006', name: 'Neon', environment: 'Dev', status: 'CRITICAL', metaErrors: 50, systemErrors: 12, activeQueues: 1, health: 20 },
];

export default function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [searchTerm, setSearchTerm] = useState('');

  // SIMULAÇÃO DE WEBSOCKET (Atualiza os cards em tempo real)
  useEffect(() => {
    const interval = setInterval(() => {
      setClients(prevClients => prevClients.map(client => {
        // Randomiza levemente os dados para parecer vivo
        const randomChange = Math.random() > 0.7;
        if (!randomChange) return client;

        const newMetaErrors = Math.max(0, client.metaErrors + (Math.random() > 0.5 ? 1 : -1));
        let newStatus = client.status;
        
        // Lógica simples de status baseada em erros
        if (newMetaErrors > 10) newStatus = 'CRITICAL';
        else if (newMetaErrors > 0) newStatus = 'WARNING';
        else newStatus = 'HEALTHY';

        return {
          ...client,
          metaErrors: newMetaErrors,
          status: newStatus,
          health: newStatus === 'HEALTHY' ? 90 + Math.floor(Math.random() * 10) : 
                  newStatus === 'WARNING' ? 60 + Math.floor(Math.random() * 20) : 
                  Math.floor(Math.random() * 50)
        };
      }));
    }, 2000); // Atualiza a cada 2 segundos

    return () => clearInterval(interval);
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-100 text-green-700 border-green-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER DA LISTA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Server className="text-blue-600" /> Monitoramento de Carteira
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão unificada de saúde dos clientes e ambientes.
          </p>
        </div>

        {/* Barra de Pesquisa */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente..."
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* GRID DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.map(client => (
          <div 
            key={client.id}
            onClick={() => navigate(`/dashboard/${client.id}`)} // Navega para o painel individual
            className="group bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Status Bar Superior */}
            <div className={`h-1.5 w-full ${
              client.status === 'HEALTHY' ? 'bg-green-500' : 
              client.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />

            <div className="p-6">
              
              {/* Cabeçalho do Card */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {client.name}
                  </h3>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {client.environment}
                  </span>
                </div>
                <div className={`p-2 rounded-full ${
                   client.status === 'HEALTHY' ? 'bg-green-50' : 
                   client.status === 'WARNING' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                   {client.status === 'HEALTHY' ? <CheckCircle size={20} className="text-green-600"/> :
                    client.status === 'WARNING' ? <AlertTriangle size={20} className="text-yellow-600"/> :
                    <XOctagon size={20} className="text-red-600"/>}
                </div>
              </div>

              {/* Métricas Principais */}
              <div className="space-y-3">
                
                {/* Erros Meta */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Activity size={14} className="text-blue-500"/>
                      Erros Meta
                   </div>
                   <span className={`text-sm font-bold ${client.metaErrors > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {client.metaErrors}
                   </span>
                </div>

                {/* Filas Ativas */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Zap size={14} className="text-yellow-500"/>
                      Filas Ativas
                   </div>
                   <span className="text-sm font-bold text-slate-700">
                      {client.activeQueues}
                   </span>
                </div>

                {/* Erros de Sistema */}
                {client.systemErrors > 0 && (
                   <div className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-100 animate-pulse">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                          <AlertTriangle size={14}/>
                          Erros Críticos
                      </div>
                      <span className="text-sm font-bold text-red-700">{client.systemErrors}</span>
                   </div>
                )}

              </div>

              {/* Health Score Visual */}
              <div className="mt-6">
                <div className="flex justify-between text-xs mb-1">
                   <span className="font-bold text-slate-500">Saúde do Ambiente</span>
                   <span className={`font-bold ${
                      client.health > 80 ? 'text-green-600' : 
                      client.health > 50 ? 'text-yellow-600' : 'text-red-600'
                   }`}>{client.health}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                   <div 
                      className={`h-1.5 rounded-full transition-all duration-1000 ${
                        client.health > 80 ? 'bg-green-500' : 
                        client.health > 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${client.health}%` }}
                   />
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}