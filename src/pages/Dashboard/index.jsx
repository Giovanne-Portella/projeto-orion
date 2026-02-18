import React, { useState, useEffect } from 'react';
import { configService, mailingService } from '../../services/api';
import { Play, Pause, PlusCircle, Trash2, Server, BarChart2, Layers, Settings, X, Zap, ChevronRight, FileText, Smartphone, Tag, Search, AlertTriangle, ShieldAlert, Activity, Eye, CheckCircle, Clock, Info, CheckCheck } from 'lucide-react';

const QUEUES_STORAGE_KEY = 'orion_dashboard_queues';
const STATS_STORAGE_KEY = 'orion_dashboard_stats';

// --- MOCK DATA PARA SIMULAÇÃO ---
const MOCK_TEMPLATES_POOL = [
  { id: 't1', name: 'Oferta Black Friday', quality: 'GREEN', body: 'Olá! Aproveite 50% OFF agora...' },
  { id: 't2', name: 'Aviso Vencimento', quality: 'GREEN', body: 'Seu boleto vence hoje. Pague agora...' },
  { id: 't3', name: 'Boas Vindas VIP', quality: 'GREEN', body: 'Bem vindo ao clube VIP...' },
  { id: 't4', name: 'Recuperação Carrinho', quality: 'GREEN', body: 'Você esqueceu itens no carrinho...' },
  { id: 't5', name: 'Pesquisa NPS', quality: 'GREEN', body: 'Nota de 0 a 10 para nosso atendimento...' },
];

const MOCK_REPORT_REASONS = [
  "Usuário denunciou como spam",
  "Bloqueio pelo destinatário",
  "Número inválido/inexistente",
  "Falha de entrega na operadora"
];

// --- COMPONENTE PRINCIPAL ---
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('prod'); // 'prod' | 'hml'
  
  // Estados Prod
  const [stats, setStats] = useState(() => {
    const savedStats = localStorage.getItem(STATS_STORAGE_KEY);
    return savedStats ? JSON.parse(savedStats) : { messagesSent: 0, connectedBms: 0, activeQueues: 0 };
  });
  const [queues, setQueues] = useState(() => {
    const savedQueues = localStorage.getItem(QUEUES_STORAGE_KEY);
    return savedQueues ? JSON.parse(savedQueues) : [];
  });
  const [segments, setSegments] = useState([]);
  
  // Estados Compartilhados UI
  const [isAddBlockModalOpen, setAddBlockModalOpen] = useState(false);
  const [queueToAddTo, setQueueToAddTo] = useState(null);
  const [selectedBlockDetail, setSelectedBlockDetail] = useState(null);

  // Estados HML
  const [hmlQueues, setHmlQueues] = useState([]);
  const [simulationLogs, setSimulationLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // --- EFEITOS (PROD) ---
  useEffect(() => {
    mailingService.getSegments().then(data => setSegments(Array.isArray(data) ? data : [])).catch(console.error);
    const handleStorageChange = (e) => {
      if (e.key === STATS_STORAGE_KEY) {
        setStats(prev => ({ ...prev, messagesSent: JSON.parse(e.newValue).messagesSent }));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues));
    setStats(prev => ({ ...prev, activeQueues: queues.filter(q => q.status === 'running').length }));
  }, [queues]);

  // --- MOTOR DE SIMULAÇÃO (HML) ---
  useEffect(() => {
    let interval;
    if (isSimulating && activeTab === 'hml') {
      interval = setInterval(() => {
        setHmlQueues(prevQueues => {
          // Verifica se todas terminaram para parar a simulação global (opcional, mantendo rodando para logs)
          const allFinished = prevQueues.every(q => q.status === 'completed' || q.status === 'blocked' || q.status === 'paused');
          
          return prevQueues.map(queue => {
            if (queue.status !== 'running') return queue;
            if (queue.blocked) return queue;

            // Identifica bloco ativo
            const activeBlockIndex = queue.activeBlockIndex || 0;
            const activeBlock = queue.blocks[activeBlockIndex];

            // Se não tem bloco, pausa
            if (!activeBlock) return { ...queue, status: 'paused' };

            // 1. Simular Disparo
            const increment = Math.floor(Math.random() * 8) + 2; 
            const newProcessed = (queue.processed || 0) + increment;
            
            // Verifica Limite do Bloco
            const limit = Math.floor(activeBlock.config.bmCapacity * (activeBlock.config.maxPercentage / 100));
            const blockProcessed = (activeBlock.processed || 0) + increment;

            // Lógica de Rodízio Multi-Bloco e Finalização
            if (blockProcessed >= limit) {
               addLog(`Fila "${queue.name}": Bloco ${activeBlockIndex + 1} atingiu limite (${limit}).`);
               
               // Se tem próximo bloco, troca
               if (activeBlockIndex < queue.blocks.length - 1) {
                   addLog(`RODÍZIO: Trocando para o Bloco ${activeBlockIndex + 2} na fila "${queue.name}".`);
                   return {
                       ...queue,
                       activeBlockIndex: activeBlockIndex + 1,
                       processed: newProcessed,
                       blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { ...b, processed: limit, status: 'completed' } : b)
                   };
               } else {
                   // --- MUDANÇA AQUI: Status vira 'completed' ---
                   addLog(`SUCESSO: Fila "${queue.name}" FINALIZADA.`);
                   return { 
                       ...queue, 
                       status: 'completed', // Fila fica Verde
                       processed: newProcessed,
                       blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { ...b, processed: limit } : b)
                   };
               }
            }

            // 2. Simular Degradação de Template
            let currentTemplate = activeBlock.template;
            let templatePool = activeBlock.templatePool || [...MOCK_TEMPLATES_POOL];
            let currentReports = activeBlock.currentReports || 0;
            let metaReports = activeBlock.metaReports || [];

            if (Math.random() < 0.15) { 
                currentReports++;
                const reason = MOCK_REPORT_REASONS[Math.floor(Math.random() * MOCK_REPORT_REASONS.length)];
                metaReports.unshift({ id: Date.now(), reason, time: new Date().toLocaleTimeString() });
                
                if (currentReports > 20 && currentTemplate.quality === 'GREEN') currentTemplate = { ...currentTemplate, quality: 'YELLOW' };
                if (currentReports > 50 && currentTemplate.quality === 'YELLOW') currentTemplate = { ...currentTemplate, quality: 'RED' };
            }

            if (currentTemplate.quality === 'RED') {
                addLog(`ALERTA: Template "${currentTemplate.name}" RED na fila "${queue.name}".`);
                const nextGreen = templatePool.find(t => t.id !== currentTemplate.id && t.quality === 'GREEN');
                if (nextGreen) {
                    addLog(`SWAP: Trocando para "${nextGreen.name}" automaticamente.`);
                    currentTemplate = nextGreen;
                    currentReports = 0; 
                } else {
                    addLog(`ERRO: Sem templates saudáveis na fila "${queue.name}".`);
                }
            }

            // 3. Simular Bloqueio de BM
            let spamCount = queue.spamAlerts || 0;
            const riskFactor = queue.name.includes('Risco') ? 0.1 : 0.005; 
            
            if (Math.random() < riskFactor) {
                spamCount++;
                addLog(`META ALERT: Denúncia de Spam na BM da fila "${queue.name}".`);
                if (spamCount >= 3) {
                    addLog(`CRÍTICO: BM Bloqueada (3 Spams). Congelando fila "${queue.name}".`);
                    return { 
                        ...queue, 
                        status: 'blocked', 
                        blocked: true, 
                        spamAlerts: spamCount,
                        blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { 
                            ...b, processed: blockProcessed, template: currentTemplate, currentReports, metaReports 
                        } : b)
                    };
                }
            }

            return {
              ...queue,
              processed: newProcessed,
              spamAlerts: spamCount,
              blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { 
                  ...b, 
                  processed: blockProcessed,
                  template: currentTemplate,
                  currentReports,
                  metaReports,
                  templatePool: templatePool.map(t => t.id === currentTemplate.id ? currentTemplate : t)
              } : b)
            };
          });
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSimulating, activeTab]);

  const addLog = (msg) => {
    setSimulationLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  const initHml = () => {
    // 1. Cenário Sucesso (Happy Path - Rápido para testar o 'completed')
    const queueSuccess = {
      id: 'hml-success', name: '1. Campanha Sucesso (Happy Path)', segmentName: 'Clientes Ativos', status: 'paused', processed: 0,
      activeBlockIndex: 0, spamAlerts: 0, blocked: false,
      blocks: [{
        id: 'b1', waba: { description: 'BM Oficial 01' }, line: { phone: '5511999990001', quality: 'GREEN' },
        template: { ...MOCK_TEMPLATES_POOL[0] }, templatePool: [...MOCK_TEMPLATES_POOL],
        config: { reportLimit: 100, maxPercentage: 100, bmCapacity: 200 }, // Capacidade baixa (200) para finalizar rápido
        processed: 0, currentReports: 0, metaReports: []
      }]
    };

    // 2. Cenário Risco
    const queueRisk = {
      id: 'hml-risk', name: '2. Cenário Risco de Banimento', segmentName: 'Base Fria', status: 'paused', processed: 0,
      activeBlockIndex: 0, spamAlerts: 0, blocked: false,
      blocks: [{
        id: 'b2', waba: { description: 'BM Teste Risco' }, line: { phone: '5511988887777', quality: 'YELLOW' },
        template: { ...MOCK_TEMPLATES_POOL[1] }, templatePool: [...MOCK_TEMPLATES_POOL],
        config: { reportLimit: 50, maxPercentage: 50, bmCapacity: 1000 }, processed: 0, currentReports: 15, metaReports: []
      }]
    };

    // 3. Cenário Swap
    const queueSwap = {
      id: 'hml-swap', name: '3. Auto-Recuperação (Template)', segmentName: 'Cobrança', status: 'paused', processed: 0,
      activeBlockIndex: 0, spamAlerts: 0, blocked: false,
      blocks: [{
        id: 'b3', waba: { description: 'BM Cobrança' }, line: { phone: '5511977776666', quality: 'GREEN' },
        template: { ...MOCK_TEMPLATES_POOL[2], quality: 'YELLOW' }, templatePool: [...MOCK_TEMPLATES_POOL],
        config: { reportLimit: 200, maxPercentage: 80, bmCapacity: 2000 }, processed: 0, currentReports: 45, metaReports: []
      }]
    };

    // 4. Cenário Rodízio
    const queueMulti = {
      id: 'hml-multi', name: '4. Rodízio Multi-BM (Capacidade)', segmentName: 'Massivo Geral', status: 'paused', processed: 0,
      activeBlockIndex: 0, spamAlerts: 0, blocked: false,
      blocks: [
        {
            id: 'b4-1', waba: { description: 'BM Principal A' }, line: { phone: '5511955554444', quality: 'GREEN' },
            template: { ...MOCK_TEMPLATES_POOL[3] }, templatePool: [...MOCK_TEMPLATES_POOL],
            config: { reportLimit: 100, maxPercentage: 10, bmCapacity: 500 }, // 10% de 500 = 50 msgs (Troca Rápida)
            processed: 0, currentReports: 0, metaReports: []
        },
        {
            id: 'b4-2', waba: { description: 'BM Reserva B' }, line: { phone: '5511944443333', quality: 'GREEN' },
            template: { ...MOCK_TEMPLATES_POOL[0] }, templatePool: [...MOCK_TEMPLATES_POOL],
            config: { reportLimit: 100, maxPercentage: 50, bmCapacity: 500 },
            processed: 0, currentReports: 0, metaReports: []
        }
      ]
    };

    setHmlQueues([queueSuccess, queueRisk, queueSwap, queueMulti]);
    setSimulationLogs(['Ambiente HML resetado.', 'Clique em "Iniciar Todas". Fila 1 e 4 configuradas para finalizar rápido.']);
    setIsSimulating(false);
  };

  const handleCreateQueue = (name, segmentId, sendsPerMinute) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!name || !segment) return alert("Dados inválidos.");
    const newQueue = {
      id: `q-${Date.now()}`, name, segmentId, segmentName: segment.name, sendsPerMinute: sendsPerMinute || 60,
      status: 'paused', activeBlockIndex: 0, processed: 0, blocks: [],
    };
    if (activeTab === 'hml') {
        setHmlQueues(prev => [...prev, newQueue]);
        addLog(`Fila Manual "${name}" criada em HML.`);
    } else {
        setQueues(prev => [...prev, newQueue]);
    }
  };

  const handleAddBlock = (queueId, newBlock) => {
    const updater = prev => prev.map(q => q.id === queueId ? { ...q, blocks: [...q.blocks, newBlock] } : q);
    if (activeTab === 'hml') setHmlQueues(updater);
    else setQueues(updater);
    setAddBlockModalOpen(false);
  };

  const handleToggleQueueStatus = (queueId) => {
    if (activeTab === 'hml') {
        setHmlQueues(prev => prev.map(q => {
            if (q.id !== queueId) return q;
            if (q.status === 'completed') return q; // Não reabre fila completada
            return { ...q, status: q.status === 'running' ? 'paused' : 'running' };
        }));
        setIsSimulating(true);
    } else {
        setQueues(prev => prev.map(q => q.id === queueId ? { ...q, status: q.status === 'running' ? 'paused' : 'running' } : q));
    }
  };

  const handleStartAllHml = () => {
      setHmlQueues(prev => prev.map(q => (q.blocked || q.status === 'completed') ? q : { ...q, status: 'running' }));
      setIsSimulating(true);
      addLog('INICIANDO TODAS AS FILAS HML (exceto bloqueadas/finalizadas).');
  };

  const handleDeleteQueue = (queueId) => {
    if (window.confirm("Remover fila?")) {
        if (activeTab === 'hml') setHmlQueues(prev => prev.filter(q => q.id !== queueId));
        else setQueues(prev => prev.filter(q => q.id !== queueId));
    }
  };

  const handleDeleteBlock = (queueId, blockId) => {
     const updater = prev => prev.map(q => q.id === queueId ? { ...q, blocks: q.blocks.filter(b => b.id !== blockId) } : q);
     if (activeTab === 'hml') setHmlQueues(updater);
     else setQueues(updater);
  };

  // --- RENDERIZAÇÃO DE STATUS ATUALIZADA ---
  const renderStatusBadge = (queue) => {
      if (queue.blocked) {
          return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><ShieldAlert size={12}/> BLOQUEADA</span>;
      }
      if (queue.status === 'completed') {
          return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1"><CheckCheck size={12}/> FINALIZADA</span>;
      }
      if (queue.status === 'running') {
          return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1"><Activity size={12}/> RODANDO</span>;
      }
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 flex items-center gap-1"><Pause size={12}/> PAUSADA</span>;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl">
            <div className="flex space-x-2">
                <button onClick={() => setActiveTab('prod')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'prod' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Zap size={18} /> Produção
                </button>
                <button onClick={() => { setActiveTab('hml'); initHml(); }} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'hml' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Activity size={18} /> Homologação (Simulação)
                </button>
            </div>
            {activeTab === 'hml' && (
                <button onClick={handleStartAllHml} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm animate-pulse">
                    <Play size={16} fill="currentColor" /> Iniciar Todas
                </button>
            )}
        </div>

        <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title={activeTab === 'prod' ? "Mensagens Enviadas" : "Envios Simulados"} 
                    value={activeTab === 'prod' ? stats.messagesSent : hmlQueues.reduce((acc, q) => acc + (q.processed || 0), 0)} 
                    icon={<BarChart2 />} color={activeTab === 'hml' ? 'purple' : 'blue'}
                />
                <StatCard 
                    title="Filas Ativas" 
                    value={activeTab === 'prod' ? stats.activeQueues : hmlQueues.filter(q => q.status === 'running').length} 
                    icon={<Play />} color={activeTab === 'hml' ? 'purple' : 'blue'}
                />
                <StatCard 
                    title="Alertas de Spam" 
                    value={activeTab === 'prod' ? 0 : hmlQueues.reduce((acc, q) => acc + (q.spamAlerts || 0), 0)} 
                    icon={<ShieldAlert />} color={activeTab === 'hml' ? 'red' : 'blue'}
                />
            </div>
        </section>

        <CreateQueueForm segments={segments} onCreateQueue={handleCreateQueue} isHml={activeTab === 'hml'} />

        {activeTab === 'hml' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2"><Activity className="text-purple-500"/> Cenários de Simulação</h2>
                    {hmlQueues.map(queue => (
                        <QueueCard 
                            key={queue.id} queue={queue} isHml={true}
                            statusBadge={renderStatusBadge(queue)}
                            onToggleStatus={() => handleToggleQueueStatus(queue.id)}
                            onDeleteQueue={() => handleDeleteQueue(queue.id)}
                            onDeleteBlock={(bid) => handleDeleteBlock(queue.id, bid)}
                            onAddBlock={() => { setQueueToAddTo(queue.id); setAddBlockModalOpen(true); }}
                            onBlockClick={setSelectedBlockDetail}
                        />
                    ))}
                </div>
                
                <div className="bg-slate-900 text-green-400 p-4 rounded-xl shadow-lg h-[600px] overflow-hidden flex flex-col font-mono text-xs border border-slate-700 sticky top-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                        <span className="font-bold flex items-center gap-2"><Server size={14}/> SYSTEM LOGS</span>
                        {isSimulating && <span className="animate-pulse text-green-500 text-[10px] uppercase">● Processing</span>}
                    </div>
                    <div className="space-y-1.5 overflow-y-auto flex-1 pr-2">
                        {simulationLogs.length === 0 && <span className="text-slate-500 opacity-50">Inicie a simulação...</span>}
                        {simulationLogs.map((log, i) => (
                            <div key={i} className="break-words border-l-2 border-slate-700 pl-2 py-0.5">
                                {log.includes('CRÍTICO') || log.includes('ALERTA') ? <span className="text-red-400 font-bold">{log}</span> :
                                 log.includes('SWAP') || log.includes('RODÍZIO') ? <span className="text-yellow-400 font-bold">{log}</span> :
                                 log.includes('SUCESSO') ? <span className="text-green-400 font-bold">{log}</span> :
                                 <span className="opacity-80">{log}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Zap size={20} className="text-yellow-500"/> Filas em Produção</h2>
                {queues.length === 0 && <p className="text-slate-500 text-center py-8 bg-white rounded-lg shadow-sm">Nenhuma fila criada.</p>}
                {queues.map(queue => (
                    <QueueCard 
                        key={queue.id} queue={queue} 
                        statusBadge={renderStatusBadge(queue)}
                        onToggleStatus={() => handleToggleQueueStatus(queue.id)}
                        onDeleteQueue={() => handleDeleteQueue(queue.id)}
                        onDeleteBlock={(bid) => handleDeleteBlock(queue.id, bid)}
                        onAddBlock={() => { setQueueToAddTo(queue.id); setAddBlockModalOpen(true); }}
                        onBlockClick={setSelectedBlockDetail}
                    />
                ))}
            </div>
        )}
      </div>

      {isAddBlockModalOpen && (
        <AddBlockModal
          queueId={queueToAddTo} onClose={() => setAddBlockModalOpen(false)} onAddBlock={handleAddBlock}
        />
      )}

      {selectedBlockDetail && (
        <BlockDetailModal block={selectedBlockDetail} onClose={() => setSelectedBlockDetail(null)} />
      )}
    </>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

const CreateQueueForm = ({ segments, onCreateQueue, isHml }) => {
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const handleSubmit = (e) => { e.preventDefault(); onCreateQueue(name, segmentId); setName(''); setSegmentId(''); };
  return (
    <section className={`p-6 rounded-xl shadow-sm border ${isHml ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
      <h2 className={`text-lg font-bold mb-4 ${isHml ? 'text-purple-800' : 'text-slate-800'}`}>{isHml ? 'Criar Fila de Simulação Manual' : 'Criar Nova Fila de Disparo'}</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2"><label className="text-sm font-bold text-slate-700">Nome da Fila</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded outline-none" placeholder="Ex: Campanha Retenção" /></div>
        <div><label className="text-sm font-bold text-slate-700">Segmento</label><select value={segmentId} onChange={e => setSegmentId(e.target.value)} className="w-full border p-2 rounded bg-white"><option value="">Selecione...</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <button type="submit" className={`text-white px-4 py-2 rounded font-bold flex items-center justify-center gap-2 hover:opacity-90 ${isHml ? 'bg-purple-600' : 'bg-blue-600'}`}><PlusCircle size={18} /> Criar Fila</button>
      </form>
    </section>
  );
};

const QueueCard = ({ queue, statusBadge, onToggleStatus, onDeleteQueue, onDeleteBlock, onAddBlock, onBlockClick, isHml }) => (
  <div className={`rounded-xl shadow-sm border transition-all ${queue.blocked ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : queue.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
    <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
      <div>
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            {queue.name}
            {queue.blocked && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide animate-pulse">Bloqueado</span>}
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-1">
            Segmento: <span className="font-bold">{queue.segmentName}</span> 
            {isHml && <span className="ml-3 px-2 py-0.5 bg-slate-200 rounded text-slate-700">Envios: {queue.processed}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {statusBadge}
        {(!queue.blocked && queue.status !== 'completed') && (
            <button onClick={onToggleStatus} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors" title={queue.status === 'running' ? "Pausar" : "Iniciar"}>
                {queue.status === 'running' ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
            </button>
        )}
        <button onClick={onDeleteQueue} className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Excluir Fila"><Trash2 size={18}/></button>
      </div>
    </div>
    <div className="p-4 overflow-x-auto">
      <div className="flex items-center gap-4">
        {queue.blocks.map((block, index) => (
          <React.Fragment key={block.id}>
            <BlockCard block={block} isActive={isHml && index === (queue.activeBlockIndex || 0) && queue.status === 'running'} isHml={isHml} onDelete={() => onDeleteBlock(block.id)} onClick={() => onBlockClick(block)} />
            {index < queue.blocks.length - 1 && <ChevronRight className="text-slate-300" />}
          </React.Fragment>
        ))}
        <button onClick={onAddBlock} className="flex-shrink-0 h-44 w-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all gap-2"><PlusCircle size={24}/><span className="text-xs font-bold uppercase">Add Bloco</span></button>
      </div>
    </div>
  </div>
);

const BlockCard = ({ block, onDelete, onClick, isActive, isHml }) => {
  const getQualityColor = (q) => q === 'GREEN' ? 'bg-green-100 text-green-700 border-green-200' : q === 'YELLOW' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200';
  return (
    <div onClick={onClick} className={`flex-shrink-0 w-72 border rounded-lg p-4 relative group cursor-pointer transition-all hover:shadow-md ${isActive ? 'bg-white border-blue-400 ring-2 ring-blue-100 shadow-lg scale-105 z-10' : 'bg-slate-50 border-slate-200'}`}>
      {!isActive && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600"><X size={12}/></button>}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 overflow-hidden"><Server size={14} className={isActive ? "text-blue-600" : "text-slate-400"}/><span className="text-sm font-bold text-slate-700 truncate">{block.waba.description}</span></div>
        <div className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{block.config.maxPercentage}% CAP</div>
      </div>
      <div className="flex justify-between items-center mb-2 bg-white p-2 rounded border border-slate-100">
         <div className="flex items-center gap-2"><Smartphone size={14} className="text-slate-400"/><span className="text-xs font-mono text-slate-600">{block.line.phone}</span></div>
         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getQualityColor(block.line.quality)}`}>{block.line.quality}</span>
      </div>
      <div className="bg-white p-2 rounded border border-slate-100 mb-2">
         <div className="flex justify-between items-center mb-1"><div className="flex items-center gap-2 overflow-hidden"><FileText size={14} className="text-slate-400"/><span className="text-xs font-bold text-slate-700 truncate">{block.template.name}</span></div><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getQualityColor(block.template.quality)}`}>{block.template.quality}</span></div>
         <p className="text-[10px] text-slate-400 pl-6 truncate">{block.template.body || '...'}</p>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
         <div className={`flex items-center gap-1.5 ${block.currentReports > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}`}><ShieldAlert size={14}/><span>Reports: {block.currentReports} / {block.config.reportLimit}</span></div><Eye size={14} className="text-blue-400"/>
      </div>
      {isHml && isActive && <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(((block.processed || 0) / (block.config.bmCapacity * (block.config.maxPercentage/100))) * 100, 100)}%` }} />}
    </div>
  );
};

// ... MANTIDOS IGUAIS (BlockDetailModal, StatCard, AddBlockModal, TemplateSelectionModal)
// (Vou incluir BlockDetailModal apenas para garantir que não quebre, os outros são idênticos)

const BlockDetailModal = ({ block, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                    <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Server className="text-blue-600"/> Detalhes do Bloco</h2><p className="text-sm text-slate-500">BM: {block.waba.description} • ID: {block.id}</p></div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-500"/></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-xs font-bold text-blue-600 uppercase mb-1">Capacidade BM</p><p className="text-2xl font-bold text-slate-800">{block.config.bmCapacity}</p><div className="w-full bg-blue-200 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-blue-600 h-full" style={{ width: `${block.config.maxPercentage}%` }}></div></div></div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100"><p className="text-xs font-bold text-purple-600 uppercase mb-1">Processados</p><p className="text-2xl font-bold text-slate-800">{block.processed || 0}</p></div>
                        <div className={`p-4 rounded-xl border ${block.currentReports > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}><p className={`text-xs font-bold uppercase mb-1 ${block.currentReports > 0 ? 'text-red-600' : 'text-green-600'}`}>Saúde (Reports)</p><p className="text-2xl font-bold text-slate-800">{block.currentReports} <span className="text-sm text-slate-400 font-normal">/ {block.config.reportLimit}</span></p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <div><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Smartphone size={16}/> Linha Utilizada</h3><div className="p-3 border rounded-lg flex justify-between items-center bg-slate-50"><span className="font-mono text-sm">{block.line.phone}</span><span className={`text-xs font-bold px-2 py-1 rounded ${block.line.quality === 'GREEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{block.line.quality}</span></div></div>
                        <div><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={16}/> Template Ativo</h3><div className="p-3 border rounded-lg bg-slate-50"><div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">{block.template.name}</span><span className={`text-xs font-bold px-2 py-1 rounded ${block.template.quality === 'GREEN' ? 'bg-green-100 text-green-700' : block.template.quality === 'YELLOW' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{block.template.quality}</span></div><p className="text-xs text-slate-500 italic">"{block.template.body}"</p></div></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ShieldAlert size={16}/> Histórico de Reports (Meta)</h3>
                        <div className="border rounded-xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 border-b flex justify-between text-xs font-bold text-slate-500"><span>MOTIVO DO REPORT</span><span>HORÁRIO</span></div>
                            <div className="max-h-48 overflow-y-auto divide-y">
                                {(!block.metaReports || block.metaReports.length === 0) ? <div className="p-6 text-center text-slate-400 flex flex-col items-center"><CheckCircle size={32} className="mb-2 text-green-400 opacity-50"/><p>Nenhum report registrado. Saúde excelente.</p></div> : 
                                block.metaReports.map((report, idx) => (<div key={idx} className="px-4 py-3 flex justify-between items-center hover:bg-red-50 transition-colors"><div className="flex items-center gap-3"><AlertTriangle size={14} className="text-red-500"/><span className="text-sm text-slate-700 font-medium">{report.reason}</span></div><div className="flex items-center gap-1 text-xs text-slate-400"><Clock size={12}/><span>{report.time}</span></div></div>))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color = 'blue' }) => {
    const colors = { blue: 'bg-blue-100 text-blue-600', purple: 'bg-purple-100 text-purple-600', red: 'bg-red-100 text-red-600' };
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className={`p-3 rounded-lg ${colors[color]}`}>{React.cloneElement(icon, { size: 24 })}</div>
            <div><p className="text-slate-500 text-sm font-medium">{title}</p><p className="text-3xl font-bold text-slate-800">{value}</p></div>
        </div>
    );
};

const AddBlockModal = ({ queueId, onClose, onAddBlock }) => {
    const [wabas, setWabas] = useState([]);
    const [lines, setLines] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedWabaId, setSelectedWabaId] = useState('');
    const [selectedLineId, setSelectedLineId] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [reportLimit, setReportLimit] = useState(1000);
    const [maxPercentage, setMaxPercentage] = useState(100); 
    const [bmCapacity, setBmCapacity] = useState(10000); 
    const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);

    useEffect(() => { configService.getWABAs().then(setWabas).catch(console.error); }, []);
    useEffect(() => { if (selectedWabaId) { configService.getLines(selectedWabaId).then(setLines).catch(console.error); configService.getTemplates(selectedWabaId).then(setTemplates).catch(console.error); } }, [selectedWabaId]);

    const handleSubmit = () => {
        if (!selectedWabaId || !selectedLineId || !selectedTemplate) return alert("Selecione BM, Linha e Template.");
        const waba = wabas.find(w => w.id === selectedWabaId);
        const line = lines.find(l => l.id === selectedLineId);
        const template = selectedTemplate;
        const newBlock = {
            id: `b-${Date.now()}`, waba: { id: waba.id, description: waba.description }, line: { id: line.id, phone: line.phone, quality: line.whatsapp_line_number_details?.quality_rating?.code || 'GREEN' },
            template: { id: template.id, name: template.name, quality: 'GREEN', body: template.body }, config: { reportLimit, maxPercentage, bmCapacity }, processed: 0, currentReports: 0, metaReports: []
        };
        onAddBlock(queueId, newBlock);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
                <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-bold">Configurar Novo Bloco</h3><button onClick={onClose}><X size={20}/></button></div>
                <select value={selectedWabaId} onChange={e => setSelectedWabaId(e.target.value)} className="w-full border p-2 rounded"><option value="">Selecione BM...</option>{wabas.map(w => <option key={w.id} value={w.id}>{w.description}</option>)}</select>
                <select value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)} className="w-full border p-2 rounded" disabled={!selectedWabaId}><option value="">Selecione Linha...</option>{lines.map(l => <option key={l.id} value={l.id}>{l.phone}</option>)}</select>
                <button onClick={() => setTemplateModalOpen(true)} className="w-full border p-2 rounded text-left" disabled={!selectedWabaId}>{selectedTemplate ? selectedTemplate.name : 'Selecionar Template...'}</button>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold">Limite Reports</label><input type="number" value={reportLimit} onChange={e => setReportLimit(Number(e.target.value))} className="w-full border p-2 rounded"/></div><div><label className="text-xs font-bold">Capacidade BM</label><input type="number" value={bmCapacity} onChange={e => setBmCapacity(Number(e.target.value))} className="w-full border p-2 rounded"/></div></div>
                <div><label className="text-xs font-bold flex justify-between">Uso Máximo (%) <span>{maxPercentage}%</span></label><input type="range" min="1" max="100" value={maxPercentage} onChange={e => setMaxPercentage(Number(e.target.value))} className="w-full accent-blue-600"/></div>
                <button onClick={handleSubmit} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Salvar Bloco</button>
            </div>
            {isTemplateModalOpen && <TemplateSelectionModal templates={templates} onClose={() => setTemplateModalOpen(false)} onSelect={(t) => { setSelectedTemplate(t); setTemplateModalOpen(false); }} />}
        </div>
    );
};

const TemplateSelectionModal = ({ templates, onClose, onSelect }) => {
    const [search, setSearch] = useState('');
    const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg w-full max-w-md h-[60vh] flex flex-col">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">Templates</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-2"><input placeholder="Buscar..." className="w-full border p-2 rounded" value={search} onChange={e => setSearch(e.target.value)} autoFocus/></div>
                <div className="overflow-y-auto flex-1 p-2">
                    {filtered.map(t => <div key={t.id} onClick={() => onSelect(t)} className="p-3 hover:bg-blue-50 cursor-pointer border-b"><p className="font-bold text-sm">{t.name}</p><p className="text-xs text-slate-500 truncate">{t.body}</p></div>)}
                </div>
            </div>
        </div>
    );
};