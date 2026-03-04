export const getBlockReports = (clientId, blockId) => JSON.parse(localStorage.getItem(`orion_reports_${clientId}_${blockId}`) || '[]');

export const saveBlockReport = (clientId, blockId, data) => {
    const reports = getBlockReports(clientId, blockId);
    reports.push(data);
    localStorage.setItem(`orion_reports_${clientId}_${blockId}`, JSON.stringify(reports));
};

export const clearBlockReports = (clientId, blockId) => localStorage.removeItem(`orion_reports_${clientId}_${blockId}`);

export const LGPD_OPTIONS = [
    { id: 1, label: "Consentimento", desc: "Quando uma pessoa consente com o tratamento de seus dados de forma livre, inequívoca e informada." },
    { id: 2, label: "Legítimo interesse", desc: "Interesse legítimo da empresa." },
    { id: 3, label: "Contrato pré-existente", desc: "Obrigação contratual." },
    { id: 4, label: "Obrigação Legal, Processo Judicial ou Proteção ao crédito", desc: "Justificável por Lei." },
    { id: 5, label: "Interesse vital ou Tutela da saúde", desc: "Proteção à vida." },
    { id: 6, label: "Interesse público", desc: "Necessidade de uma autoridade oficial." },
    { id: 7, label: "Não sei dizer / Não possuo Base Legal", desc: "" }
];

export const VERIFY_LEVELS = [
    { value: '1,2,3', label: "Altíssima Propensão" },
    { value: '1,2,3', label: "Alta Propensão" },
    { value: '1,2,3', label: "Média Propensão" },
    { value: '1,2,3', label: "Baixa Propensão" },
    { value: '1,2,3', label: "Baixíssima Propensão" },
    { value: '1', label: "Sem Propensão – Sem Conta WhatsApp" }
];

export const MOCK_DATA = [
    { TIPO_DE_REGISTRO: "TELEFONE", VALOR_DO_REGISTRO: "51998259416", MENSAGEM: "", NOME_CLIENTE: "Giovanne", CPFCNPJ: "34311155588", CODCLIENTE: "", TAG: "", CORINGA1: "", CORINGA2: "", CORINGA3: "", CORINGA4: "", CORINGA5: "", PRIORIDADE: "" },
    { TIPO_DE_REGISTRO: "TELEFONE", VALOR_DO_REGISTRO: "11964160938", MENSAGEM: "", NOME_CLIENTE: "Giovanne Marinho", CPFCNPJ: "34311155587", CODCLIENTE: "", TAG: "", CORINGA1: "", CORINGA2: "", CORINGA3: "", CORINGA4: "", CORINGA5: "", PRIORIDADE: "" }
];

export const MOCK_MAILING = {
    id: 'mock-mailing-default',
    name: 'Base Padrão de Testes (Mock)',
    uploadDate: new Date().toLocaleString(),
    count: 2,
    data: MOCK_DATA,
    apiConfig: {
        include: { text: true, templateParameters: false, contact: true, discardSettings: false },
        values: { text: '', walletClientCode: '', attendantUserName: '', recentContactLastHours: 0, inAttendance: false },
        templateParams: []
    },
    serverData: { id: 'invenio-mock-ok', status: 'I', download_results: [] },
    isCleaned: true
};