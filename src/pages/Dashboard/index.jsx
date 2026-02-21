import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { 
  Search, AlertTriangle, CheckCircle, XOctagon, 
  Activity, Zap, Server, Plus, UserPlus, Trash2 
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { clientsHmlState } = useSimulation(); // Consome o estado global da simulação
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Sincroniza a lista de clientes com o estado da simulação e dados do localStorage
  useEffect(() => {
    // Função para calcular o estado atual de cada cliente
    const syncClientsStatus = () => {
        const storedClients = JSON.parse(localStorage.getItem('orion_clients') || '[]');
        
        const clientsWithStatus = storedClients.map(client => {
            // 1. Coletar dados de HML (Simulação - Contexto Global)
            const hmlQueues = clientsHmlState[client.id] || [];
            
            // 2. Coletar dados de Produção (LocalStorage)
            const prodQueues = JSON.parse(localStorage.getItem(`orion_queues_${client.id}`) || '[]');

            // Unifica as filas para análise de saúde
            const allQueues = [...hmlQueues, ...prodQueues];
            
            // Calcula métricas consolidadas
            let status = 'IDLE';
            let activeQueues = allQueues.filter(q => q.status === 'running').length;
            let totalSpam = allQueues.reduce((acc, q) => acc + (q.spamAlerts || 0), 0);
            let blockedQueues = allQueues.filter(q => q.blocked).length;
            let completedQueues = allQueues.filter(q => q.status === 'completed').length;

            // Lógica de Semáforo (Kanban)
            if (activeQueues > 0) {
                status = 'HEALTHY'; // Verde se tiver algo rodando
            }
            if (totalSpam > 0) {
                status = 'WARNING'; // Amarelo se tiver alerta de spam
            }
            if (blockedQueues > 0 || totalSpam > 2) {
                status = 'CRITICAL'; // Vermelho se tiver bloqueio ou muito spam
            }
            // Se tudo parou, volta para IDLE (Branco), a menos que tenha finalizado com sucesso recente
            if (activeQueues === 0 && completedQueues > 0 && status === 'IDLE') {
                 // Poderíamos criar um status 'COMPLETED' se quiséssemos, mas manteremos IDLE ou HEALTHY
                 status = 'IDLE'; 
            }

            return { 
                ...client, 
                status, 
                activeQueues, 
                totalSpam,
                environment: hmlQueues.length > 0 && prodQueues.length > 0 ? 'Híbrido' : hmlQueues.length > 0 ? 'Homologação' : 'Produção'
            };
        });

        setClients(clientsWithStatus);
    };

    // Roda imediatamente e depois a cada 1 segundo para atualizar a UI em tempo real
    syncClientsStatus();
    const interval = setInterval(syncClientsStatus, 1000);

    return () => clearInterval(interval);
  }, [clientsHmlState]); // Re-executa sempre que o contexto de simulação mudar

  const handleCreateClient = (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const newClient = {
      id: `cli-${Date.now()}`,
      name: newClientName,
      environment: 'Produção', // Default inicial
      createdAt: new Date().toISOString()
    };

    const updatedClients = [...clients, newClient];
    localStorage.setItem('orion_clients', JSON.stringify(updatedClients));
    
    // Atualiza estado local imediatamente
    setClients(updatedClients);
    setNewClientName('');
    setShowNewClientModal(false);
  };

  const handleDeleteClient = (e, clientId) => {
    e.stopPropagation(); // Evita abrir o card ao clicar no lixo
    if (window.confirm('Tem certeza? Isso apagará todas as configurações e filas deste cliente permanentemente.')) {
      const updated = clients.filter(c => c.id !== clientId);
      localStorage.setItem('orion_clients', JSON.stringify(updated));
      
      // Limpa dados associados no localStorage
      localStorage.removeItem(`orion_queues_${clientId}`);
      localStorage.removeItem(`orion_stats_${clientId}`);
      
      setClients(updated);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper para estilização dos cards baseado no status
  const getCardStyle = (status) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-50 border-green-200 hover:border-green-400 ring-1 ring-green-100';
      case 'WARNING': return 'bg-yellow-50 border-yellow-200 hover:border-yellow-400 ring-1 ring-yellow-100';
      case 'CRITICAL': return 'bg-red-50 border-red-200 hover:border-red-400 ring-1 ring-red-100';
      default: return 'bg-white border-slate-200 hover:border-blue-300'; // IDLE
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Server className="text-blue-600" /> Monitoramento de Carteira
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão unificada de saúde dos clientes e ambientes de disparo.
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowNewClientModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-colors"
          >
            <UserPlus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* EMPTY STATE (Se não houver clientes) */}
      {clients.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Server size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Nenhum cliente cadastrado</h3>
          <p className="text-slate-500 mb-6">Cadastre o primeiro cliente para começar a gerenciar filas.</p>
          <button 
            onClick={() => setShowNewClientModal(true)}
            className="text-blue-600 font-bold hover:underline"
          >
            Cadastrar agora
          </button>
        </div>
      )}

      {/* GRID DE CARDS DOS CLIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.map(client => (
          <div 
            key={client.id}
            onClick={() => navigate(`/dashboard/${client.id}`)}
            className={`group rounded-2xl shadow-sm border transition-all cursor-pointer relative overflow-hidden p-6 ${getCardStyle(client.status)}`}
          >
            {/* Botão de Excluir (Visível apenas no Hover) */}
            <button 
                onClick={(e) => handleDeleteClient(e, client.id)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Excluir Cliente"
            >
                <Trash2 size={16} />
            </button>

            {/* Cabeçalho do Card */}
            <div className="flex items-start gap-3 mb-4">
               <div className={`p-2.5 rounded-lg transition-colors ${client.status === 'IDLE' ? 'bg-slate-100' : 'bg-white/60 shadow-sm'}`}>
                  <Server size={24} className={
                      client.status === 'HEALTHY' ? 'text-green-600' :
                      client.status === 'WARNING' ? 'text-yellow-600' :
                      client.status === 'CRITICAL' ? 'text-red-600' : 'text-slate-500'
                  }/>
               </div>
               <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                    {client.name}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {client.environment}
                  </span>
               </div>
            </div>

            {/* Indicador Visual de Status */}
            <div className="mb-4 h-6">
               {client.status === 'IDLE' && <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Activity size={12}/> Aguardando</span>}
               {client.status === 'HEALTHY' && <span className="text-xs font-bold text-green-700 flex items-center gap-1 animate-pulse"><CheckCircle size={12}/> Operação Saudável</span>}
               {client.status === 'WARNING' && <span className="text-xs font-bold text-yellow-700 flex items-center gap-1 animate-bounce"><AlertTriangle size={12}/> Alertas de Qualidade</span>}
               {client.status === 'CRITICAL' && <span className="text-xs font-bold text-red-700 flex items-center gap-1 animate-pulse"><XOctagon size={12}/> Risco Crítico</span>}
            </div>

            {/* Métricas Resumidas */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 p-2 rounded border border-slate-100/50">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Filas Ativas</p>
                    <p className="text-xl font-bold text-slate-700">{client.activeQueues}</p>
                </div>
                <div className={`bg-white/60 p-2 rounded border border-slate-100/50 ${client.totalSpam > 0 ? 'border-red-100 bg-red-50/50' : ''}`}>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Alertas/Spam</p>
                    <p className={`text-xl font-bold ${client.totalSpam > 0 ? 'text-red-600' : 'text-slate-700'}`}>{client.totalSpam}</p>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PARA CRIAR NOVO CLIENTE */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 scale-100 animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <UserPlus className="text-blue-600" /> Cadastrar Novo Cliente
              </h2>
              <form onSubmit={handleCreateClient}>
                 <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Cliente / Empresa</label>
                    <input 
                        autoFocus
                        type="text" 
                        className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="Ex: Bellinati Perez"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                    />
                 </div>
                 <div className="flex justify-end gap-2 pt-2">
                    <button 
                        type="button" 
                        onClick={() => setShowNewClientModal(false)}
                        className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        disabled={!newClientName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                        Criar Ambiente
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}