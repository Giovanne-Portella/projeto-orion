import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Loader2, AlertTriangle, RefreshCw, Download, Trash2, Search, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { configService } from '../../../../services/api';
import { getBlockReports, clearBlockReports } from '../../../../utils/reportUtils';

// ============================================================================
// MODAL DE AUTENTICAÇÃO
// ============================================================================
export const AuthModal = ({ isAuthModalOpen, setIsAuthModalOpen, authForm, setAuthForm, handleAuthenticateEnvironment, isLoadingAuth }) => {
    if (!isAuthModalOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] animate-in fade-in p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="text-slate-600"/> Autenticar Ambiente</h2>
                    <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <p className="text-sm text-slate-600 mb-6">
                    Insira as credenciais para autorizar as requisições deste card isoladamente.
                </p>
                <form onSubmit={handleAuthenticateEnvironment} className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">Company</label>
                        <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={authForm.company} onChange={(e) => setAuthForm({...authForm, company: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">Username</label>
                        <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">Password</label>
                        <input type="password" className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} required />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setIsAuthModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg" disabled={isLoadingAuth}>Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2" disabled={isLoadingAuth}>
                            {isLoadingAuth ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// ============================================================================
// SUB-MODAL: SELETOR DE TEMPLATES (COM PAGINAÇÃO VIA API)
// ============================================================================
const TemplatePickerModal = ({ wabaId, clientId, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

    useEffect(() => {
        const fetchTemplates = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem(`orion_tenant_token_${clientId}`);
                const url = new URL(`https://inveniocenterapi.robbu.global/v1/campaigns/whatsapp/templates`);
                
                url.searchParams.append('whatsapp_account_id', wabaId);
                url.searchParams.append('page', currentPage);
                
                if (searchTerm.trim() !== '') {
                    url.searchParams.append('lookup', searchTerm);
                }

                const response = await fetch(url, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json, text/plain, */*'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    setTemplates(result.data || []);
                    setMeta(result.meta || { current_page: 1, last_page: 1, total: result.data?.length || 0 });
                } else {
                    console.error("Erro na API ao buscar templates:", response.status);
                    setTemplates([]);
                }
            } catch (error) {
                console.error("Falha de rede ao buscar templates:", error);
                setTemplates([]);
            } finally {
                setIsLoading(false);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            fetchTemplates();
        }, 600);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentPage, wabaId, clientId]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); 
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col gap-4 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">Selecione um Template HSM</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            autoFocus 
                            placeholder="Buscar template na Invenio (por nome, conteúdo, etc)..." 
                            value={searchTerm} 
                            onChange={handleSearchChange} 
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                    </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-blue-500">
                            <Loader2 size={40} className="animate-spin mb-4" />
                            <p className="font-bold text-slate-600">Buscando templates na API...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <ImageIcon size={48} className="mx-auto mb-3 text-slate-300 opacity-50" />
                            Nenhum template encontrado.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {templates.map(t => (
                                <div key={t.id} onClick={() => onSelect(t)} className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex flex-col group">
                                    <div className="h-28 bg-slate-100 flex items-center justify-center border-b border-slate-100 overflow-hidden relative">
                                        {t.header_file?.url ? <img src={t.header_file.url} alt="Header" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <ImageIcon size={32} className="text-slate-300" />}
                                        {t.whatsapp_status_template === 'APPROVED' && <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">APPROVED</span>}
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col">
                                        <h4 className="font-bold text-sm text-slate-800 line-clamp-1 mb-1" title={t.name}>{t.name}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-3 flex-1">{t.body || 'Sem conteúdo de texto'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {meta.last_page > 1 && (
                    <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shadow-lg z-10">
                        <span className="text-sm text-slate-500 font-medium">Página {meta.current_page} de {meta.last_page} ({meta.total} templates)</span>
                        <div className="flex gap-2">
                            <button disabled={meta.current_page === 1 || isLoading} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"><ChevronLeft size={18} /></button>
                            <button disabled={meta.current_page === meta.last_page || isLoading} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// ============================================================================
// MODAL DE CRIAR/EDITAR BLOCO
// ============================================================================
export const AddBlockModal = ({ queueId, clientId, onClose, onSaveBlock, initialBlock, allQueues = [] }) => {
    const [wabas, setWabas] = useState([]); 
    const [lines, setLines] = useState([]); 
    
    const [selectedWabaId, setSelectedWabaId] = useState(initialBlock ? initialBlock.waba.id : ''); 
    const [selectedLineId, setSelectedLineId] = useState(initialBlock ? initialBlock.line.id : ''); 
    const [selectedTemplate, setSelectedTemplate] = useState(initialBlock ? initialBlock.template : null); 
    
    const [reportLimit, setReportLimit] = useState(initialBlock ? initialBlock.config.reportLimit : 1000); 
    const [maxPercentage, setMaxPercentage] = useState(initialBlock ? initialBlock.config.maxPercentage : 100); 
    const [verifyFilters, setVerifyFilters] = useState(initialBlock?.config?.verifyFilters || (initialBlock?.config?.verifyFilter ? [initialBlock.config.verifyFilter] : []));
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

    useEffect(() => { configService.getWABAs(clientId).then(setWabas).catch(console.error); }, [clientId]);

    useEffect(() => { 
        if (selectedWabaId) { 
            configService.getLines(selectedWabaId, clientId).then(res => {
                setLines(res);
                if (initialBlock && initialBlock.waba.id === selectedWabaId && !selectedLineId) setSelectedLineId(initialBlock.line.id);
            }).catch(console.error); 
        } 
    }, [selectedWabaId, clientId]);

    const selectedLine = lines.find(l => l.id === selectedLineId) || (initialBlock?.line.id === selectedLineId ? initialBlock.line : null);
    const baseRate = selectedLine ? Number(selectedLine.rate || 1000) : (initialBlock ? initialBlock.config.bmCapacity : 1000);

    const usedMessages = allQueues.flatMap(q => q.blocks.map(b => ({ ...b, queueStatus: q.status }))).filter(b => b.line?.id === selectedLine?.id && b.id !== initialBlock?.id).reduce((acc, b) => {
        const isBlockFinished = b.status === 'completed' || b.status === 'error' || b.queueStatus === 'completed';
        if (isBlockFinished) return acc + (b.processed || 0);
        else {
            const reserved = Math.floor(baseRate * (Number(b.config.maxPercentage) / 100));
            return acc + Math.max((b.processed || 0), reserved);
        }
    }, 0);

    const availableMessages = Math.max(0, baseRate - usedMessages);
    const availablePercentage = Math.floor((availableMessages / baseRate) * 100);
    const currentMessages = Math.floor(baseRate * (maxPercentage / 100));

    useEffect(() => { if (maxPercentage > availablePercentage) setMaxPercentage(availablePercentage); }, [availablePercentage, maxPercentage]);

    const handleSave = () => {
        if (!selectedWabaId || !selectedLineId || !selectedTemplate) return alert('Selecione WABA, Linha e Template.');
        if (availablePercentage === 0 && (!initialBlock || initialBlock.config.maxPercentage === 0)) return alert('Atenção: Esta linha já consumiu toda a sua capacidade diária.');
        
        const blockId = initialBlock ? initialBlock.id : `b-${Date.now()}`;
        
        onSaveBlock(queueId, { 
            id: blockId, waba: wabas.find(w => w.id === selectedWabaId) || initialBlock.waba, 
            line: lines.find(l => l.id === selectedLineId) || initialBlock.line, 
            template: selectedTemplate, 
            config: { reportLimit, maxPercentage, bmCapacity: baseRate, verifyFilters }, 
            processed: initialBlock ? initialBlock.processed : 0, currentReports: initialBlock ? initialBlock.currentReports : 0, 
            hasError: initialBlock ? initialBlock.hasError : false, 
            status: initialBlock ? initialBlock.status : 'idle'
        }, !!initialBlock); 
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] animate-in fade-in p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">{initialBlock ? 'Editar Bloco' : 'Novo Bloco'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Business Manager (WABA)</label>
                    <select value={selectedWabaId} onChange={e => setSelectedWabaId(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm">
                        <option value="">Selecione BM...</option>
                        {wabas.map(w => <option key={w.id} value={w.id}>{w.description}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Número Remetente</label>
                        <select value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm" disabled={!selectedWabaId}>
                            <option value="">Selecione Linha...</option>
                            {lines.map(l => <option key={l.id} value={l.id}>{l.phone}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Limite de Logs</label>
                        <input type="number" value={reportLimit} onChange={e => setReportLimit(Number(e.target.value))} className="w-full border border-slate-300 p-2.5 rounded-lg outline-none text-sm" />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Template HSM</label>
                    <div className={`w-full border p-2.5 rounded-lg flex justify-between items-center bg-white transition-colors ${!selectedWabaId ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-300 hover:border-blue-400'}`}>
                        <span className={`text-sm truncate pr-4 ${!selectedTemplate ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>
                            {selectedTemplate ? selectedTemplate.name : 'Nenhum template selecionado'}
                        </span>
                        <button type="button" disabled={!selectedWabaId} onClick={() => setIsTemplatePickerOpen(true)} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm border border-blue-100">
                            <Search size={14} className="inline mr-1" /> Buscar
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <label className="text-xs font-bold text-slate-700 block mb-2">Filtro de Propensão (Selecione as desejadas ou deixe vazio para todas)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {['Altíssima Propensão', 'Alta Propensão', 'Média Propensão', 'Baixa Propensão', 'Baixíssima Propensão', 'Sem Propensão – Sem Conta WhatsApp'].map(prop => (
                            <label key={prop} className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 p-2 rounded-lg hover:border-blue-400 transition-colors shadow-sm">
                                <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={verifyFilters.includes(prop)} onChange={(e) => {
                                    if (e.target.checked) setVerifyFilters([...verifyFilters, prop]);
                                    else setVerifyFilters(verifyFilters.filter(f => f !== prop));
                                }} />
                                <span className="text-xs text-slate-700 font-medium">{prop}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <label className="text-xs font-bold text-slate-700 block mb-2 border-b border-slate-200 pb-2">Capacidade da Linha (API Rate)</label>
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-mono font-bold text-slate-800 text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-md">{baseRate} msgs/dia</span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-md shadow-sm ${availablePercentage === 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>Livre: {availablePercentage}% ({availableMessages})</span>
                    </div>
                    <div className="pt-2">
                        <label className="text-xs font-bold text-slate-700 flex justify-between mb-2">
                            Alocar Uso para este Bloco
                            <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-bold border border-blue-200">{maxPercentage}%</span>
                        </label>
                        <input type="range" min={availablePercentage > 0 ? "1" : "0"} max={availablePercentage} value={maxPercentage} onChange={e => setMaxPercentage(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" disabled={availablePercentage === 0} />
                        <p className="text-[10px] font-bold text-slate-500 mt-2 flex justify-between">
                            <span title="Total de msgs alocadas globalmente">Uso da Linha: {usedMessages} msgs</span>
                            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Disparos do Bloco: {currentMessages} msgs</span>
                        </p>
                    </div>
                </div>

                <button onClick={handleSave} disabled={!selectedLineId || (availablePercentage === 0 && maxPercentage === 0)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {initialBlock ? 'Salvar Alterações' : 'Adicionar Bloco à Fila'}
                </button>
            </div>
            
            {/* Invocação do Picker Modal passando os novos parâmetros */}
            {isTemplatePickerOpen && <TemplatePickerModal wabaId={selectedWabaId} clientId={clientId} onClose={() => setIsTemplatePickerOpen(false)} onSelect={(t) => { setSelectedTemplate(t); setIsTemplatePickerOpen(false); }} />}
        </div>,
        document.body
    );
};

// ============================================================================
// MODAL DE RELATÓRIOS DO BLOCO
// ============================================================================
export const BlockDetailModal = ({ clientId, block, onClose, onRetryMailing }) => {
    const [reports, setReports] = useState([]);
    const [selectedErrors, setSelectedErrors] = useState([]);

    useEffect(() => { setReports(getBlockReports(clientId, block.id)); }, [clientId, block.id]);

    const successCount = reports.filter(r => r.Erro_API === 200).length;
    const skippedCount = reports.filter(r => r.Erro_API === 'SKIPPED').length;
    const errorCount = reports.length - successCount - skippedCount;

    const uniqueErrors = [...new Set(reports.filter(r => r.Erro_API !== 200 && r.Erro_API !== 'SKIPPED').map(r => r.Erro_API))];

    const toggleErrorSelection = (errCode) => setSelectedErrors(prev => prev.includes(errCode) ? prev.filter(e => e !== errCode) : [...prev, errCode]);

    const handleCreateRetry = () => {
        if (selectedErrors.length === 0) return alert("Selecione pelo menos um código de erro para retentar.");
        const failedContacts = reports.filter(r => selectedErrors.includes(r.Erro_API)).map(r => r._originalContact);
        onRetryMailing(block.waba.description, failedContacts);
    };

    const downloadCSV = () => {
        if (reports.length === 0) return alert("Nenhum relatório para baixar.");
        const headers = ["Nome", "Telefone", "CPF", "Waba", "Linha", "Template", "Segmento", "Status", "Propensão", "Erro_API", "Response"];
        const rows = reports.map(r => [
            `"${r.Nome}"`, r.Telefone, r.CPF, `"${r.Waba}"`, r.Linha, `"${r.Template}"`, `"${r.Segmento}"`, `"${r.Status || 'Disparado'}"`, `"${r.Propensão || '-'}"`, r.Erro_API, `"${(r.Response || '').replace(/"/g, '""')}"`
        ].join(";"));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Relatorio_Bloco_${block.id}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleDeleteReports = () => {
        if (window.confirm("Apagar todos os relatórios deste bloco? Esta ação não pode ser desfeita.")) {
            clearBlockReports(clientId, block.id);
            setReports([]);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className={`p-6 border-b flex justify-between items-center ${block.hasError ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <div>
                        <h2 className={`text-xl font-bold flex items-center gap-2 ${block.hasError ? 'text-red-800' : 'text-slate-800'}`}>Relatório do Bloco {block.hasError && <AlertTriangle size={20} className="text-red-600" />}</h2>
                        <p className="text-sm text-slate-500">{block.waba.description} • Linha: {block.line.phone}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={24} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                            <p className="text-sm text-slate-500 font-bold">Total Avaliado</p>
                            <p className="text-2xl font-black text-slate-800">{reports.length}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
                            <p className="text-sm text-green-600 font-bold">Sucesso (200)</p>
                            <p className="text-2xl font-black text-green-700">{successCount}</p>
                        </div>
                        <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-center">
                            <p className="text-sm text-slate-600 font-bold">Ignorados (Filtro)</p>
                            <p className="text-2xl font-black text-slate-700">{skippedCount}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center">
                            <p className="text-sm text-red-600 font-bold">Falhas (APIs)</p>
                            <p className="text-2xl font-black text-red-700">{errorCount}</p>
                        </div>
                    </div>

                    {errorCount > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                            <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-2"><RefreshCw size={18} /> Módulo de Retentativa</h3>
                            <p className="text-sm text-orange-700 mb-4">Selecione os erros que deseja re-importar. O sistema criará uma nova base pronta para disparo.</p>
                            <div className="flex gap-4 flex-wrap mb-4">
                                {uniqueErrors.map(err => (
                                    <label key={err} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-orange-300 cursor-pointer shadow-sm">
                                        <input type="checkbox" className="accent-orange-600 w-4 h-4" checked={selectedErrors.includes(err)} onChange={() => toggleErrorSelection(err)} />
                                        <span className="font-bold text-sm text-orange-900">Erro {err}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={handleCreateRetry} disabled={selectedErrors.length === 0} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50">Criar Nova Base de Retentativa</button>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 text-sm">Últimos Logs de Disparo</h3>
                            <div className="flex gap-2">
                                <button onClick={downloadCSV} className="flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100"><Download size={14} /> Baixar CSV Completo</button>
                                <button onClick={handleDeleteReports} className="flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 hover:bg-red-100"><Trash2 size={14} /> Excluir Logs</button>
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-slate-100 sticky top-0 shadow-sm">
                                    <tr>
                                        <th className="p-2 border-b">Telefone</th>
                                        <th className="p-2 border-b">Ação</th>
                                        <th className="p-2 border-b">Propensão</th>
                                        <th className="p-2 border-b">Erro/Status API</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.slice(-50).reverse().map((r, i) => (
                                        <tr key={i} className="border-b hover:bg-slate-50">
                                            <td className="p-2 font-mono text-slate-700">{r.Telefone}</td>
                                            <td className="p-2 font-bold text-slate-600">{r.Status || 'Disparado'}</td>
                                            <td className="p-2 font-bold text-slate-600">{r.Propensão || '-'}</td>
                                            <td className="p-2"><span className={`px-2 py-0.5 rounded font-bold ${r.Erro_API === 200 ? 'bg-green-100 text-green-700' : (r.Erro_API === 'SKIPPED' ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700')}`}>{r.Erro_API}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {reports.length > 50 && <p className="text-center p-3 text-slate-400">Mostrando apenas os últimos 50. Baixe o CSV para ver todos.</p>}
                            {reports.length === 0 && <p className="text-center p-6 text-slate-400">Nenhum relatório salvo neste bloco.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};