import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { mailingService, configService } from '../../services/api';
import { buildMessagePayload, sendSingleMessage } from '../../services/messageEngine';
import { parseCSV } from '../../utils/csvParser';
import {
    Play, Pause, PlusCircle, Trash2, Server, BarChart2, Zap, ChevronRight,
    FileText, Smartphone, ShieldAlert, Activity, Eye, CheckCheck,
    Clock, ArrowLeft, Database, UploadCloud, X, AlertTriangle, CheckCircle,
    Settings, Check, ListFilter, Loader2, Link as LinkIcon
} from 'lucide-react';

// --- CONSTANTES ---
const LGPD_OPTIONS = [
    { id: 1, label: "Consentimento", desc: "Quando uma pessoa consente com o tratamento de seus dados de forma livre, inequívoca e informada." },
    { id: 2, label: "Legítimo interesse", desc: "Interesse legítimo da empresa." },
    { id: 3, label: "Contrato pré-existente", desc: "Obrigação contratual." },
    { id: 4, label: "Obrigação Legal, Processo Judicial ou Proteção ao crédito", desc: "Justificável por Lei." },
    { id: 5, label: "Interesse vital ou Tutela da saúde", desc: "Proteção à vida." },
    { id: 6, label: "Interesse público", desc: "Necessidade de uma autoridade oficial." },
    { id: 7, label: "Não sei dizer / Não possuo Base Legal", desc: "" }
];

const VERIFY_LEVELS = [
    { value: '1,2,3', label: "Altíssima Propensão" },
    { value: '1,2,3', label: "Alta Propensão" },
    { value: '1,2,3', label: "Média Propensão" },
    { value: '1,2,3', label: "Baixa Propensão" },
    { value: '1,2,3', label: "Baixíssima Propensão" },
    { value: '1', label: "Sem Propensão – Sem Conta WhatsApp" }
];

const MOCK_TEMPLATES_POOL = [
    { id: 't1', name: 'Oferta Black Friday', quality: 'GREEN', body: 'Olá! Aproveite 50% OFF agora...' },
    { id: 't2', name: 'Aviso Vencimento', quality: 'GREEN', body: 'Seu boleto vence hoje. Pague agora...' },
    { id: 't3', name: 'Boas Vindas VIP', quality: 'GREEN', body: 'Bem vindo ao clube VIP...' },
];

export default function QueueManager() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('mailings');

    const { getClientQueues, setClientQueues, updateClientQueue, getClientLogs } = useSimulation();

    const QUEUES_STORAGE_KEY = `orion_queues_${clientId}`;
    const STATS_STORAGE_KEY = `orion_stats_${clientId}`;
    const MAILINGS_STORAGE_KEY = `orion_mailings_${clientId}`;

    const [clientName, setClientName] = useState('');

    // Modais
    const [isAddBlockModalOpen, setAddBlockModalOpen] = useState(false);
    const [queueToAddTo, setQueueToAddTo] = useState(null);
    const [selectedBlockDetail, setSelectedBlockDetail] = useState(null);
    const [isApiConfigModalOpen, setApiConfigModalOpen] = useState(false);
    const [isValidatorModalOpen, setValidatorModalOpen] = useState(false);
    const [activeMailing, setActiveMailing] = useState(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Estados Globais
    const [segments, setSegments] = useState([]);
    const [prodQueues, setProdQueues] = useState(() => JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]'));
    const [stats, setStats] = useState(() => JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || '{"messagesSent":0,"activeQueues":0}'));
    const [mailings, setMailings] = useState(() => JSON.parse(localStorage.getItem(MAILINGS_STORAGE_KEY) || '[]'));

    const activeRuns = useRef({}); // Controla as threads de disparo real em Produção

    // --- INIT ---
    useEffect(() => {
        const storedClients = JSON.parse(localStorage.getItem('orion_clients') || '[]');
        const client = storedClients.find(c => c.id === clientId);
        setClientName(client ? client.name : `Cliente ${clientId}`);
    }, [clientId]);

    useEffect(() => {
        mailingService.getSegments().then(data => setSegments(Array.isArray(data) ? data : [])).catch(console.error);
    }, []);

    useEffect(() => {
        localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(prodQueues));
        const activeCount = prodQueues.filter(q => q.status === 'running').length;
        setStats(prevStats => {
            const newStats = { ...prevStats, activeQueues: activeCount };
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(newStats));
            return newStats;
        });
    }, [prodQueues, clientId]);

    useEffect(() => {
        localStorage.setItem(MAILINGS_STORAGE_KEY, JSON.stringify(mailings));
    }, [mailings, clientId]);

    const currentQueues = activeTab === 'hml' ? getClientQueues(clientId) : prodQueues;
    const simulationLogs = activeTab === 'hml' ? getClientLogs(clientId) : [];

    // --- ACTIONS MAILING ---
    const handleDeleteMailing = (id) => {
        if (window.confirm('Excluir esta base? Filas atreladas a ela irão falhar.')) setMailings(prev => prev.filter(m => m.id !== id));
    };

    const handleSaveMailingConfig = (id, config) => {
        setMailings(prev => prev.map(m => m.id === id ? { ...m, apiConfig: config } : m));
        setApiConfigModalOpen(false);
    };

    const handleSaveCleanedMailing = (id, validContacts, newName) => {
        setMailings(prev => prev.map(m => m.id === id ? { ...m, name: newName, data: validContacts, count: validContacts.length, isCleaned: true } : m));
    };

    const handleInvenioUploadSuccess = (serverResult, fileData, fileName) => {
        const newMailing = {
            id: serverResult.id, name: fileName, uploadDate: new Date().toLocaleString(), count: fileData.length, data: fileData, apiConfig: null, serverData: serverResult, isCleaned: false
        };
        setMailings(prev => [...prev, newMailing]);
    };

    // --- ACTIONS FILA ---
    const handleCreateQueue = (name, mailingId) => {
        const selectedMailing = mailings.find(m => m.id === mailingId);
        if (!name || !selectedMailing) return alert("Selecione um nome e uma Base.");
        const newQueue = {
            id: `q-${Date.now()}`, name, mailingId: selectedMailing.id, mailingName: selectedMailing.name,
            totalContacts: selectedMailing.count, status: 'paused', activeBlockIndex: 0, processed: 0, spamAlerts: 0, blocks: []
        };
        if (activeTab === 'hml') setClientQueues(clientId, [...currentQueues, newQueue]);
        else setProdQueues(prev => [...prev, newQueue]);
    };

    const handleAddBlock = (queueId, newBlock) => {
        if (activeTab === 'hml') setClientQueues(clientId, currentQueues.map(q => q.id === queueId ? { ...q, blocks: [...q.blocks, newBlock] } : q));
        else setProdQueues(prev => prev.map(q => q.id === queueId ? { ...q, blocks: [...q.blocks, newBlock] } : q));
        setAddBlockModalOpen(false);
    };

    // ==============================================================================
    // MOTOR DE DISPARO REAL (PRODUÇÃO) - ESTRITAMENTE FIEL À DOCUMENTAÇÃO
    // ==============================================================================
    const runProductionQueue = async (queueId) => {
        activeRuns.current[queueId] = true;

        let queues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');
        let queueIndex = queues.findIndex(q => q.id === queueId);
        if (queueIndex === -1) return;

        const queue = queues[queueIndex];
        const mailing = mailings.find(m => m.id === queue.mailingId);
        if (!mailing || !mailing.apiConfig || !mailing.isCleaned) return;

        const contacts = mailing.data; // Base limpa
        let currentIdx = queue.processed || 0;

        // 1. Coleta o Private Token
        let privateToken = '';
        try {
            const settings = await configService.getSettings();
            privateToken = settings.private_token;
        } catch (err) {
            alert("Falha ao buscar Private Token. Verifique as configurações da Invenio.");
            activeRuns.current[queueId] = false;
            setProdQueues(prev => prev.map(q => q.id === queueId ? { ...q, status: 'paused' } : q));
            return;
        }

        // 2. GARANTE O BEARER TOKEN ESTRITO (Lendo a chave 'orion_token' do seu api.js)
        const bearerToken = localStorage.getItem('orion_token');
        if (!bearerToken || bearerToken === 'null' || bearerToken === 'undefined') {
            alert("🚨 ERRO DE AUTENTICAÇÃO: O token (orion_token) não foi encontrado!\n\nFaça Logout e Login novamente.");
            activeRuns.current[queueId] = false;
            setProdQueues(prev => prev.map(q => q.id === queueId ? { ...q, status: 'paused' } : q));
            return;
        }

        // 3. Loop de Disparo Contínuo
        while (currentIdx < contacts.length && activeRuns.current[queueId]) {
            queues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');
            queueIndex = queues.findIndex(q => q.id === queueId);
            const currentQueue = queues[queueIndex];

            if (currentQueue.status !== 'running') {
                activeRuns.current[queueId] = false;
                break;
            }

            const contact = contacts[currentIdx];
            let activeBlock = currentQueue.blocks[currentQueue.activeBlockIndex || 0];
            const config = mailing.apiConfig;

            // Substituição de Variáveis no Texto (se houver)
            let messageText = config.values.text || "";
            if (messageText) {
                Object.keys(contact).forEach(col => {
                    messageText = messageText.replace(new RegExp(`\\[${col}\\]`, 'g'), contact[col] || "");
                });
            }

            // 4. Montagem Estrita do Payload SendMessage JSON (Idêntico ao CURL)
            const payload = {
                invenioPrivateToken: privateToken,
                text: messageText, // Pode ser enviado vazio "" sem dar erro
                emailSubject: "",
                channel: 3, // 3 = WhatsApp
                templateName: activeBlock.template.name,
                attendantUserName: config.include.discardSettings ? (config.values.attendantUserName || "") : "",

                // Array de Parâmetros do Template
                templateParameters: config.include.templateParameters ?
                    config.templateParams.map(p => p.column ? String(contact[p.column]) : "") : [],

                source: {
                    countryCode: 55,
                    phoneNumber: Number(activeBlock.line.phone.replace(/\D/g, '')),
                    prospect: false
                },
                destination: {
                    countryCode: 55,
                    phoneNumber: Number(String(contact[config.values.phoneColumn]).replace(/\D/g, '')),
                    email: ""
                }
            };

            // Bloco Contact
            if (config.include.contact) {
                payload.contact = {
                    name: config.values.contactNameColumn ? contact[config.values.contactNameColumn] : "",
                    customCode: config.values.customCodeColumn ? contact[config.values.customCodeColumn] : "",
                    id: config.values.documentColumn ? contact[config.values.documentColumn] : "",
                    tag: config.values.tagColumn ? contact[config.values.tagColumn] : "",
                    jokers: config.jokers.map(j => j.column ? String(contact[j.column]) : ""), // Array fixo de 5
                    walletClientCode: config.values.walletClientCode || "comercial",
                    updateIfExists: true
                };
            }

            // Bloco DiscardSettings
            if (config.include.discardSettings) {
                payload.discardSettings = {
                    recentContactLastHours: Number(config.values.recentContactLastHours) || 0,
                    InAttendance: config.values.inAttendance || false
                };
            }

            // 5. Chamada HTTP REAL para a API Robbu
            try {
                console.log(`[PROD] Disparando SendMessage para ${payload.destination.phoneNumber}...`, payload);

                const response = await fetch('https://api.robbu.global/v1/sendmessage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${bearerToken}` // O TOKEN CORRETO É INJETADO AQUI
                    },
                    body: JSON.stringify(payload)
                });

                // Status 200 (Sucesso) ou outro status
                if (response.ok) {
                    const resultData = await response.json();
                    if (resultData.success !== false) {
                        currentQueue.processed = (currentQueue.processed || 0) + 1;
                        activeBlock.processed = (activeBlock.processed || 0) + 1;
                    } else {
                        console.error(`Erro lógico na API para ${payload.destination.phoneNumber}:`, resultData);
                        currentQueue.processed = (currentQueue.processed || 0) + 1;
                    }
                } else {
                    console.error(`HTTP Error ${response.status} para ${payload.destination.phoneNumber}`);
                    if (response.status === 401) {
                        alert("Acesso Negado (401). O Token expirou ou é inválido. Faça login novamente.");
                        activeRuns.current[queueId] = false;
                        currentQueue.status = 'paused';
                    } else {
                        currentQueue.processed = (currentQueue.processed || 0) + 1;
                        activeBlock.currentReports = (activeBlock.currentReports || 0) + 1;
                    }
                }
            } catch (err) {
                console.error("Falha de Rede na Requisição HTTP:", err);
                currentQueue.processed = (currentQueue.processed || 0) + 1;
            }

            // 6. Rotacionamento de Bloco / Finalização
            const limit = Math.floor(activeBlock.config.bmCapacity * (activeBlock.config.maxPercentage / 100));
            if (activeBlock.processed >= limit) {
                if (currentQueue.activeBlockIndex < currentQueue.blocks.length - 1) {
                    currentQueue.activeBlockIndex++;
                } else {
                    currentQueue.status = 'completed';
                    activeRuns.current[queueId] = false;
                }
            }

            // 7. Salva o progresso
            queues[queueIndex] = currentQueue;
            localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues));
            setProdQueues([...queues]);

            currentIdx++;
            await new Promise(res => setTimeout(res, 1000)); // Rate limit 1 req/segundo
        }
    };

    const handleToggleQueueStatus = (queueId) => {
        const isHml = activeTab === 'hml';
        const queueList = isHml ? currentQueues : prodQueues;
        const targetQueue = queueList.find(q => q.id === queueId);
        if (!targetQueue || targetQueue.status === 'completed' || targetQueue.blocked) return;

        const isStarting = targetQueue.status !== 'running';

        if (isStarting) {
            if (targetQueue.blocks.length === 0) return alert('Adicione um bloco de envio antes de dar Play.');
            const linkedMailing = mailings.find(m => m.id === targetQueue.mailingId);
            if (!linkedMailing) return alert('A base atrelada a esta fila foi excluída.');
            if (!linkedMailing.apiConfig) return alert(`A base "${linkedMailing.name}" não possui a SendMessage configurada.`);
            if (!linkedMailing.isCleaned) return alert(`Suba a base final limpa no Validator antes de iniciar.`);
        }

        if (isHml) {
            updateClientQueue(clientId, { ...targetQueue, status: isStarting ? 'running' : 'paused' });
        } else {
            // MODO PRODUÇÃO
            setProdQueues(prev => {
                const next = prev.map(q => {
                    if (q.id !== queueId) return q;
                    if (isStarting) {
                        setTimeout(() => runProductionQueue(queueId), 0);
                    } else {
                        activeRuns.current[queueId] = false;
                    }
                    return { ...q, status: isStarting ? 'running' : 'paused' };
                });
                return next;
            });
        }
    };

    const handleDeleteQueue = (queueId) => {
        if (window.confirm("Remover fila?")) {
            activeRuns.current[queueId] = false;
            if (activeTab === 'hml') setClientQueues(clientId, currentQueues.filter(q => q.id !== queueId));
            else setProdQueues(prev => prev.filter(q => q.id !== queueId));
        }
    };

    const handleDeleteBlock = (qId, bId) => {
        const updater = qs => qs.map(q => q.id === qId ? { ...q, blocks: q.blocks.filter(b => b.id !== bId) } : q);
        if (activeTab === 'hml') setClientQueues(clientId, updater(currentQueues));
        else setProdQueues(prev => updater(prev));
    };

    const initHml = () => {
        if (getClientQueues(clientId).length > 0) return;
        const mockMailing = { id: 'mock-1', name: 'Base VIP Mockada', count: 500, isCleaned: true, apiConfig: { include: { text: true }, values: { phoneColumn: 'telefone', text: '' }, jokers: [] } };
        setMailings(prev => [...prev, mockMailing]);
        setClientQueues(clientId, [{
            id: `hml-s-${clientId}`, name: 'Campanha Sucesso', mailingId: mockMailing.id, mailingName: mockMailing.name, totalContacts: 500, status: 'paused', processed: 0,
            activeBlockIndex: 0, spamAlerts: 0, blocked: false,
            blocks: [{ id: 'b1', waba: { description: 'BM Oficial' }, line: { phone: '55119999', quality: 'GREEN' }, template: MOCK_TEMPLATES_POOL[0], config: { reportLimit: 100, maxPercentage: 100, bmCapacity: 200 }, processed: 0, currentReports: 0, metaReports: [] }]
        }]);
    };

    const renderStatusBadge = (q) => {
        if (q.blocked) return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><ShieldAlert size={12} /> BLOQUEADA</span>;
        if (q.status === 'completed') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1"><CheckCheck size={12} /> FINALIZADA</span>;
        if (q.status === 'running') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1"><Activity size={12} /> RODANDO</span>;
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 flex items-center gap-1"><Pause size={12} /> PAUSADA</span>;
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded hover:bg-slate-100 text-slate-500"><ArrowLeft size={24} /></button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{clientName}</h1>
                    <p className="text-sm text-slate-500">Workspace do Cliente • ID: {clientId}</p>
                </div>
            </div>

            <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl">
                <div className="flex space-x-2 overflow-x-auto">
                    <button onClick={() => setActiveTab('mailings')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'mailings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}><Database size={18} /> Bases / Mailings</button>
                    <div className="w-px h-6 bg-slate-300 mx-2 self-center hidden sm:block"></div>
                    <button onClick={() => setActiveTab('prod')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'prod' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Zap size={18} /> Produção</button>
                    <button onClick={() => { setActiveTab('hml'); initHml(); }} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'hml' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}><Activity size={18} /> Homologação</button>
                </div>
            </div>

            {/* --- ABA MAILINGS --- */}
            {activeTab === 'mailings' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2"><Database size={20} /> Bases do Cliente</h2>
                            <p className="text-emerald-600 text-sm mt-1">Importe via Invenio API, limpe e configure o payload SendMessage.</p>
                        </div>
                        <button onClick={() => setIsUploadModalOpen(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md">
                            <UploadCloud size={20} /> Importar Público
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mailings.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">Nenhuma base importada.</div>}
                        {mailings.map(m => (
                            <div key={m.id} className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                                <div className="p-5 flex-1 relative">
                                    <FileText size={24} className="text-emerald-500 mb-3" />
                                    <h3 className="font-bold text-slate-800 text-lg truncate pr-6">{m.name}</h3>
                                    <p className="text-sm font-bold text-slate-600 mt-2">{m.count.toLocaleString()} contatos válidos</p>

                                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold w-max">
                                            {m.serverData ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-yellow-500" />}
                                            <span className={m.serverData ? 'text-green-700' : 'text-slate-500'}>Invenio: {m.serverData ? 'Processado' : 'Apenas Local'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold w-max">
                                            {m.isCleaned ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-orange-500 animate-pulse" />}
                                            <span className={m.isCleaned ? 'text-green-700' : 'text-orange-600'}>Validator: {m.isCleaned ? 'Limpo (Upload OK)' : 'Aguardando Upload Limpo'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold w-max">
                                            {m.apiConfig ? <CheckCircle size={14} className="text-blue-500" /> : <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                                            <span className={m.apiConfig ? 'text-blue-700' : 'text-red-600'}>SendMessage: {m.apiConfig ? 'Configurado' : 'Pendente'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 border-t border-slate-200 p-3 grid grid-cols-2 gap-2">
                                    <button onClick={() => { setActiveMailing(m); setValidatorModalOpen(true); }} className="bg-white border border-slate-300 text-slate-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-2 hover:text-blue-600 shadow-sm"><ListFilter size={14} /> Base Limpa</button>
                                    <button onClick={() => { setActiveMailing(m); setApiConfigModalOpen(true); }} className="bg-white border border-slate-300 text-slate-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-2 hover:text-blue-600 shadow-sm"><Settings size={14} /> Setup API</button>
                                    <button onClick={() => handleDeleteMailing(m.id)} className="col-span-2 border border-slate-200 text-slate-400 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs flex justify-center items-center gap-1"><Trash2 size={14} /> Excluir Base</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- ABA PRODUÇÃO --- */}
            {activeTab === 'prod' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Mensagens Enviadas" value={prodQueues.reduce((acc, q) => acc + (q.processed || 0), 0)} icon={<BarChart2 />} color="blue" />
                        <StatCard title="Filas Ativas" value={stats.activeQueues} icon={<Play />} color="blue" />
                        <StatCard title="Bases Prontas" value={mailings.filter(m => m.apiConfig && m.isCleaned).length} icon={<Database />} color="emerald" />
                    </div>
                    <CreateQueueForm mailings={mailings} onCreateQueue={handleCreateQueue} isHml={false} />
                    {currentQueues.map(queue => (
                        <QueueCard key={queue.id} queue={queue} statusBadge={renderStatusBadge(queue)} onToggleStatus={() => handleToggleQueueStatus(queue.id)} onDeleteQueue={() => handleDeleteQueue(queue.id)} onDeleteBlock={(bid) => handleDeleteBlock(queue.id, bid)} onAddBlock={() => { setQueueToAddTo(queue.id); setAddBlockModalOpen(true); }} onBlockClick={setSelectedBlockDetail} />
                    ))}
                </div>
            )}

            {/* --- ABA HML --- */}
            {activeTab === 'hml' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                    <div className="lg:col-span-2 space-y-6">
                        <CreateQueueForm mailings={mailings} onCreateQueue={handleCreateQueue} isHml={true} />
                        {currentQueues.map(queue => (
                            <QueueCard key={queue.id} queue={queue} isHml={true} statusBadge={renderStatusBadge(queue)} onToggleStatus={() => handleToggleQueueStatus(queue.id)} onDeleteQueue={() => handleDeleteQueue(queue.id)} onDeleteBlock={(bid) => handleDeleteBlock(queue.id, bid)} onAddBlock={() => { setQueueToAddTo(queue.id); setAddBlockModalOpen(true); }} onBlockClick={setSelectedBlockDetail} />
                        ))}
                    </div>
                    <div className="bg-slate-900 text-green-400 p-4 rounded-xl shadow-lg h-[600px] overflow-auto font-mono text-xs">
                        <div className="font-bold flex items-center gap-2 border-b border-slate-700 pb-2 mb-2"><Server size={14} /> SYSTEM LOGS</div>
                        {simulationLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                    </div>
                </div>
            )}

            {isAddBlockModalOpen && <AddBlockModal queueId={queueToAddTo} onClose={() => setAddBlockModalOpen(false)} onAddBlock={handleAddBlock} />}
            {selectedBlockDetail && <BlockDetailModal block={selectedBlockDetail} onClose={() => setSelectedBlockDetail(null)} />}

            {/* MODAIS INVENIO E PAYLOAD */}
            {isUploadModalOpen && (
                <InvenioUploadModal
                    segments={segments}
                    onClose={() => setIsUploadModalOpen(false)}
                    onSuccess={handleInvenioUploadSuccess}
                />
            )}

            {isValidatorModalOpen && activeMailing && (
                <MailingUploadCleanModal mailing={activeMailing} onClose={() => setValidatorModalOpen(false)} onClean={handleSaveCleanedMailing} />
            )}

            {isApiConfigModalOpen && activeMailing && (
                <SendMessageConfigModal mailing={activeMailing} onClose={() => setApiConfigModalOpen(false)} onSave={handleSaveMailingConfig} />
            )}
        </div>
    );
}

// ============================================================================
// MODAIS DE IMPORTAÇÃO E VALIDAÇÃO (Restaurando Lógica e UI do PDF)
// ============================================================================

const InvenioUploadModal = ({ segments, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        description: '',
        wallet_id: '',
        lgpd_auth: false,
        wallet_unique_confirmation: false,
        clear_hashtag: false,
        robbu_verify: false,
        verify_options: '1,2,3',
        lgpd_type: 1
    });

    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [status, setStatus] = useState('idle');

    const handleFileChange = async (e) => {
        const f = e.target.files[0];
        setFile(f);
        if (f) {
            const parsed = await parseCSV(f);
            setParsedData(parsed.data);
        }
    };

    const handleUpload = async () => {
        if (!file || !formData.wallet_id || !formData.description) return alert('Preencha Descrição, Segmento e Arquivo.');
        setStatus('uploading');

        try {
            const form = new FormData();
            form.append('description', formData.description);
            form.append('wallet_id', formData.wallet_id);
            form.append('file', file);
            form.append('wallet_unique_confirmation', String(formData.wallet_unique_confirmation));
            form.append('clear_hashtag', String(formData.clear_hashtag));
            form.append('robbu_verify', String(formData.robbu_verify));

            if (formData.robbu_verify) {
                form.append('verify_options', formData.verify_options);
            }

            form.append('lgpd_type', formData.lgpd_auth ? String(formData.lgpd_type) : '7');

            const response = await mailingService.uploadMailing(form);
            const mailingId = response.data.id;

            setStatus('polling');
            pollMailingStatus(mailingId);
        } catch (error) {
            setStatus('error');
            alert("Falha na importação.");
        }
    };

    const pollMailingStatus = async (id) => {
        const check = async () => {
            try {
                const res = await mailingService.checkStatus([id]);
                const item = res[0];

                if (item.status === 'I') {
                    setStatus('success');
                    setTimeout(() => {
                        onSuccess(item, parsedData, file.name);
                        onClose();
                    }, 2000);
                } else if (item.status === 'E') {
                    setStatus('error');
                    alert("A Invenio reportou Erro de formatação no arquivo.");
                } else {
                    setTimeout(check, 3000);
                }
            } catch (err) {
                setStatus('error');
            }
        };
        check();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-in fade-in p-4">
            <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-2xl text-slate-800">Importar Público</h3>
                    <button onClick={onClose} disabled={status === 'polling' || status === 'uploading'} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>

                {status === 'idle' || status === 'error' ? (
                    <div className="space-y-5">
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label>
                            <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Segmento</label>
                            <select value={formData.wallet_id} onChange={e => setFormData({ ...formData, wallet_id: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">Selecione</option>
                                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Arquivo (csv..txt)</label>
                            <div className="border border-slate-300 p-2 rounded-md flex items-center justify-between bg-slate-50">
                                <span className="text-slate-500 text-sm truncate px-2">{file ? file.name : 'Nenhum arquivo selecionado'}</span>
                                <label className="bg-slate-200 px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-slate-300 text-slate-700">
                                    Selecionar
                                    <input type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-slate-200 pt-5">
                            <h4 className="font-bold text-sm text-slate-800 mb-1">Autorização de processamento - LGPD e GDPR</h4>
                            <p className="text-xs text-slate-500 mb-4">Para armazenar as informações importadas, seguimos as diretrizes das principais leis de proteção de dados.</p>

                            <label className="flex items-start gap-3 cursor-pointer mb-2">
                                <input type="checkbox" className="mt-1 accent-blue-600 w-4 h-4" checked={formData.lgpd_auth} onChange={e => setFormData({ ...formData, lgpd_auth: e.target.checked })} />
                                <span className="text-sm text-slate-700">Minha empresa possui autorização para processamento e comunicação com o público</span>
                            </label>

                            {formData.lgpd_auth && (
                                <div className="ml-7 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Base Legal:</label>
                                    <select value={formData.lgpd_type} onChange={e => setFormData({ ...formData, lgpd_type: Number(e.target.value) })} className="w-full border p-1.5 rounded text-sm bg-white">
                                        {LGPD_OPTIONS.map(o => <option key={o.id} value={o.id} title={o.desc}>{o.label}</option>)}
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1">{LGPD_OPTIONS.find(o => o.id === formData.lgpd_type)?.desc}</p>
                                </div>
                            )}

                            <label className="flex items-start gap-3 cursor-pointer mb-2">
                                <input type="checkbox" className="mt-1 accent-blue-600 w-4 h-4" checked={formData.robbu_verify} onChange={e => setFormData({ ...formData, robbu_verify: e.target.checked })} />
                                <span className="text-sm text-slate-700"><b>Invenio Verify</b> Potencialize a qualidade de entrega da sua campanha</span>
                            </label>

                            {formData.robbu_verify && (
                                <div className="ml-7 mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Opção de Verificação:</label>
                                    <select value={formData.verify_options} onChange={e => setFormData({ ...formData, verify_options: e.target.value })} className="w-full border p-1.5 rounded text-sm bg-white">
                                        {VERIFY_LEVELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            )}

                            <label className="flex items-start gap-3 cursor-pointer mb-2">
                                <input type="checkbox" className="mt-1 accent-blue-600 w-4 h-4" checked={formData.wallet_unique_confirmation} onChange={e => setFormData({ ...formData, wallet_unique_confirmation: e.target.checked })} />
                                <span className="text-sm text-slate-700">Manter apenas neste segmento</span>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" className="mt-1 accent-blue-600 w-4 h-4" checked={formData.clear_hashtag} onChange={e => setFormData({ ...formData, clear_hashtag: e.target.checked })} />
                                <span className="text-sm text-slate-700">Limpar tags e campos dinâmicos do mailing</span>
                            </label>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t mt-6">
                            <a href="#" className="text-blue-600 text-sm hover:underline flex items-center gap-1"><LinkIcon size={14} /> Links Relacionados</a>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-md">Cancelar</button>
                                <button onClick={handleUpload} className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 shadow-sm">Importar</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        {status === 'success' ? (
                            <><CheckCircle size={56} className="text-green-500 mx-auto mb-4 animate-bounce" /><h3 className="font-bold text-2xl text-slate-800">Processado!</h3></>
                        ) : (
                            <><Loader2 size={56} className="text-blue-500 mx-auto mb-4 animate-spin" /><h3 className="font-bold text-xl text-slate-800">{status === 'uploading' ? 'Enviando arquivo...' : 'Processando na Invenio...'}</h3><p className="text-sm text-slate-500 mt-2">Aguarde a finalização.</p></>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// 2. O Upload da Base Limpa (Local)
const MailingUploadCleanModal = ({ mailing, onClose, onClean }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => setFile(e.target.files[0]);

    const processFile = async () => {
        if (!file) return alert("Selecione o arquivo CSV limpo para upload.");
        setLoading(true);
        try {
            const parsed = await parseCSV(file);
            setTimeout(() => {
                onClean(mailing.id, parsed.data, file.name);
                alert(`Base limpa inserida com sucesso! ${parsed.data.length} contatos prontas para disparo.`);
                onClose();
            }, 800);
        } catch (error) {
            alert("Erro ao ler o arquivo CSV limpo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-in fade-in p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg">
                <div className="flex justify-between mb-4"><h3 className="font-bold text-xl flex items-center gap-2"><ListFilter className="text-blue-600" /> Inserir Base Limpa</h3><button onClick={onClose}><X /></button></div>
                <p className="text-sm text-slate-500 mb-6">Acesse os links da Invenio, higienize sua base localmente e faça o upload do arquivo final aqui.</p>

                {mailing.serverData && mailing.serverData.download_results && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
                        <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">Links Gerados (API Invenio):</p>
                        <div className="space-y-2">
                            {mailing.serverData.download_results.map((r, i) => (
                                <a key={i} href={r.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline bg-white p-2 rounded border border-blue-100 shadow-sm"><LinkIcon size={14} /> {r.name}</a>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50 p-6 rounded-xl flex flex-col items-center">
                    <CheckCircle className="text-emerald-500 mb-2" size={32} />
                    <label className="text-sm font-bold text-center w-full cursor-pointer text-emerald-800">
                        Fazer upload do CSV final limpo
                        <input type="file" accept=".csv" onChange={handleFileChange} className="text-xs block mt-3 mx-auto text-emerald-600" />
                    </label>
                </div>

                <button onClick={processFile} disabled={loading || !file} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold mt-6 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {loading ? 'Carregando...' : 'Confirmar Base Limpa'}
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// MODAL PAYLOAD (Fiel à documentação SendMessage JSON)
// ============================================================================
const SendMessageConfigModal = ({ mailing, onClose, onSave }) => {
    const csvHeaders = mailing.data && mailing.data.length > 0 ? Object.keys(mailing.data[0]) : [];

    // Formato exato para o messageEngine (Text foi removido a obrigatoriedade de preenchimento)
    const [payloadOptions, setPayloadOptions] = useState(mailing.apiConfig || {
        include: {
            text: true,
            templateParameters: false,
            contact: false,
            discardSettings: false
        },
        values: {
            text: '', // Campo opcional no form, mas a API recebe "" se vazio
            phoneColumn: '',
            contactNameColumn: '',
            documentColumn: '',
            customCodeColumn: '',
            tagColumn: '',
            walletClientCode: 'comercial',
            attendantUserName: '',
            recentContactLastHours: 0,
            inAttendance: false
        },
        templateParams: [],
        jokers: [
            { name: 'CORINGA1', column: '' }, { name: 'CORINGA2', column: '' }, { name: 'CORINGA3', column: '' }, { name: 'CORINGA4', column: '' }, { name: 'CORINGA5', column: '' }
        ]
    });

    const updateValue = (field, val) => setPayloadOptions(prev => ({ ...prev, values: { ...prev.values, [field]: val } }));
    const updateInclude = (field, val) => setPayloadOptions(prev => ({ ...prev, include: { ...prev.include, [field]: val } }));

    const handleSave = () => {
        if (!payloadOptions.values.phoneColumn) return alert("Selecione a coluna de telefone (Destination PhoneNumber).");
        onSave(mailing.id, payloadOptions);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-in fade-in p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Settings className="text-blue-600" /> Setup SendMessage JSON</h3><button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X size={20} /></button></div>
                <p className="text-sm text-slate-500 mb-6">Mapeamento para <b>"{mailing.name}"</b>. As chaves `invenioPrivateToken`, `source`, `destination` e `templateName` são inseridas automaticamente pelo motor de disparo.</p>

                <div className="space-y-4">
                    {/* Bloco Obrigatório Base */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <h4 className="font-bold text-sm text-blue-800 mb-3 border-b pb-2">Dados Base</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold block mb-1">Coluna de Telefone (Destination) *</label>
                                <select value={payloadOptions.values.phoneColumn} onChange={e => updateValue('phoneColumn', e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none">
                                    <option value="">Selecionar coluna CSV...</option>
                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold block mb-1">Texto Principal (Text - Opcional)</label>
                                <input value={payloadOptions.values.text} onChange={e => updateValue('text', e.target.value)} placeholder="Use [COLUNA] para varíaveis." className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* HSM Params */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-center mb-3">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-blue-600" checked={payloadOptions.include.templateParameters} onChange={e => updateInclude('templateParameters', e.target.checked)} /><span className="text-sm font-bold text-slate-800">Parâmetros do Template HSM (Variáveis)</span></label>
                            {payloadOptions.include.templateParameters && <button onClick={() => setPayloadOptions({ ...payloadOptions, templateParams: [...payloadOptions.templateParams, { name: '', column: '' }] })} className="text-blue-600 text-xs font-bold bg-blue-100 px-3 py-1.5 rounded-lg">+ Add Parâmetro</button>}
                        </div>
                        {payloadOptions.include.templateParameters && payloadOptions.templateParams.map((p, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                                <input value={p.name} onChange={e => { const np = [...payloadOptions.templateParams]; np[index].name = e.target.value; setPayloadOptions({ ...payloadOptions, templateParams: np }); }} placeholder="Nome da Var (HSM)" className="border p-2 rounded-lg w-1/3 text-xs" />
                                <select value={p.column} onChange={e => { const np = [...payloadOptions.templateParams]; np[index].column = e.target.value; setPayloadOptions({ ...payloadOptions, templateParams: np }); }} className="border p-2 rounded-lg w-2/3 text-xs"><option value="">Mapear Coluna CSV...</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                <button onClick={() => setPayloadOptions({ ...payloadOptions, templateParams: payloadOptions.templateParams.filter((_, i) => i !== index) })} className="text-red-500 hover:bg-red-100 p-2 rounded"><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>

                    {/* Bloco Contact */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <label className="flex items-center gap-2 cursor-pointer w-full mb-3"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={payloadOptions.include.contact} onChange={e => updateInclude('contact', e.target.checked)} /><span className="text-sm font-bold text-slate-800">Ativar "contact" object (CRM Metadata)</span></label>
                        {payloadOptions.include.contact && (
                            <>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 mb-4">
                                    <div><label className="text-xs font-bold block mb-1">Nome (name)</label><select value={payloadOptions.values.contactNameColumn} onChange={e => updateValue('contactNameColumn', e.target.value)} className="w-full border p-2 rounded text-sm"><option value="">Nenhuma</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="text-xs font-bold block mb-1">Documento (id)</label><select value={payloadOptions.values.documentColumn} onChange={e => updateValue('documentColumn', e.target.value)} className="w-full border p-2 rounded text-sm"><option value="">Nenhuma</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="text-xs font-bold block mb-1">Tag</label><select value={payloadOptions.values.tagColumn} onChange={e => updateValue('tagColumn', e.target.value)} className="w-full border p-2 rounded text-sm"><option value="">Nenhuma</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                    <div><label className="text-xs font-bold block mb-1">Custom Code</label><select value={payloadOptions.values.customCodeColumn} onChange={e => updateValue('customCodeColumn', e.target.value)} className="w-full border p-2 rounded text-sm"><option value="">Nenhuma</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                                </div>
                                <h4 className="font-bold text-xs text-slate-600 mb-2">Jokers (Posições Fixas)</h4>
                                {payloadOptions.jokers.map((joker, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input value={joker.name} disabled className="border border-slate-300 p-2 rounded-lg w-1/3 bg-slate-100 text-xs font-mono font-bold text-center text-slate-500" />
                                        <select value={joker.column} onChange={e => { const nj = [...payloadOptions.jokers]; nj[index].column = e.target.value; setPayloadOptions({ ...payloadOptions, jokers: nj }); }} className="border border-slate-300 p-2 rounded-lg w-2/3 text-xs bg-white"><option value="">Deixar Vazio...</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Discard & InAttendance */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <label className="flex items-center gap-2 cursor-pointer w-full"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={payloadOptions.include.discardSettings} onChange={e => updateInclude('discardSettings', e.target.checked)} /><span className="text-sm font-bold text-slate-800">Ativar "discardSettings" object</span></label>
                        {payloadOptions.include.discardSettings && (
                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                                <div><label className="text-xs font-bold block mb-1">attendantUserName (Filtro)</label><input value={payloadOptions.values.attendantUserName} onChange={e => updateValue('attendantUserName', e.target.value)} placeholder="Ex: robbu_bot" className="w-full border border-slate-300 p-2 rounded text-sm bg-white" /></div>
                                <div><label className="text-xs font-bold block mb-1">recentContactLastHours</label><input type="number" value={payloadOptions.values.recentContactLastHours} onChange={e => updateValue('recentContactLastHours', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm bg-white" /></div>
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-full mt-4 pt-4 border-t border-slate-200"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={payloadOptions.values.inAttendance} onChange={e => updateValue('inAttendance', e.target.checked)} /><span className="text-sm font-bold text-slate-800">Validar InAttendance (Bloquear Atendimento)</span></label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4">
                    <button onClick={onClose} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-blue-700">Salvar Payload</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTES UI RESTANTES ---
const CreateQueueForm = ({ mailings, onCreateQueue, isHml }) => {
    const [name, setName] = useState('');
    const [selectedMailingId, setSelectedMailingId] = useState('');
    return (
        <section className={`p-6 rounded-xl shadow-sm border ${isHml ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-4 ${isHml ? 'text-purple-800' : 'text-slate-800'}`}>{isHml ? 'Criar Fila Simulação' : 'Criar Fila de Disparo'}</h2>
            <form onSubmit={e => { e.preventDefault(); onCreateQueue(name, selectedMailingId); setName(''); setSelectedMailingId(''); }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2"><label className="text-sm font-bold text-slate-700">Nome da Fila</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Campanha Retenção" /></div>
                <div><label className="text-sm font-bold text-slate-700">Vincular Base Pronta</label><select value={selectedMailingId} onChange={e => setSelectedMailingId(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"><option value="">Selecione...</option>{mailings.filter(m => m.apiConfig && m.isCleaned).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <button type="submit" className={`text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 ${isHml ? 'bg-purple-600' : 'bg-blue-600'}`}><PlusCircle size={18} /> Criar Fila</button>
            </form>
        </section>
    );
};

const StatCard = ({ title, value, icon, color = 'blue' }) => {
    const colors = { blue: 'bg-blue-100 text-blue-600', purple: 'bg-purple-100 text-purple-600', red: 'bg-red-100 text-red-600', emerald: 'bg-emerald-100 text-emerald-600' };
    return <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5"><div className={`p-3 rounded-lg ${colors[color]}`}>{React.cloneElement(icon, { size: 24 })}</div><div><p className="text-slate-500 text-sm font-medium">{title}</p><p className="text-3xl font-bold text-slate-800">{value}</p></div></div>;
};

const QueueCard = ({ queue, statusBadge, onToggleStatus, onDeleteQueue, onDeleteBlock, onAddBlock, onBlockClick, isHml }) => (
    <div className={`rounded-xl shadow-sm border transition-all ${queue.blocked ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : queue.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
            <div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">{queue.name}</h3><p className="text-xs text-slate-500 font-medium mt-1">Base: <span className="font-bold text-slate-700">{queue.mailingName}</span> <span className="ml-2 px-2 py-0.5 bg-slate-200 rounded-md border border-slate-300 font-bold">Envios: {queue.processed} / {queue.totalContacts || '?'}</span></p></div>
            <div className="flex items-center gap-2">{statusBadge}{(!queue.blocked && queue.status !== 'completed') && <button onClick={onToggleStatus} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">{queue.status === 'running' ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="text-green-600" />}</button>}<div className="w-px h-6 bg-slate-200 mx-1"></div><button onClick={onDeleteQueue} className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button></div>
        </div>
        <div className="p-4 overflow-x-auto flex items-center gap-4">
            {queue.blocks.map((block, index) => <React.Fragment key={block.id}><BlockCard block={block} isActive={(isHml || queue.status === 'running') && index === (queue.activeBlockIndex || 0)} isHml={isHml} onDelete={() => onDeleteBlock(block.id)} onClick={() => onBlockClick(block)} />{index < queue.blocks.length - 1 && <ChevronRight className="text-slate-300" />}</React.Fragment>)}
            <button onClick={onAddBlock} className="flex-shrink-0 h-44 w-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all gap-2 group"><div className="p-2 bg-slate-100 rounded-full group-hover:bg-blue-100"><PlusCircle size={24} /></div><span className="text-xs font-bold uppercase">Add Bloco</span></button>
        </div>
    </div>
);

const BlockCard = ({ block, onDelete, onClick, isActive, isHml }) => (
    <div onClick={onClick} className={`flex-shrink-0 w-72 border rounded-lg p-4 relative group cursor-pointer transition-all hover:shadow-md ${isActive ? 'bg-white border-blue-400 ring-2 ring-blue-100 shadow-lg scale-105 z-10' : 'bg-slate-50 border-slate-200'}`}>
        {!isActive && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600"><X size={12} /></button>}
        <div className="flex justify-between mb-3 pb-2 border-b border-slate-100"><span className="text-sm font-bold text-slate-700 truncate">{block.waba.description}</span><div className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{block.config.maxPercentage}% CAP</div></div>
        <div className="flex justify-between items-center mb-2 bg-white p-2 rounded border border-slate-100"><span className="text-xs font-mono text-slate-600">{block.line.phone}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded border">{block.line.quality}</span></div>
        <div className="bg-white p-2 rounded border border-slate-100 mb-2"><span className="text-xs font-bold text-slate-700 truncate block">{block.template.name}</span></div>
        <div className="flex justify-between mt-3 text-xs"><span className="flex items-center gap-1"><ShieldAlert size={14} /> {block.currentReports}/{block.config.reportLimit}</span></div>
    </div>
);

const BlockDetailModal = ({ block, onClose }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"><div className="bg-slate-50 p-6 border-b flex justify-between items-center"><div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Detalhes do Bloco</h2><p className="text-sm text-slate-500">{block.waba.description}</p></div><button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={24} /></button></div></div></div>
);

const AddBlockModal = ({ queueId, onClose, onAddBlock }) => {
    const [wabas, setWabas] = useState([]); const [lines, setLines] = useState([]); const [templates, setTemplates] = useState([]); const [selectedWabaId, setSelectedWabaId] = useState(''); const [selectedLineId, setSelectedLineId] = useState(''); const [selectedTemplate, setSelectedTemplate] = useState(null); const [reportLimit, setReportLimit] = useState(1000); const [maxPercentage, setMaxPercentage] = useState(100); const [bmCapacity, setBmCapacity] = useState(10000);
    useEffect(() => { configService.getWABAs().then(setWabas).catch(console.error); }, []);
    useEffect(() => { if (selectedWabaId) { configService.getLines(selectedWabaId).then(setLines).catch(console.error); configService.getTemplates(selectedWabaId).then(setTemplates).catch(console.error); } }, [selectedWabaId]);
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4"><div className="flex justify-between items-center mb-2"><h3 className="text-lg font-bold">Novo Bloco</h3><button onClick={onClose}><X size={20} /></button></div><select value={selectedWabaId} onChange={e => setSelectedWabaId(e.target.value)} className="w-full border p-2 rounded"><option value="">Selecione BM...</option>{wabas.map(w => <option key={w.id} value={w.id}>{w.description}</option>)}</select><select value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)} className="w-full border p-2 rounded" disabled={!selectedWabaId}><option value="">Selecione Linha...</option>{lines.map(l => <option key={l.id} value={l.id}>{l.phone}</option>)}</select><select onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value))} className="w-full border p-2 rounded" disabled={!selectedWabaId}><option value="">Selecione Template...</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold">Limite Reports</label><input type="number" value={reportLimit} onChange={e => setReportLimit(Number(e.target.value))} className="w-full border p-2 rounded" /></div><div><label className="text-xs font-bold">Capacidade BM</label><input type="number" value={bmCapacity} onChange={e => setBmCapacity(Number(e.target.value))} className="w-full border p-2 rounded" /></div></div><div><label className="text-xs font-bold flex justify-between">Uso Máximo (%) <span>{maxPercentage}%</span></label><input type="range" min="1" max="100" value={maxPercentage} onChange={e => setMaxPercentage(Number(e.target.value))} className="w-full accent-blue-600" /></div><button onClick={() => { if (!selectedWabaId || !selectedLineId || !selectedTemplate) return alert('Selecione todos os campos'); onAddBlock(queueId, { id: `b-${Date.now()}`, waba: wabas.find(w => w.id === selectedWabaId), line: lines.find(l => l.id === selectedLineId), template: selectedTemplate, config: { reportLimit, maxPercentage, bmCapacity }, processed: 0, currentReports: 0, metaReports: [] }); }} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Salvar Bloco</button></div></div>
    );
};