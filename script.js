import { obterTokenAutenticacao } from './auth.js';
import { polling, acknowledgeEventos, obterDetalhesPedido } from './api.js';
import { traduzirStatus } from './utils.js';

// Conjunto para rastrear pedidos já processados
const pedidosProcessados = new Set();

// Evento de carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
    configurarTabs();
});

// Inicialização do aplicativo
async function inicializarApp() {
    try {
        console.log('Inicializando aplicativo...');
        
        // Verifica se as funções necessárias estão disponíveis
        if (!polling || !obterTokenAutenticacao) {
            throw new Error('Módulos não carregados corretamente');
        }

        // Primeiro polling ao carregar
        await fazerPolling();
        
        // Polling a cada 30 segundos
        setInterval(fazerPolling, 30000);
    } catch (error) {
        console.error('Erro ao inicializar o aplicativo:', error);
        alert('Erro ao inicializar. Verifique o console.');
    }
}

// Configuração das tabs
function configurarTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active de todas as tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Adiciona active na tab clicada
            tab.classList.add('active');
            
            // Atualiza exibição dos pedidos
            atualizarExibicaoPedidos();
        });
    });
}

// Realiza polling de eventos
async function fazerPolling() {
    try {
        console.log('Iniciando polling...');
        
        // Busca eventos
        const eventos = await polling();
        console.log('Eventos recebidos:', eventos);

        // Verifica se existem eventos
        if (!eventos || !Array.isArray(eventos) || eventos.length === 0) {
            console.log('Nenhum evento novo para processar');
            return;
        }

        // Processa cada evento
        await processarEventos(eventos);

        // Reconhece os eventos processados
        const eventIds = eventos
            .map(evento => evento.id)
            .filter(id => id);

        if (eventIds.length > 0) {
            try {
                await acknowledgeEventos(eventIds);
                console.log('Eventos reconhecidos:', eventIds);
            } catch (ackError) {
                console.error('Erro ao reconhecer eventos:', ackError);
            }
        }
    } catch (error) {
        console.error('Erro no polling:', error);
    }
}

// Processa os eventos recebidos
async function processarEventos(eventos) {
    for (const evento of eventos) {
        // Verifica se o evento tem código, ID de pedido e não foi processado
        if (evento.code && evento.orderId && !pedidosProcessados.has(evento.orderId)) {
            pedidosProcessados.add(evento.orderId);
            await processarPedido(evento);
        }
    }
}

// Processa um pedido específico
async function processarPedido(evento) {
    try {
        // Obtém detalhes do pedido
        const pedido = await obterDetalhesPedido(evento.orderId);
        exibirPedido(pedido);
    } catch (error) {
        console.error('Erro ao processar pedido:', error);
    }
}

// Exibe o pedido na interface
function exibirPedido(pedido) {
    const container = document.getElementById('pedidos-container');
    if (!container) {
        console.error('Container de pedidos não encontrado');
        return;
    }

    // Cria elemento do pedido
    const pedidoElement = document.createElement('div');
    pedidoElement.className = 'pedido';
    pedidoElement.innerHTML = `
        <h3>Pedido #${pedido.id}</h3>
        <p>Status: ${traduzirStatus(pedido.status)}</p>
        <p>Cliente: ${pedido.customer?.name || 'N/A'}</p>
        <!-- Adicione mais detalhes do pedido conforme necessário -->
    `;

    container.appendChild(pedidoElement);
}

// Atualiza exibição dos pedidos baseado na tab ativa
function atualizarExibicaoPedidos() {
    const tabAtiva = document.querySelector('.tab.active').dataset.tab;
    const pedidos = document.querySelectorAll('.pedido');
    
    pedidos.forEach(pedido => {
        const status = pedido.querySelector('p:nth-child(2)').textContent;
        
        // Lógica de filtro baseada na tab ativa
        switch(tabAtiva) {
            case 'preparacao':
                pedido.style.display = ['Recebido', 'Confirmado'].includes(status) ? 'block' : 'none';
                break;
            case 'enviados':
                pedido.style.display = status === 'Despachado' ? 'block' : 'none';
                break;
            case 'concluidos':
                pedido.style.display = status === 'Concluído' ? 'block' : 'none';
                break;
            case 'cancelados':
                pedido.style.display = status === 'Cancelado' ? 'block' : 'none';
                break;
        }
    });
}
