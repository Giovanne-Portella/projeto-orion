import React, { useState } from 'react';
import { Play, Pause, PlusCircle, Trash2, ChevronRight, AlertTriangle, CheckCircle, X, Clock, Edit2 } from 'lucide-react';

export const CreateQueueForm = ({ mailings, onCreateQueue }) => {
    const [name, setName] = useState('');
    const [selectedMailingId, setSelectedMailingId] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduledAt, setScheduledAt] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault(); 
        onCreateQueue(name, selectedMailingId, isScheduling ? scheduledAt : null); 
        setName(''); 
        setSelectedMailingId('');
        setScheduledAt('');
        setIsScheduling(false);
    };

    return (
        <section className="p-6 rounded-xl shadow-sm border bg-white border-slate-200">
            <h2 className="text-lg font-bold mb-4 text-slate-800">Criar Fila de Disparo</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="text-sm font-bold text-slate-700">Nome da Fila</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Campanha Retenção" />
                </div>
                <div>
                    <label className="text-sm font-bold text-slate-700">Vincular Base Pronta</label>
                    <select value={selectedMailingId} onChange={e => setSelectedMailingId(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        <option value="">Selecione...</option>
                        {mailings.filter(m => m.apiConfig && m.isCleaned).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={isScheduling} onChange={e => setIsScheduling(e.target.checked)} /> Agendar disparo?
                    </label>
                    {isScheduling ? (
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm animate-in fade-in" />
                    ) : (
                        <div className="w-full border p-2 rounded-lg bg-slate-50 text-slate-400 text-sm text-center border-dashed">Disparo Manual</div>
                    )}
                </div>
                <button type="submit" className="text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 bg-blue-600">
                    <PlusCircle size={18} /> Criar Fila
                </button>
            </form>
        </section>
    );
};

export const StatCard = ({ title, value, icon, color = 'blue' }) => {
    const colors = { blue: 'bg-blue-100 text-blue-600', purple: 'bg-purple-100 text-purple-600', red: 'bg-red-100 text-red-600', emerald: 'bg-emerald-100 text-emerald-600' };
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className={`p-3 rounded-lg ${colors[color]}`}>{React.cloneElement(icon, { size: 24 })}</div>
            <div><p className="text-slate-500 text-sm font-medium">{title}</p><p className="text-3xl font-bold text-slate-800">{value}</p></div>
        </div>
    );
};

export const QueueCard = ({ queue, statusBadge, onToggleStatus, onDeleteQueue, onDeleteBlock, onEditBlock, onAddBlock, onBlockClick, onToggleBlockStatus }) => {
    // REGRA RÍGIDA: Fila só finaliza (verde/vermelha) se TODOS os blocos estiverem finalizados.
    const allBlocksDone = queue.blocks.length > 0 && queue.blocks.every(b => b.status === 'completed' || b.status === 'error');
    const hasErrorActive = queue.blocks.some(b => b.hasError && b.status !== 'completed'); 
    const isCompletedSuccess = allBlocksDone && !queue.blocks.some(b => b.hasError);

    let bgClass = 'bg-white border-slate-200';
    if (hasErrorActive) bgClass = 'bg-red-50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse';
    else if (allBlocksDone && queue.blocks.some(b => b.hasError)) bgClass = 'bg-red-50 border-red-500'; 
    else if (isCompletedSuccess) bgClass = 'bg-green-50 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';

    return (
        <div className={`rounded-xl shadow-sm border transition-all ${bgClass}`}>
            <div className={`p-4 border-b flex justify-between items-center ${hasErrorActive ? 'bg-red-100/50' : 'bg-slate-50/50'}`}>
                <div>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${queue.hasError ? 'text-red-800' : isCompletedSuccess ? 'text-green-800' : 'text-slate-800'}`}>
                        {queue.name}
                        {queue.hasError && <AlertTriangle size={18} className="text-red-600" />}
                        {isCompletedSuccess && <CheckCircle size={18} className="text-green-600" />}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                        <span>Base: <span className="font-bold text-slate-700">{queue.mailingName}</span></span>
                        <span className="px-2 py-0.5 bg-slate-200 rounded-md border border-slate-300 font-bold">Envios: {queue.processed} / {queue.totalContacts || '?'}</span>
                        {queue.scheduledAt && queue.status === 'scheduled' && (
                            <span className="text-purple-700 font-bold flex items-center gap-1 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                                <Clock size={12} /> Início: {new Date(queue.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {statusBadge}
                    {(!queue.blocked && !allBlocksDone) && (
                        <button onClick={onToggleStatus} className={`p-2 rounded-full hover:bg-slate-200 ${queue.hasError ? 'text-red-700' : 'text-slate-600'}`} title="Pausar/Iniciar TODOS os blocos">
                            {queue.status === 'running' ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="text-green-600" />}
                        </button>
                    )}
                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                    <button onClick={onDeleteQueue} className="p-2 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                </div>
            </div>
            <div className="p-4 overflow-x-auto flex items-center gap-4">
                {queue.blocks.map((block, index) => (
                    <React.Fragment key={block.id}>
                        <BlockCard block={block} canEdit={block.status === 'idle' || block.status === 'paused'} onDelete={() => onDeleteBlock(block.id)} onEdit={() => onEditBlock(block)} onClick={() => onBlockClick(block)} onTogglePlay={() => onToggleBlockStatus(queue.id, block.id)} />
                        {index < queue.blocks.length - 1 && <ChevronRight className="text-slate-300" />}
                    </React.Fragment>
                ))}
                
                {!allBlocksDone && !queue.blocked && (
                    <button onClick={onAddBlock} className="flex-shrink-0 h-44 w-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all gap-2 group">
                        <div className="p-2 bg-slate-100 rounded-full group-hover:bg-blue-100"><PlusCircle size={24} /></div>
                        <span className="text-xs font-bold uppercase">Add Bloco</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export const BlockCard = ({ block, onDelete, onEdit, onClick, canEdit, onTogglePlay }) => {
    let blockClass = 'bg-slate-50 border-slate-200';
    let statusTag = null;

    if (block.status === 'error' || block.hasError) {
        blockClass = 'bg-red-50 border-red-500 shadow-md';
        statusTag = <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">ERRO</span>;
    } else if (block.status === 'completed') {
        blockClass = 'bg-green-50 border-green-500 shadow-md';
        statusTag = <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">FINALIZADO</span>;
    } else if (block.status === 'running') {
        blockClass = 'bg-white border-blue-500 ring-2 ring-blue-200 shadow-lg scale-105 z-10';
        statusTag = <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded animate-pulse border border-blue-200">RODANDO</span>;
    } else if (block.status === 'paused') {
        blockClass = 'bg-yellow-50 border-yellow-400 shadow-sm';
        statusTag = <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">PAUSADO</span>;
    } else {
        statusTag = <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded border border-slate-300">AGUARDANDO</span>;
    }

    return (
        <div onClick={onClick} className={`flex-shrink-0 w-72 border rounded-lg p-4 relative group cursor-pointer transition-all hover:shadow-lg ${blockClass}`}>
            {canEdit && (
                <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="bg-blue-500 text-white rounded-full p-1.5 shadow-md hover:bg-blue-600"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600"><X size={14} /></button>
                </div>
            )}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                <span className={`text-sm font-bold truncate ${block.hasError ? 'text-red-800' : 'text-slate-700'}`}>{block.waba.description}</span>
                <div className="flex items-center gap-2">
                    {statusTag}
                    <div className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">{block.config.maxPercentage}% CAP</div>
                </div>
            </div>
            <div className="flex justify-between items-center mb-2 bg-white/60 p-2 rounded border border-slate-200"><span className="text-xs font-mono text-slate-600">{block.line.phone}</span></div>
            <div className="bg-white/60 p-2 rounded border border-slate-200 mb-2"><span className="text-xs font-bold text-slate-700 truncate block">{block.template.name}</span></div>
            
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/50">
                <div className="text-xs font-bold flex items-center gap-1">
                     {block.hasError && <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> Falha</span>}
                     {block.status === 'completed' && !block.hasError && <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> 100%</span>}
                     {block.status !== 'completed' && !block.hasError && <span className="text-slate-500">Enviados: {block.processed || 0}</span>}
                </div>
                {block.status !== 'completed' && block.status !== 'error' && (
                    <button onClick={(e) => { e.stopPropagation(); onTogglePlay(); }} className={`p-1.5 rounded-md shadow-sm text-white font-bold transition-colors ${block.status === 'running' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}>
                        {block.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                )}
            </div>
        </div>
    );
};