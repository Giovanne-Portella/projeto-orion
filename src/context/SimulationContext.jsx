import React, { createContext, useState, useEffect, useContext } from 'react';

const SimulationContext = createContext();

// Mock Data e Utilitários Globais
const MOCK_TEMPLATES_POOL = [
  { id: 't1', name: 'Oferta Black Friday', quality: 'GREEN', body: 'Olá! Aproveite 50% OFF agora...' },
  { id: 't2', name: 'Aviso Vencimento', quality: 'GREEN', body: 'Seu boleto vence hoje. Pague agora...' },
  { id: 't3', name: 'Boas Vindas VIP', quality: 'GREEN', body: 'Bem vindo ao clube VIP...' },
  { id: 't4', name: 'Recuperação Carrinho', quality: 'GREEN', body: 'Você esqueceu itens no carrinho...' },
  { id: 't5', name: 'Pesquisa NPS', quality: 'GREEN', body: 'Nota de 0 a 10 para nosso atendimento...' },
];

export const SimulationProvider = ({ children }) => {
  // Estado global que armazena as filas HML de TODOS os clientes
  // Estrutura: { 'cli-001': [queue1, queue2], 'cli-002': [...] }
  const [clientsHmlState, setClientsHmlState] = useState({});
  const [globalLogs, setGlobalLogs] = useState({}); // Logs por cliente

  // Loop Mestre de Simulação (Roda a cada 1s)
  useEffect(() => {
    const interval = setInterval(() => {
      setClientsHmlState(prevClients => {
        const nextClients = { ...prevClients };
        let hasChanges = false;

        Object.keys(nextClients).forEach(clientId => {
          const queues = nextClients[clientId];
          const activeQueues = queues.filter(q => q.status === 'running');

          if (activeQueues.length > 0) {
            hasChanges = true;
            nextClients[clientId] = queues.map(queue => processQueueTick(queue, clientId));
          }
        });

        return hasChanges ? nextClients : prevClients;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Lógica de Processamento de 1 Tick da Fila (Mesma lógica do QueueManager)
  const processQueueTick = (queue, clientId) => {
    if (queue.status !== 'running' || queue.blocked) return queue;

    const activeBlockIndex = queue.activeBlockIndex || 0;
    const activeBlock = queue.blocks[activeBlockIndex];

    if (!activeBlock) return { ...queue, status: 'paused' };

    // 1. Simular Disparo
    const increment = Math.floor(Math.random() * 8) + 2;
    const newProcessed = (queue.processed || 0) + increment;
    const limit = Math.floor(activeBlock.config.bmCapacity * (activeBlock.config.maxPercentage / 100));
    const blockProcessed = (activeBlock.processed || 0) + increment;

    // Lógica de Limite e Rodízio
    if (blockProcessed >= limit) {
      addLog(clientId, `Fila "${queue.name}" atingiu limite do bloco.`);
      
      if (activeBlockIndex < queue.blocks.length - 1) {
        return {
          ...queue,
          activeBlockIndex: activeBlockIndex + 1,
          processed: newProcessed,
          blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { ...b, processed: limit, status: 'completed' } : b)
        };
      } else {
        return {
          ...queue,
          status: 'completed',
          processed: newProcessed,
          blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { ...b, processed: limit } : b)
        };
      }
    }

    // 2. Simular Riscos (Templates e Spam)
    // (Lógica simplificada para o contexto global, mantendo os estados principais)
    let spamCount = queue.spamAlerts || 0;
    let currentTemplate = activeBlock.template;
    
    // Risco de Spam (Só se tiver 'Risco' no nome ou aleatório raro)
    const riskFactor = queue.name.includes('Risco') ? 0.05 : 0.001;
    if (Math.random() < riskFactor) {
        spamCount++;
        if (spamCount >= 3) {
            return { ...queue, status: 'blocked', blocked: true, spamAlerts: spamCount };
        }
    }

    // Risco de Template (Degradação)
    if (Math.random() < 0.1) {
        if (currentTemplate.quality === 'GREEN') currentTemplate = { ...currentTemplate, quality: 'YELLOW' };
        else if (currentTemplate.quality === 'YELLOW') currentTemplate = { ...currentTemplate, quality: 'RED' };
    }

    // Auto-Swap Template
    if (currentTemplate.quality === 'RED') {
        const nextGreen = MOCK_TEMPLATES_POOL.find(t => t.id !== currentTemplate.id && t.quality === 'GREEN');
        if (nextGreen) currentTemplate = nextGreen;
    }

    return {
      ...queue,
      processed: newProcessed,
      spamAlerts: spamCount,
      blocks: queue.blocks.map((b, i) => i === activeBlockIndex ? { 
          ...b, processed: blockProcessed, template: currentTemplate 
      } : b)
    };
  };

  const addLog = (clientId, msg) => {
    setGlobalLogs(prev => ({
        ...prev,
        [clientId]: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...(prev[clientId] || [])].slice(0, 50)
    }));
  };

  // Funções Públicas do Contexto
  const getClientQueues = (clientId) => clientsHmlState[clientId] || [];
  
  const setClientQueues = (clientId, newQueues) => {
    setClientsHmlState(prev => ({ ...prev, [clientId]: newQueues }));
  };

  const updateClientQueue = (clientId, updatedQueue) => {
    setClientsHmlState(prev => ({
        ...prev,
        [clientId]: prev[clientId].map(q => q.id === updatedQueue.id ? updatedQueue : q)
    }));
  };

  const getClientLogs = (clientId) => globalLogs[clientId] || [];

  return (
    <SimulationContext.Provider value={{ 
        clientsHmlState, 
        getClientQueues, 
        setClientQueues, 
        updateClientQueue,
        getClientLogs,
        MOCK_TEMPLATES_POOL 
    }}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => useContext(SimulationContext);