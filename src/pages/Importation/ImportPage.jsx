import React, { useState, useEffect, useRef } from 'react';
import { mailingService, configService } from '../../services/api';
import { buildMessagePayload, sendSingleMessage } from '../../services/messageEngine';
import { parseCSV, downloadAndParseCSV } from '../../utils/csvParser';
import { Play, CloudUpload, CheckCircle, Settings, Server, Terminal, Loader2, ListFilter, RotateCcw, ToggleLeft, ToggleRight, CheckSquare, Square, FileText, Phone, Mail, Users, Tag, Edit, Trash2, PlusCircle, Download, ArrowRight, Link as LinkIcon, Zap } from 'lucide-react';

// --- CONSTANTES ---
const LGPD_OPTIONS = [
  { id: 1, label: "Consentimento", desc: "Consentimento livre, inequívoco e informado." },
  { id: 2, label: "Legítimo interesse", desc: "Interesse legítimo da empresa." },
  { id: 3, label: "Contrato pré-existente", desc: "Obrigação contratual." },
  { id: 4, label: "Obrigação Legal / Crédito", desc: "Justificável por Lei." },
  { id: 5, label: "Interesse vital / Saúde", desc: "Proteção à vida." },
  { id: 6, label: "Interesse público", desc: "Autoridade oficial." },
  { id: 7, label: "Não sei dizer / Sem Base", desc: "Contingência." }
];

const VERIFY_LEVELS = [
  { value: 'HIGH_PROPENSITY', label: "Altíssima Propensão", apiValue: '2' },
  { value: 'ALTA_PROPENSITY', label: "Alta Propensão", apiValue: '2' },
  { value: 'MEDIA_PROPENSITY', label: "Média Propensão", apiValue: '2' },
  { value: 'BAIXA_PROPENSITY', label: "Baixa Propensão", apiValue: '2' },
  { value: 'BAIXISSIMA_PROPENSITY', label: "Baixíssima Propensão", apiValue: '2' },
  { value: 'NO_PROPENSITY', label: "Sem Propensão – Sem Conta WhatsApp", apiValue: '1' }
];

const STORAGE_KEY = 'orion_flow_v8_final';
const QUEUES_STORAGE_KEY = 'orion_dashboard_queues';
const STATS_STORAGE_KEY = 'orion_dashboard_stats';

export default function ImportPage() {
  const [segments, setSegments] = useState([]);
  const fileInputRef = useRef(null);

  // --- ETAPA 1: UPLOAD ---
  const [step, setStep] = useState('upload'); // upload, processing, results, campaign
  const initialFormState = {
    description: '',
    wallet_id: '',
    // Toggles restaurados:
    wallet_unique_confirmation: false,
    clear_hashtag: false,
    robbu_verify: true,
    selected_verify_level: 'HIGH_PROPENSITY',
    lgpd_type: '1'
  };

  const [uploadForm, setUploadForm] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState(null);
  const [serverMailingId, setServerMailingId] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // --- ETAPA 3: DISPARO ---
  const [contactsToSend, setContactsToSend] = useState([]);
  const [dashboardQueues, setDashboardQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState('');

  // --- ETAPA 2: CONFIGURAÇÃO DO PAYLOAD (NOVO) ---
  const [payloadOptions, setPayloadOptions] = useState({
    include: {
      text: true, emailSubject: false, channel: true, templateName: false, attendantUserName: false,
      templateParameters: false, source: true, destination: true, discardSettings: false,
      contact: false, voiceSettings: false, files: false,
    },
    values: {
      invenioPrivateToken: '',
      text: 'Olá, [NOME_CLIENTE]!',
      emailSubject: '',
      channel: 3,
      templateName: '',
      attendantUserName: '',
      templateParameters: [{ parameterName: '', parameterValue: '' }],
      source: { countryCode: 55, phoneNumber: '', prospect: false },
      destination: { countryCode: 55, phoneNumber: '', email: '' },
      discardSettings: { recentContactLastHours: 0, InAttendance: false },
      contact: {
        name: '[NOME_CLIENTE]', customCode: '[CODCLIENTE]', id: '[CPFCNPJ]', tag: '[TAG]',
        jokers: ['[CORINGA1]', '[CORINGA2]', '[CORINGA3]', '[CORINGA4]', '[CORINGA5]'],
        walletClientCode: '', updateIfExists: true,
      },
      voiceSettings: { callId: '' },
      files: [{ address: '', base64: '', name: '' }],
    },
    // Configurações de disparo
    speed: 60,
    wabaId: '',
    lineId: '',
  });

  const [runStatus, setRunStatus] = useState({ running: false, sent: 0, errors: 0 });
  const [logs, setLogs] = useState([]);
  const stopRef = useRef(false);

  // --- HANDLERS PARA ATUALIZAR O PAYLOAD (NOVO) ---
  const handlePayloadChange = (path, value) => {
    setPayloadOptions(prev => {
      const keys = path.split('.');
      const newOptions = JSON.parse(JSON.stringify(prev)); // Deep copy
      let current = newOptions;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newOptions;
    });
  };

  const handleTemplateParamChange = (index, field, value) => {
    const newParams = [...payloadOptions.values.templateParameters];
    newParams[index][field] = value;
    handlePayloadChange('values.templateParameters', newParams);
  };

  // --- CICLO DE VIDA ---
  useEffect(() => {
    mailingService.getSegments()
      .then(data => setSegments(Array.isArray(data) ? data : []))
      .catch(console.error);

    // Recuperar Sessão
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setUploadForm(prev => ({ ...prev, ...parsed.form }));
        if (parsed.mailingId) setServerMailingId(parsed.mailingId);
        if (parsed.status) setServerStatus(parsed.status);
        if (parsed.mailingId && parsed.status?.status !== 'F' && parsed.status?.status !== 'I') {
          setStep('processing');
          setIsPolling(true);
        } else if (parsed.status?.status === 'F' || parsed.status?.status === 'I') {
          setStep('results');
        }
      }
    } catch (e) { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      form: uploadForm, mailingId: serverMailingId, status: serverStatus
    }));
  }, [uploadForm, serverMailingId, serverStatus]);

  useEffect(() => {
    let interval;
    if (isPolling && serverMailingId) {
      interval = setInterval(async () => {
        try {
          const statusList = await mailingService.checkStatus([serverMailingId]);
          if (Array.isArray(statusList) && statusList.length > 0) {
            const currentStatus = statusList.find(s => s.id === serverMailingId);
            if (currentStatus) {
              setServerStatus(currentStatus);
              if (currentStatus.status === 'F' || currentStatus.status === 'I') {
                setIsPolling(false);
                setStep('results'); // Transição para a tela de resultados
              }
            }
          }
        } catch (err) { console.error("Polling...", err); }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPolling, serverMailingId]);

  // --- LÓGICA PRINCIPAL ---
  const handleLoadAudience = async () => {
    if (!serverStatus?.download_results?.[0]?.link) {
      alert("Mailing processado, mas o link para download do resultado não foi encontrado.");
      return;
    }

    try {
      setStep('loading_audience');
      setLogs(prev => [`[SYSTEM] Baixando e processando mailing higienizado...`, ...prev]);
      const processedMailingUrl = serverStatus.download_results[0].link;
      const parsed = await downloadAndParseCSV(processedMailingUrl);

      if (parsed && parsed.data) {
        setContactsToSend(parsed.data);
        setStep('campaign');
        setLogs(prev => [`[SYSTEM] ${parsed.data.length} contatos carregados e prontos para disparo.`, ...prev]);

        // Carrega as filas do Dashboard e o Private Token
        const savedQueues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');
        setDashboardQueues(savedQueues);
        configService.getSettings().then(settings => handlePayloadChange('values.invenioPrivateToken', settings.private_token));
      }
    } catch (error) { alert("Erro ao ler CSV local."); }
  };

  const resetAll = () => {
    if (window.confirm("Reiniciar todo o processo?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const handleServerUpload = async () => {
    if (!uploadForm.wallet_id || !selectedFile) return alert("Selecione Segmento e Arquivo.");
    setStep('processing');
    try {
      setServerStatus({ status: 'UPLOADING' });
      const formData = new FormData();
      formData.append('description', uploadForm.description || `Import ${new Date().toLocaleTimeString()}`);
      formData.append('wallet_id', uploadForm.wallet_id);
      formData.append('file', selectedFile);

      // Toggles da Etapa 1
      formData.append('wallet_unique_confirmation', uploadForm.wallet_unique_confirmation);
      formData.append('clear_hashtag', uploadForm.clear_hashtag);
      formData.append('robbu_verify', uploadForm.robbu_verify);
      formData.append('lgpd_type', uploadForm.lgpd_type);

      if (uploadForm.robbu_verify) {
        const selectedOption = VERIFY_LEVELS.find(v => v.value === uploadForm.selected_verify_level);
        formData.append('verify_options', selectedOption?.apiValue || '2');
      }

      const response = await mailingService.uploadMailing(formData);
      if (response?.data?.id) {
        setServerMailingId(response.data.id);
        setIsPolling(true);
      } else throw new Error("ID não retornado");

    } catch (error) { console.error(error); alert("Falha no envio."); setStep('upload'); setServerStatus(null); }
  };

  const triggerFileSelect = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const startEngine = async () => {
    if (!selectedQueueId) return alert("Selecione uma Fila de Disparo do seu Dashboard.");
    if (!payloadOptions.values.invenioPrivateToken) return alert("Erro: Private Token não pôde ser carregado.");

    setRunStatus(prev => ({ ...prev, running: true }));
    stopRef.current = false;
    const delayMs = (60 / payloadOptions.speed) * 1000;
    let currentIdx = runStatus.sent + runStatus.errors;

    // Faz uma cópia local das filas para manipular durante o disparo
    let queues = JSON.parse(localStorage.getItem(QUEUES_STORAGE_KEY) || '[]');
    const queueIndex = queues.findIndex(q => q.id === selectedQueueId);
    if (queueIndex === -1) {
      alert("Fila selecionada não encontrada. Sincronize o Dashboard.");
      setRunStatus(p => ({ ...p, running: false }));
      return;
    }

    while (currentIdx < contactsToSend.length && !stopRef.current) {
      const contact = contactsToSend[currentIdx];
      const currentQueue = queues[queueIndex];

      if (!contact.VALOR_DO_REGISTRO && !contact.TELEFONE) { currentIdx++; continue; }

      // Lógica de seleção e rotação de bloco
      if (currentQueue.status === 'paused' || !currentQueue.blocks || currentQueue.blocks.length === 0) {
        setLogs(p => [`FILA PAUSADA. Disparos interrompidos.`, ...p]);
        break; // Sai do loop se a fila for pausada ou não tiver blocos
      }

      let activeBlock = currentQueue.blocks[currentQueue.activeBlockIndex];
      if (activeBlock.currentReports >= activeBlock.config.reportLimit) {
        // Rotaciona para o próximo bloco
        const nextBlockIndex = currentQueue.activeBlockIndex + 1;
        if (nextBlockIndex >= currentQueue.blocks.length) {
          // Não há mais blocos, pausa a fila
          queues[queueIndex].status = 'paused';
          setLogs(p => [`[SYSTEM] Limite de todos os blocos atingido. Fila pausada.`, ...p]);
          localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues));
          break;
        }
        queues[queueIndex].activeBlockIndex = nextBlockIndex;
        activeBlock = queues[queueIndex].blocks[nextBlockIndex];
        setLogs(p => [`[SYSTEM] Rotacionando para o bloco: ${activeBlock.line.phone}`, ...p]);
      }

      // Monta o payload com dados do bloco ativo
      const dynamicPayloadOptions = JSON.parse(JSON.stringify(payloadOptions));
      dynamicPayloadOptions.values.source.phoneNumber = activeBlock.line.phone.replace(/\D/g, '');
      dynamicPayloadOptions.values.templateName = activeBlock.template.name;
      // Força a inclusão do templateName no payload, já que ele vem do bloco.
      dynamicPayloadOptions.include.templateName = true;

      try {
        const payload = buildMessagePayload(contact, dynamicPayloadOptions);
        const result = await sendSingleMessage(payload);

        if (result.success) {
          setRunStatus(p => ({ ...p, sent: p.sent + 1 }));
          const currentStats = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || '{}');
          const newTotalSent = (currentStats.messagesSent || 0) + 1;
          localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ ...currentStats, messagesSent: newTotalSent }));
          setLogs(p => [`OK: ${contact.NOME_CLIENTE || 'Lead'}`, ...p].slice(0, 50));
          // Incrementa o report do bloco
          queues[queueIndex].blocks[currentQueue.activeBlockIndex].currentReports++;
        } else {
          setRunStatus(p => ({ ...p, errors: p.errors + 1 }));
          setLogs(p => [`ERRO: ${contact.NOME_CLIENTE || 'Lead'} - ${result.error}`, ...p].slice(0, 50));
        }
      } catch (e) { setRunStatus(p => ({ ...p, errors: p.errors + 1 })); }

      localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues)); // Salva o estado atualizado da fila
      await new Promise(r => setTimeout(r, delayMs));
      currentIdx++;
    }
    setRunStatus(p => ({ ...p, running: false }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold text-slate-800">Nova Importação</h1>
        {step !== 'upload' && (
          <button onClick={resetAll} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 border border-red-200 px-3 py-1 rounded bg-white hover:bg-red-50">
            <RotateCcw size={14} /> Nova Operação
          </button>
        )}
      </div>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded text-blue-600"><Server size={20} /></div>
          1. Upload de Público
        </h2>
        {step !== 'upload' && <div className="absolute inset-0 bg-white/70 z-10"></div>}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-6">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-slate-700">Descrição</label>
              <input className="w-full border p-2 rounded" value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })} disabled={!!serverMailingId} />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">Segmento</label>
              <select className="w-full border p-2 rounded bg-white" value={uploadForm.wallet_id} onChange={e => setUploadForm({ ...uploadForm, wallet_id: e.target.value })} disabled={!!serverMailingId}>
                <option value="">Selecione...</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">Arquivo CSV</label>
              <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={e => setSelectedFile(e.target.files[0])} disabled={!!serverMailingId} />
              <div onClick={!serverMailingId ? triggerFileSelect : undefined} className={`border-2 border-dashed rounded p-4 text-center cursor-pointer ${serverMailingId ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                {serverMailingId ? <span className="text-green-600 font-bold flex justify-center items-center gap-2"><CheckCircle size={16} /> Arquivo Enviado</span> : <span className="text-blue-600 font-bold">{selectedFile ? selectedFile.name : "Clique para selecionar"}</span>}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
            <h4 className="text-xs font-bold uppercase text-slate-500">Configurações de Processamento</h4>

            <Toggle label="Confirmação Única (Wallet Unique)" checked={uploadForm.wallet_unique_confirmation} onChange={v => setUploadForm({ ...uploadForm, wallet_unique_confirmation: v })} disabled={!!serverMailingId} />
            <Toggle label="Limpar Hashtags (#)" checked={uploadForm.clear_hashtag} onChange={v => setUploadForm({ ...uploadForm, clear_hashtag: v })} disabled={!!serverMailingId} />

            <div className="border-t border-slate-200 pt-4">
              <label className="text-xs font-bold block mb-1">LGPD</label>
              <select className="w-full border p-1 rounded text-sm" value={uploadForm.lgpd_type} onChange={e => setUploadForm({ ...uploadForm, lgpd_type: e.target.value })} disabled={!!serverMailingId}>
                {LGPD_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <Toggle label="Ativar Robbu Verify" checked={uploadForm.robbu_verify} onChange={v => setUploadForm({ ...uploadForm, robbu_verify: v })} disabled={!!serverMailingId} />
              {uploadForm.robbu_verify && (
                <div className="mt-2 pl-6">
                  <label className="text-xs font-bold block mb-1">Propensão Desejada</label>
                  <select className="w-full border p-1 rounded text-sm" value={uploadForm.selected_verify_level} onChange={e => setUploadForm({ ...uploadForm, selected_verify_level: e.target.value })} disabled={!!serverMailingId}>
                    {VERIFY_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <div className="flex-1 font-bold text-sm text-blue-600">
            {step === 'processing' && <span className="text-yellow-600 flex gap-2"><Loader2 className="animate-spin" /> Processando Invenio...</span>}
            {step === 'results' && <span className="text-green-600 flex gap-2"><CheckCircle /> Processado! Prossiga para a Etapa 2.</span>}
          </div>
          {step === 'upload' && (
            <button onClick={handleServerUpload} disabled={isPolling || !selectedFile} className="bg-blue-600 text-white px-6 py-2 rounded font-bold flex gap-2 disabled:bg-slate-300">
              <CloudUpload size={20} /> Processar
            </button>
          )}
        </div>
      </section>

      {step === 'results' && (
        <section className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 animate-fade-in-up">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded text-blue-600"><Download size={20} /></div>
            2. Resultados do Processamento
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mb-6 text-center">
            <div className="bg-slate-100 p-3 rounded-lg"><p className="text-xs text-slate-500">Contatos Importados</p><p className="text-2xl font-bold">{serverStatus.imported_count}</p></div>
            <div className="bg-slate-100 p-3 rounded-lg"><p className="text-xs text-slate-500">Contatos Rejeitados</p><p className="text-2xl font-bold">{serverStatus.rejected_count}</p></div>
            <div className="bg-slate-100 p-3 rounded-lg"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{serverStatus.imported_count + serverStatus.rejected_count}</p></div>
          </div>
          <div className="space-y-2 mb-6">
            <h3 className="text-sm font-bold">Arquivos de Resultado:</h3>
            {serverStatus.download_results.map(file => (
              <a key={file.link} href={file.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
                <LinkIcon size={14} /> {file.name}
              </a>
            ))}
          </div>
          <button onClick={handleLoadAudience} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700">
            Carregar Audiência e Iniciar Etapa 3 <ArrowRight />
          </button>
        </section>
      )}

      {step === 'loading_audience' && <div className="text-center p-8 bg-white rounded-lg shadow-sm"><Loader2 className="animate-spin inline-block" /></div>}

      {step === 'campaign' && (
        <section className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 animate-fade-in-up">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <div className="bg-green-100 p-2 rounded text-green-600"><Zap size={20} /></div>
              3. Configuração e Disparo
            </h2>
            <div className="text-right">
              <span className="block text-xs text-slate-500 uppercase font-bold">Contatos</span>
              <span className="text-3xl font-bold text-green-600">{contactsToSend.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border">
            <div className="md:col-span-1">
              <label className="text-sm font-bold block mb-1">Vincular à Fila do Dashboard</label>
              <select className="w-full border p-2 rounded" value={selectedQueueId} onChange={e => setSelectedQueueId(e.target.value)}>
                <option value="">Selecione uma fila...</option>
                {dashboardQueues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
              <p className="text-xs text-slate-500 mt-1">A linha e o template serão definidos pelos blocos desta fila.</p>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Velocidade</label>
              <input type="number" className="w-full border p-2 rounded" value={payloadOptions.speed} onChange={e => handlePayloadChange('speed', Number(e.target.value))} />
            </div>
          </div>

          <div className="p-4 rounded border border-slate-200 mb-6">
            <h4 className="text-sm font-bold text-slate-600 mb-4 flex gap-2 items-center"><ListFilter size={16} /> Montagem do Payload</h4>
            <div className="space-y-4">
              <PayloadSection title="Mensagem" icon={<FileText />}>
                <Checkbox label="Texto" checked={payloadOptions.include.text} onChange={v => handlePayloadChange('include.text', v)} />
                <input className="w-full border p-1 rounded text-sm" value={payloadOptions.values.text} onChange={e => handlePayloadChange('values.text', e.target.value)} disabled={!payloadOptions.include.text} placeholder="Use [NOME_CLIENTE] etc." />

                <Checkbox label="Assunto do Email" checked={payloadOptions.include.emailSubject} onChange={v => handlePayloadChange('include.emailSubject', v)} />
                <input className="w-full border p-1 rounded text-sm" value={payloadOptions.values.emailSubject} onChange={e => handlePayloadChange('values.emailSubject', e.target.value)} disabled={!payloadOptions.include.emailSubject} />

                {/* O nome do template agora é definido pelo bloco da fila, este campo é mantido para compatibilidade com outros fluxos se necessário */}
                <Checkbox label="Nome do Template (Manual)" checked={payloadOptions.include.templateName} onChange={v => handlePayloadChange('include.templateName', v)} disabled={!!selectedQueueId} />
                <input className="w-full border p-1 rounded text-sm" value={payloadOptions.values.templateName} onChange={e => handlePayloadChange('values.templateName', e.target.value)} disabled={!payloadOptions.include.templateName || !!selectedQueueId} placeholder={selectedQueueId ? "Definido pelo bloco da fila" : "template_name"} />
              </PayloadSection>

              <PayloadSection title="Parâmetros do Template" icon={<Edit />}>
                <Checkbox label="Parâmetros" checked={payloadOptions.include.templateParameters} onChange={v => handlePayloadChange('include.templateParameters', v)} />
                {payloadOptions.include.templateParameters && <div className="space-y-2">
                  {payloadOptions.values.templateParameters.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="w-1/3 border p-1 rounded text-sm" placeholder="Nome (Ex: Cliente)" value={p.parameterName} onChange={e => handleTemplateParamChange(i, 'parameterName', e.target.value)} />
                      <input className="w-2/3 border p-1 rounded text-sm" placeholder="Valor (Ex: [NOME_CLIENTE])" value={p.parameterValue} onChange={e => handleTemplateParamChange(i, 'parameterValue', e.target.value)} />
                      <Trash2 className="text-red-500 cursor-pointer" size={16} onClick={() => handlePayloadChange('values.templateParameters', payloadOptions.values.templateParameters.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                  <button onClick={() => handlePayloadChange('values.templateParameters', [...payloadOptions.values.templateParameters, { parameterName: '', parameterValue: '' }])} className="text-xs text-blue-600 flex items-center gap-1"><PlusCircle size={14} /> Adicionar</button>
                </div>}
              </PayloadSection>

              <PayloadSection title="Destino & Origem" icon={<Phone />}>
                <Checkbox label="Destination" checked={payloadOptions.include.destination} onChange={v => handlePayloadChange('include.destination', v)} />
                <div className="text-xs text-slate-500 pl-6">Telefone e Email serão preenchidos pelo CSV.</div>
                <Checkbox label="Source" checked={payloadOptions.include.source} onChange={v => handlePayloadChange('include.source', v)} />
                <div className="text-xs text-slate-500 pl-6">Telefone será preenchido pela linha selecionada.</div>
              </PayloadSection>

              <PayloadSection title="Contato" icon={<Users />}>
                <Checkbox label="Enviar/Atualizar dados do Contato" checked={payloadOptions.include.contact} onChange={v => handlePayloadChange('include.contact', v)} />
                {payloadOptions.include.contact && <div className="pl-6 space-y-2">
                  <p className="text-xs text-slate-500">Os campos Nome, CPF/CNPJ, Código, Tag e Coringas serão preenchidos automaticamente pelas colunas do seu arquivo CSV.</p>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <label className="text-xs font-bold">Cód. Carteira (Opcional)</label>
                      <input className="w-full border p-1 rounded text-sm" value={payloadOptions.values.contact.walletClientCode} onChange={e => handlePayloadChange('values.contact.walletClientCode', e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Toggle label="Atualizar se Existe" checked={payloadOptions.values.contact.updateIfExists} onChange={v => handlePayloadChange('values.contact.updateIfExists', v)} />
                    </div>
                  </div>
                </div>}
              </PayloadSection>

              <PayloadSection title="Regras de Envio" icon={<Tag />}>
                <Checkbox label="Atendente" checked={payloadOptions.include.attendantUserName} onChange={v => handlePayloadChange('include.attendantUserName', v)} />
                <input className="w-full border p-1 rounded text-sm" value={payloadOptions.values.attendantUserName} onChange={e => handlePayloadChange('values.attendantUserName', e.target.value)} disabled={!payloadOptions.include.attendantUserName} />

                <Checkbox label="Config. de Descarte" checked={payloadOptions.include.discardSettings} onChange={v => handlePayloadChange('include.discardSettings', v)} />
                {payloadOptions.include.discardSettings && <div className="pl-6 flex items-center gap-4">
                  <div>
                    <label className="text-xs font-bold">Horas Contato Recente</label>
                    <input type="number" className="w-full border p-1 rounded text-sm" value={payloadOptions.values.discardSettings.recentContactLastHours} onChange={e => handlePayloadChange('values.discardSettings.recentContactLastHours', Number(e.target.value))} />
                  </div>
                  <Toggle label="Descartar em Atendimento" checked={payloadOptions.values.discardSettings.InAttendance} onChange={v => handlePayloadChange('values.discardSettings.InAttendance', v)} />
                </div>}
              </PayloadSection>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={startEngine} disabled={runStatus.running}
              className={`flex-1 py-4 rounded-lg font-bold text-white shadow-lg flex justify-center gap-2 ${runStatus.running ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700'}`}>
              {runStatus.running ? <><Loader2 className="animate-spin" /> Enviando...</> : <><Play /> Iniciar Disparo ({contactsToSend.length})</>}
            </button>
          </div>

          <div className="mt-4 bg-slate-900 text-green-400 p-4 rounded h-48 overflow-y-auto text-xs font-mono">
            <div className="mb-2 text-slate-500 border-b border-slate-700 pb-1">Token Privado: {payloadOptions.values.invenioPrivateToken ? 'Carregado' : 'Não Detectado'}</div>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </section>
      )}
    </div>
  );
}

const PayloadSection = ({ title, icon, children }) => (
  <div className="border-t pt-4">
    <h3 className="text-md font-semibold text-slate-800 mb-3 flex items-center gap-2">{icon}{title}</h3>
    <div className="pl-8 space-y-2">{children}</div>
  </div>
);


const Toggle = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
    <span className="text-sm text-slate-700">{label}</span>
    <div onClick={() => !disabled && onChange(!checked)} className="text-blue-600">
      {checked ? <ToggleRight size={28} className="fill-current" /> : <ToggleLeft size={28} className="text-slate-400" />}
    </div>
  </label>
);

const Checkbox = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50' : ''}`}>
    <div onClick={() => !disabled && onChange(!checked)} className={checked ? "text-blue-600" : "text-slate-400"}>
      {checked ? <CheckSquare size={18} /> : <Square size={18} />}
    </div>
    <span className="text-xs font-bold text-slate-700">{label}</span>
  </label>
);