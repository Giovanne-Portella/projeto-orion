import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Play, Pause, Database, BarChart2, Zap, ArrowLeft, UploadCloud,
    FileText, ShieldAlert, Activity, CheckCheck, Trash2, Settings, Check, ListFilter, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';

import { mailingService } from '../../../services/api';
import { saveBlockReport, clearBlockReports, MOCK_MAILING } from '../../../utils/reportUtils';

import { StatCard, CreateQueueForm, QueueCard } from './components/Cards';
import { AuthModal, AddBlockModal, BlockDetailModal } from './modals/QueueModals';
import { InvenioUploadModal, MailingUploadCleanModal, SendMessageConfigModal } from './modals/MailingModals';

export default function QueueManager() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('mailings');

    // Chaves de armazenamento específicas do cliente
    const QUEUES_STORAGE_KEY = `orion_queues_${clientId}`;
    const STATS_STORAGE_KEY = `orion_stats_${clientId}`;
    const MAILINGS_STORAGE_KEY = `orion_mailings_${clientId}`;

    const [clientName, setClientName] = useState('');

    // --- Estados para Autenticação por Ambiente ---
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authForm, setAuthForm] = useState({ company: '', username: '', password: '' });
    const [isEnvironmentAuthed, setIsEnvironmentAuthed] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    // --- Estados de Controle de Modais ---
    const [isAddBlockModalOpen, setAddBlockModalOpen] = useState(false);
    const [queueToAddTo, setQueueToAddTo] = useState(null);
    const [blockToEdit, setBlockToEdit] = useState(null); // ESTADO DE EDIÇÃO DE BLOCO ADICIONADO
    const [selectedBlockDetail, setSelectedBlockDetail] = useState(null);
    const [isApiConfigModalOpen, setApiConfigModalOpen] = useState(false);
    const [isValidatorModalOpen, setValidatorModalOpen] = useState(false);
    const [activeMailing, setActiveMailing] = useState(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // --- Estados Globais de Dados ---
    const [segments, setSegments] = useState([]);

    const [prodQueues, setProdQueues] = useState(() =>
        JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]')
    );

    const [stats, setStats] = useState(() =>
        JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || '{"messagesSent":0,"activeQueues":0}')
    );

    // Inicializa Mailings injetando o Mock caso não exista
    const [mailings, setMailings] = useState(() => {
        const stored = JSON.parse(localStorage.getItem(MAILINGS_STORAGE_KEY) || '[]');
        if (!stored.some(m => m.id === MOCK_MAILING.id)) {
            return [MOCK_MAILING, ...stored];
        }
        return stored;
    });

    // Controla as threads de disparo real em Produção para evitar concorrência
    const activeRuns = useRef({});

    // ========================================================================
    // EFEITOS DE INICIALIZAÇÃO
    // ========================================================================
    useEffect(() => {
        const storedClients = JSON.parse(localStorage.getItem('orion_clients') || '[]');
        const client = storedClients.find(c => c.id === clientId);
        setClientName(client ? client.name : `Cliente ${clientId}`);
    }, [clientId]);

    useEffect(() => {
        mailingService.getSegments(1, clientId)
            .then(data => setSegments(Array.isArray(data) ? data : []))
            .catch(console.error);
    }, [clientId]);

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

    useEffect(() => {
        const token = localStorage.getItem(`orion_tenant_token_${clientId}`);
        setIsEnvironmentAuthed(!!token);
    }, [clientId]);

    // ========================================================================
    // CRONJOB: VERIFICADOR DE AGENDAMENTOS (A cada 5 segundos)
    // ========================================================================
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            let hasChanges = false;

            const currentQueues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');

            const updatedQueues = currentQueues.map(q => {
                if (q.status === 'scheduled' && q.scheduledAt && new Date(q.scheduledAt) <= now) {
                    hasChanges = true;

                    const mailing = mailings.find(m => m.id === q.mailingId);
                    if (!mailing || !mailing.apiConfig || !mailing.isCleaned || q.blocks.length === 0) {
                        return { ...q, status: 'paused', hasError: true, scheduledAt: null };
                    }

                    setTimeout(() => runProductionQueue(q.id), 0);
                    return { ...q, status: 'running', scheduledAt: null };
                }
                return q;
            });

            if (hasChanges) {
                setProdQueues(updatedQueues);
                localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(updatedQueues));
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [clientId, mailings]);

    // ========================================================================
    // AÇÕES DE AUTENTICAÇÃO DO AMBIENTE
    // ========================================================================
    const handleAuthenticateEnvironment = async (e) => {
        e.preventDefault();
        setIsLoadingAuth(true);

        try {
            const loginResponse = await axios.post('https://api.robbu.global/v1/login', {
                Company: authForm.company,
                Username: authForm.username,
                Password: authForm.password
            }, { headers: { 'Content-Type': 'application/json' } });

            const tenantToken = loginResponse.data.access_token;
            localStorage.setItem(`orion_tenant_token_${clientId}`, tenantToken);

            const settingsResponse = await axios.get('https://inveniocenterapi.robbu.global/v1/settings', {
                headers: { 'Authorization': `Bearer ${tenantToken}` }
            });

            const privateToken = settingsResponse.data.data.private_token;
            localStorage.setItem(`orion_tenant_private_token_${clientId}`, privateToken);

            setIsEnvironmentAuthed(true);
            setIsAuthModalOpen(false);
            alert('Ambiente autenticado com sucesso! Token armazenado para esta sessão.');

        } catch (error) {
            console.error(error);
            alert('Falha na autenticação. Verifique as credenciais.');
        } finally {
            setIsLoadingAuth(false);
        }
    };

    // ========================================================================
    // AÇÕES DE MAILING (BASES)
    // ========================================================================
    const handleDeleteMailing = (id) => {
        if (window.confirm('Excluir esta base? Filas atreladas a ela irão falhar.')) {
            setMailings(prev => prev.filter(m => m.id !== id));
        }
    };

    const handleSaveMailingConfig = (id, config) => {
        setMailings(prev => prev.map(m => m.id === id ? { ...m, apiConfig: config } : m));
        setApiConfigModalOpen(false);
    };

    const handleSaveCleanedMailing = (id, validContacts, newName) => {
        setMailings(prev => prev.map(m => m.id === id ? {
            ...m, name: newName, data: validContacts, count: validContacts.length, isCleaned: true
        } : m));
    };

    const handleInvenioUploadSuccess = (serverResult, fileData, fileName) => {
        const newMailing = {
            id: serverResult.id,
            name: fileName,
            uploadDate: new Date().toLocaleString(),
            count: fileData.length,
            data: fileData,
            apiConfig: null,
            serverData: serverResult,
            isCleaned: false
        };
        setMailings(prev => [...prev, newMailing]);
    };

    const handleRetryMailing = (blockName, failedContactsArray) => {
        const newMailingId = `m-${Date.now()}`;
        const newMailing = {
            id: newMailingId,
            name: `Retentativa (${failedContactsArray.length} contatos) - ${blockName}`,
            uploadDate: new Date().toLocaleString(),
            count: failedContactsArray.length,
            data: failedContactsArray,
            apiConfig: null,
            serverData: null,
            isCleaned: true
        };
        setMailings(prev => [newMailing, ...prev]);
        setActiveTab('mailings');
        alert(`Base de Retentativa criada com sucesso! Você foi redirecionado para a aba Bases. Configure o Payload dela antes de criar a nova fila.`);
        setSelectedBlockDetail(null);
    };

    // ========================================================================
    // AÇÕES DE FILAS (QUEUES) E BLOCOS
    // ========================================================================
    const handleCreateQueue = (name, mailingId, scheduledAt) => {
        const selectedMailing = mailings.find(m => m.id === mailingId);
        if (!name || !selectedMailing) return alert("Selecione um nome e uma Base.");

        const newQueue = {
            id: `q-${Date.now()}`,
            name,
            mailingId: selectedMailing.id,
            mailingName: selectedMailing.name,
            totalContacts: selectedMailing.count,
            status: scheduledAt ? 'scheduled' : 'paused',
            scheduledAt: scheduledAt || null,
            activeBlockIndex: 0,
            processed: 0,
            spamAlerts: 0,
            hasError: false,
            blocks: []
        };
        setProdQueues(prev => [...prev, newQueue]);
    };

    // NOVA FUNÇÃO QUE SUBSTITUI A ANTIGA handleAddBlock
    const handleSaveBlock = (queueId, blockData, isEditing) => {
        setProdQueues(prev => prev.map(q => {
            if (q.id === queueId) {
                if (isEditing) {
                    // Substitui o bloco existente
                    return { ...q, blocks: q.blocks.map(b => b.id === blockData.id ? blockData : b) };
                } else {
                    // Adiciona um novo bloco
                    return { ...q, blocks: [...q.blocks, blockData] };
                }
            }
            return q;
        }));
        setAddBlockModalOpen(false);
        setBlockToEdit(null);
    };

    // ========================================================================
    // MOTOR DE DISPARO REAL (PRODUÇÃO) 
    // ========================================================================
    const runProductionQueue = async (queueId) => {
        activeRuns.current[queueId] = true;

        let queues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');
        let queueIndex = queues.findIndex(q => q.id === queueId);
        if (queueIndex === -1) return;

        const queue = queues[queueIndex];
        const mailing = mailings.find(m => m.id === queue.mailingId);
        if (!mailing || !mailing.apiConfig || !mailing.isCleaned) return;

        const contacts = mailing.data;
        let currentIdx = queue.processed || 0;

        const privateToken = localStorage.getItem(`orion_tenant_private_token_${clientId}`);
        if (!privateToken) {
            alert("🚨 ERRO: Token Privado não encontrado. Por favor, autentique o ambiente clicando no botão no topo da página.");
            activeRuns.current[queueId] = false;
            setProdQueues(prev => prev.map(q => q.id === queueId ? { ...q, status: 'paused', hasError: true } : q));
            return;
        }

        const bearerToken = localStorage.getItem(`orion_tenant_token_${clientId}`);
        if (!bearerToken || bearerToken === 'null' || bearerToken === 'undefined') {
            alert("🚨 ERRO DE AUTENTICAÇÃO: O token do ambiente não foi encontrado!\n\nPor favor, autentique o ambiente clicando no botão no topo da página.");
            activeRuns.current[queueId] = false;
            setProdQueues(prev => prev.map(q => q.id === queueId ? { ...q, status: 'paused', hasError: true } : q));
            return;
        }

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

            let messageText = contact.MENSAGEM || config.values.text || "";
            if (messageText) {
                Object.keys(contact).forEach(col => {
                    messageText = messageText.replace(new RegExp(`\\[${col}\\]`, 'g'), contact[col] || "");
                });
            }

            const payload = {
                invenioPrivateToken: privateToken,
                text: messageText,
                emailSubject: "",
                channel: 3,
                templateName: activeBlock.template.name,
                attendantUserName: config.include.discardSettings ? (config.values.attendantUserName || "") : "",

                templateParameters: config.include.templateParameters ?
                    config.templateParams.map(p => p.column ? String(contact[p.column]) : "") : [],

                source: {
                    countryCode: 55,
                    phoneNumber: Number(activeBlock.line.phone.replace(/\D/g, '')),
                    prospect: false
                },
                destination: {
                    countryCode: 55,
                    phoneNumber: Number(String(contact.VALOR_DO_REGISTRO || "").replace(/\D/g, '')),
                    email: ""
                }
            };

            if (config.include.contact) {
                payload.contact = {
                    name: contact.NOME_CLIENTE || "",
                    customCode: contact.CODCLIENTE || "",
                    id: String(contact.CPFCNPJ || ""),
                    tag: contact.TAG || "",
                    jokers: [
                        contact.CORINGA1 || "",
                        contact.CORINGA2 || "",
                        contact.CORINGA3 || "",
                        contact.CORINGA4 || "",
                        contact.CORINGA5 || ""
                    ],
                    walletClientCode: config.values.walletClientCode || "",
                    updateIfExists: true
                };
            }

            if (config.include.discardSettings) {
                payload.discardSettings = {
                    recentContactLastHours: Number(config.values.recentContactLastHours) || 0,
                    InAttendance: config.values.inAttendance || false
                };
            }

            let apiStatus = 500;
            let apiResponseTxt = "";

            try {
                console.log(`[PROD] Disparando SendMessage para ${payload.destination.phoneNumber}...`, payload);

                const response = await fetch('https://api.robbu.global/v1/sendmessage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`
                    },
                    body: JSON.stringify(payload)
                });

                apiStatus = response.status;
                const resultData = await response.json();
                apiResponseTxt = JSON.stringify(resultData);

                if (response.ok && resultData.success !== false) {
                    currentQueue.processed = (currentQueue.processed || 0) + 1;
                    activeBlock.processed = (activeBlock.processed || 0) + 1;
                } else {
                    console.error(`Erro lógico na API para ${payload.destination.phoneNumber}:`, resultData);
                    currentQueue.processed = (currentQueue.processed || 0) + 1;
                    activeBlock.hasError = true;
                    currentQueue.hasError = true;

                    if (response.status === 401) {
                        alert("Acesso Negado (401). O Token expirou ou é inválido. Reautentique o ambiente.");
                        activeRuns.current[queueId] = false;
                        currentQueue.status = 'paused';
                    }
                }
            } catch (err) {
                console.error("Falha de Rede na Requisição HTTP:", err);
                apiStatus = 'NETWORK_ERROR';
                apiResponseTxt = err.message;
                currentQueue.processed = (currentQueue.processed || 0) + 1;
                activeBlock.hasError = true;
                currentQueue.hasError = true;
            }

            saveBlockReport(clientId, activeBlock.id, {
                Nome: contact.NOME_CLIENTE || "",
                Telefone: payload.destination.phoneNumber,
                CPF: contact.CPFCNPJ || "",
                Waba: activeBlock.waba.description,
                Linha: activeBlock.line.phone,
                Template: activeBlock.template.name,
                Segmento: mailing.name,
                Erro_API: apiStatus,
                Response: apiResponseTxt,
                _originalContact: contact
            });

            const limit = Math.floor(activeBlock.config.bmCapacity * (activeBlock.config.maxPercentage / 100));
            if (activeBlock.processed >= limit || currentQueue.processed >= contacts.length) {
                activeBlock.status = activeBlock.hasError ? 'error' : 'completed';

                if (currentQueue.processed >= contacts.length) {
                    currentQueue.status = 'completed';
                    activeRuns.current[queueId] = false;
                } else if (currentQueue.activeBlockIndex < currentQueue.blocks.length - 1) {
                    currentQueue.activeBlockIndex++;
                } else {
                    currentQueue.status = 'completed';
                    activeRuns.current[queueId] = false;
                }
            }

            queues[queueIndex] = currentQueue;
            localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues));
            setProdQueues([...queues]);

            currentIdx++;
            await new Promise(res => setTimeout(res, 1000));
        }
    };

    const handleToggleQueueStatus = (queueId) => {
        const targetQueue = prodQueues.find(q => q.id === queueId);
        if (!targetQueue || targetQueue.status === 'completed' || targetQueue.blocked) return;

        const isStarting = targetQueue.status !== 'running';

        if (isStarting) {
            if (targetQueue.blocks.length === 0) return alert('Adicione um bloco de envio antes de dar Play.');
            const linkedMailing = mailings.find(m => m.id === targetQueue.mailingId);
            if (!linkedMailing) return alert('A base atrelada a esta fila foi excluída.');
            if (!linkedMailing.apiConfig) return alert(`A base "${linkedMailing.name}" não possui a SendMessage configurada.`);
            if (!linkedMailing.isCleaned) return alert(`Suba a base final limpa no Validator antes de iniciar.`);

            if (activeRuns.current[queueId]) return;
        }

        const updatedQueues = prodQueues.map(q => {
            if (q.id !== queueId) return q;
            return { ...q, status: isStarting ? 'running' : 'paused', scheduledAt: null };
        });

        setProdQueues(updatedQueues);
        localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(updatedQueues));

        if (isStarting) {
            setTimeout(() => runProductionQueue(queueId), 0);
        } else {
            activeRuns.current[queueId] = false;
        }
    };

    const handleDeleteQueue = (queueId) => {
        if (window.confirm("Remover fila? Os relatórios não serão apagados automaticamente.")) {
            activeRuns.current[queueId] = false;
            setProdQueues(prev => prev.filter(q => q.id !== queueId));
        }
    };

    const handleDeleteBlock = (qId, bId) => {
        clearBlockReports(clientId, bId);
        setProdQueues(prev => prev.map(q => q.id === qId ? { ...q, blocks: q.blocks.filter(b => b.id !== bId) } : q));
    };

    const renderStatusBadge = (q) => {
        if (q.blocked) return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><ShieldAlert size={12} /> BLOQUEADA</span>;
        if (q.status === 'completed') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1"><CheckCheck size={12} /> FINALIZADA</span>;
        if (q.status === 'scheduled') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 flex items-center gap-1"><Clock size={12} /> AGENDADA</span>;
        if (q.status === 'running') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1"><Activity size={12} /> RODANDO</span>;
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 flex items-center gap-1"><Pause size={12} /> PAUSADA</span>;
    };

    // ========================================================================
    // RENDERIZAÇÃO DA PÁGINA
    // ========================================================================
    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* CABEÇALHO */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-6">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded hover:bg-slate-100 text-slate-500">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{clientName}</h1>
                    <p className="text-sm text-slate-500">Workspace do Cliente • ID: {clientId}</p>
                </div>

                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className={`px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center gap-2 ${isEnvironmentAuthed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900'
                        }`}
                >
                    {isEnvironmentAuthed ? <><Check size={18} /> Ambiente Autenticado</> : <><Settings size={18} /> Autenticar Ambiente</>}
                </button>
            </div>

            {/* ABAS */}
            <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl">
                <div className="flex space-x-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('mailings')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'mailings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Database size={18} /> Bases / Mailings
                    </button>
                    <div className="w-px h-6 bg-slate-300 mx-2 self-center hidden sm:block"></div>
                    <button
                        onClick={() => setActiveTab('prod')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'prod' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Zap size={18} /> Produção
                    </button>
                </div>
            </div>

            {/* ABA: MAILINGS */}
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

            {/* ABA: PRODUÇÃO */}
            {activeTab === 'prod' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Mensagens Enviadas" value={prodQueues.reduce((acc, q) => acc + (q.processed || 0), 0)} icon={<BarChart2 />} color="blue" />
                        <StatCard title="Filas Ativas" value={stats.activeQueues} icon={<Play />} color="blue" />
                        <StatCard title="Bases Prontas" value={mailings.filter(m => m.apiConfig && m.isCleaned).length} icon={<Database />} color="emerald" />
                    </div>

                    <CreateQueueForm mailings={mailings} onCreateQueue={handleCreateQueue} />

                    {prodQueues.map(queue => (
                        <QueueCard
                            key={queue.id}
                            queue={queue}
                            statusBadge={renderStatusBadge(queue)}
                            onToggleStatus={() => handleToggleQueueStatus(queue.id)}
                            onDeleteQueue={() => handleDeleteQueue(queue.id)}
                            onDeleteBlock={(bid) => handleDeleteBlock(queue.id, bid)}
                            // AQUI ESTÃO AS FUNÇÕES CORRETAS PARA ABRIR O MODAL
                            onEditBlock={(block) => { setQueueToAddTo(queue.id); setBlockToEdit(block); setAddBlockModalOpen(true); }}
                            onAddBlock={() => { setQueueToAddTo(queue.id); setBlockToEdit(null); setAddBlockModalOpen(true); }}
                            onBlockClick={setSelectedBlockDetail}
                        />
                    ))}
                </div>
            )}

            {/* MODAIS */}
            <AuthModal isAuthModalOpen={isAuthModalOpen} setIsAuthModalOpen={setIsAuthModalOpen} authForm={authForm} setAuthForm={setAuthForm} handleAuthenticateEnvironment={handleAuthenticateEnvironment} isLoadingAuth={isLoadingAuth} />

            {/* MODAL DE ADICIONAR/EDITAR BLOCO*/}
            {isAddBlockModalOpen && (
                <AddBlockModal
                    queueId={queueToAddTo}
                    clientId={clientId}
                    initialBlock={blockToEdit}
                    allQueues={prodQueues} 
                    onClose={() => { setAddBlockModalOpen(false); setBlockToEdit(null); }}
                    onSaveBlock={handleSaveBlock}
                />
            )}


            {selectedBlockDetail && <BlockDetailModal clientId={clientId} block={selectedBlockDetail} onClose={() => setSelectedBlockDetail(null)} onRetryMailing={handleRetryMailing} />}
            {isUploadModalOpen && <InvenioUploadModal clientId={clientId} segments={segments} onClose={() => setIsUploadModalOpen(false)} onSuccess={handleInvenioUploadSuccess} />}
            {isValidatorModalOpen && activeMailing && <MailingUploadCleanModal mailing={activeMailing} onClose={() => setValidatorModalOpen(false)} onClean={handleSaveCleanedMailing} />}
            {isApiConfigModalOpen && activeMailing && <SendMessageConfigModal mailing={activeMailing} onClose={() => setApiConfigModalOpen(false)} onSave={handleSaveMailingConfig} />}
        </div>
    );
}