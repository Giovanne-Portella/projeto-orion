import React, { useState } from 'react';
import { X, Loader2, CheckCircle, ListFilter, Link as LinkIcon, Settings, Trash2 } from 'lucide-react';
import { mailingService } from '../../../../services/api';
import { parseCSV } from '../../../../utils/csvParser';
import { LGPD_OPTIONS, VERIFY_LEVELS } from '../../../../utils/reportUtils';

export const InvenioUploadModal = ({ segments, onClose, onSuccess, clientId }) => {
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

            const response = await mailingService.uploadMailing(form, clientId);
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
                const res = await mailingService.checkStatus([id], clientId);
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
                            <div className="flex gap-3">
                                <button onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-md">Cancelar</button>
                                <button onClick={handleUpload} className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 shadow-sm">Importar</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        {status === 'success' ? (
                            <>
                                <CheckCircle size={56} className="text-green-500 mx-auto mb-4 animate-bounce" />
                                <h3 className="font-bold text-2xl text-slate-800">Processado!</h3>
                            </>
                        ) : (
                            <>
                                <Loader2 size={56} className="text-blue-500 mx-auto mb-4 animate-spin" />
                                <h3 className="font-bold text-xl text-slate-800">{status === 'uploading' ? 'Enviando arquivo...' : 'Processando na Invenio...'}</h3>
                                <p className="text-sm text-slate-500 mt-2">Aguarde a finalização.</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export const MailingUploadCleanModal = ({ mailing, onClose, onClean }) => {
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
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-xl flex items-center gap-2"><ListFilter className="text-blue-600" /> Inserir Base Limpa</h3>
                    <button onClick={onClose}><X /></button>
                </div>
                <p className="text-sm text-slate-500 mb-6">Acesse os links da Invenio, higienize sua base localmente e faça o upload do arquivo final aqui.</p>

                {mailing.serverData && mailing.serverData.download_results && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
                        <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">Links Gerados (API Invenio):</p>
                        <div className="space-y-2">
                            {mailing.serverData.download_results.map((r, i) => (
                                <a key={i} href={r.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline bg-white p-2 rounded border border-blue-100 shadow-sm">
                                    <LinkIcon size={14} /> {r.name}
                                </a>
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

                <button 
                    onClick={processFile} 
                    disabled={loading || !file} 
                    className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold mt-6 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Carregando...' : 'Confirmar Base Limpa'}
                </button>
            </div>
        </div>
    );
};

export const SendMessageConfigModal = ({ mailing, onClose, onSave }) => {
    const csvHeaders = mailing.data && mailing.data.length > 0 ? Object.keys(mailing.data[0]) : [];

    const [payloadOptions, setPayloadOptions] = useState(mailing.apiConfig || {
        include: {
            text: true,
            templateParameters: false,
            contact: false,
            discardSettings: false
        },
        values: {
            text: '', 
            walletClientCode: '',
            attendantUserName: '',
            recentContactLastHours: 0,
            inAttendance: false
        },
        templateParams: []
    });

    const updateValue = (field, val) => setPayloadOptions(prev => ({ ...prev, values: { ...prev.values, [field]: val } }));
    const updateInclude = (field, val) => setPayloadOptions(prev => ({ ...prev, include: { ...prev.include, [field]: val } }));

    const handleSave = () => {
        onSave(mailing.id, payloadOptions);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-in fade-in p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Settings className="text-blue-600" /> Setup SendMessage JSON</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X size={20} /></button>
                </div>
                <p className="text-sm text-slate-500 mb-6">Configuração da estrutura de envio para <b>"{mailing.name}"</b>.</p>

                <div className="space-y-4">
                    {/* Bloco de Texto (Base) */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <h4 className="font-bold text-sm text-blue-800 mb-3 border-b pb-2">Dados Base (Mapeamento Automático)</h4>
                        <p className="text-xs text-slate-600 mb-3">
                            O número de disparo será obtido automaticamente da coluna <b>VALOR_DO_REGISTRO</b> do seu arquivo CSV.
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-bold block mb-1">Texto Principal (Text - Opcional)</label>
                                <input 
                                    value={payloadOptions.values.text} 
                                    onChange={e => updateValue('text', e.target.value)} 
                                    placeholder="Deixe em branco para usar a coluna MENSAGEM ou digite um texto fixo..." 
                                    className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bloco Template Parameters */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-center mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 accent-blue-600" 
                                    checked={payloadOptions.include.templateParameters} 
                                    onChange={e => updateInclude('templateParameters', e.target.checked)} 
                                />
                                <span className="text-sm font-bold text-slate-800">Parâmetros do Template HSM (Variáveis Extras)</span>
                            </label>
                            {payloadOptions.include.templateParameters && (
                                <button 
                                    onClick={() => setPayloadOptions({ ...payloadOptions, templateParams: [...payloadOptions.templateParams, { name: '', column: '' }] })} 
                                    className="text-blue-600 text-xs font-bold bg-blue-100 px-3 py-1.5 rounded-lg"
                                >
                                    + Add Parâmetro
                                </button>
                            )}
                        </div>
                        {payloadOptions.include.templateParameters && payloadOptions.templateParams.map((p, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                                <input 
                                    value={p.name} 
                                    onChange={e => { const np = [...payloadOptions.templateParams]; np[index].name = e.target.value; setPayloadOptions({ ...payloadOptions, templateParams: np }); }} 
                                    placeholder="Nome da Var (HSM)" 
                                    className="border p-2 rounded-lg w-1/3 text-xs" 
                                />
                                <select 
                                    value={p.column} 
                                    onChange={e => { const np = [...payloadOptions.templateParams]; np[index].column = e.target.value; setPayloadOptions({ ...payloadOptions, templateParams: np }); }} 
                                    className="border p-2 rounded-lg w-2/3 text-xs"
                                >
                                    <option value="">Mapear Coluna CSV...</option>
                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <button 
                                    onClick={() => setPayloadOptions({ ...payloadOptions, templateParams: payloadOptions.templateParams.filter((_, i) => i !== index) })} 
                                    className="text-red-500 hover:bg-red-100 p-2 rounded"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Bloco Contact */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <label className="flex items-center gap-2 cursor-pointer w-full mb-3">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-blue-600" 
                                checked={payloadOptions.include.contact} 
                                onChange={e => updateInclude('contact', e.target.checked)} 
                            />
                            <span className="text-sm font-bold text-slate-800">Ativar "contact" object (CRM Metadata)</span>
                        </label>
                        {payloadOptions.include.contact && (
                            <>
                                <p className="text-xs text-slate-600 mb-3 pt-3 border-t border-slate-200">
                                    Os campos de contato (NOME_CLIENTE, CPFCNPJ, CODCLIENTE, TAG e CORINGAS de 1 a 5) <b>serão mapeados automaticamente</b> com base no seu arquivo CSV padrão.
                                </p>
                                <div>
                                    <label className="text-xs font-bold block mb-1">Wallet Client Code</label>
                                    <input 
                                        value={payloadOptions.values.walletClientCode} 
                                        onChange={e => updateValue('walletClientCode', e.target.value)} 
                                        placeholder="Deixe em branco para ignorar (Recomendado)" 
                                        className="w-full border border-slate-300 p-2 rounded text-sm bg-white" 
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bloco DiscardSettings */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <label className="flex items-center gap-2 cursor-pointer w-full">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-blue-600" 
                                checked={payloadOptions.include.discardSettings} 
                                onChange={e => updateInclude('discardSettings', e.target.checked)} 
                            />
                            <span className="text-sm font-bold text-slate-800">Ativar "discardSettings" object</span>
                        </label>
                        {payloadOptions.include.discardSettings && (
                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                                <div>
                                    <label className="text-xs font-bold block mb-1">attendantUserName (Filtro)</label>
                                    <input 
                                        value={payloadOptions.values.attendantUserName} 
                                        onChange={e => updateValue('attendantUserName', e.target.value)} 
                                        placeholder="Ex: robbu_bot" 
                                        className="w-full border border-slate-300 p-2 rounded text-sm bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1">recentContactLastHours</label>
                                    <input 
                                        type="number" 
                                        value={payloadOptions.values.recentContactLastHours} 
                                        onChange={e => updateValue('recentContactLastHours', e.target.value)} 
                                        className="w-full border border-slate-300 p-2 rounded text-sm bg-white" 
                                    />
                                </div>
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-full mt-4 pt-4 border-t border-slate-200">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-blue-600" 
                                checked={payloadOptions.values.inAttendance} 
                                onChange={e => updateValue('inAttendance', e.target.checked)} 
                            />
                            <span className="text-sm font-bold text-slate-800">Validar InAttendance (Bloquear Atendimento)</span>
                        </label>
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