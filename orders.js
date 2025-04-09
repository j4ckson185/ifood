/**
 * Módulo para gerenciamento das funcionalidades relacionadas aos pedidos
 * Implementa os critérios de homologação do módulo Order
 */

// Extendendo o objeto global ORDERS, não redeclarando
// NÃO use "const ORDERS = { ... }"
window.ORDERS = {
    /**
     * Lista de pedidos
     */
    orders: [],
    
    /**
     * Pedido atual selecionado
     */
    currentOrder: null,
    
    /**
     * ID do intervalo de polling
     */
    pollingInterval: null,
    
    /**
     * Momento da última verificação de polling
     */
    lastPollTime: null,
    
    /**
     * IDs de eventos já processados
     */
    processedEvents: [],
    
    /**
     * Contador para incrementar o ID simulado dos pedidos
     */
    orderIdCounter: 1,
    
    /**
     * Eventos pendentes para ack
     */
    pendingAcks: [],
    
    /**
     * Flag que indica se o polling está habilitado
     */
    pollingEnabled: true,
    
    /**
     * Inicializa o módulo de pedidos
     */
    init: function() {
        // Carrega dados de pedidos do localStorage (se existirem)
        this.loadSavedOrders();
        
        // Inicializa eventos de UI
        this.initUIEvents();
        
        // Inicia o polling de eventos
        this.startPolling();
    },
    
    /**
     * Carrega pedidos salvos no localStorage
     */
    loadSavedOrders: function() {
        const savedOrders = localStorage.getItem('orders_data');
        if (savedOrders) {
            try {
                const data = JSON.parse(savedOrders);
                this.orders = data.orders || [];
                this.processedEvents = data.processedEvents || [];
                this.orderIdCounter = data.orderIdCounter || 1;
                
                // Atualiza a UI com os pedidos carregados
                this.updateOrdersUI();
                this.updateOrdersStats();
            } catch (err) {
                console.error('Erro ao carregar dados de pedidos:', err);
            }
        }
    },
    
    /**
     * Salva os pedidos no localStorage
     */
    saveOrdersData: function() {
        const data = {
            orders: this.orders,
            processedEvents: this.processedEvents,
            orderIdCounter: this.orderIdCounter
        };
        
        localStorage.setItem('orders_data', JSON.stringify(data));
    },
    
    /**
     * Inicializa eventos de UI relacionados a pedidos
     */
    initUIEvents: function() {
        // Botão de atualizar pedidos no dashboard
        const refreshOrdersBtn = document.getElementById('refresh-orders');
        if (refreshOrdersBtn) {
            refreshOrdersBtn.addEventListener('click', () => this.fetchOrders());
        }
        
        // Botão de atualizar pedidos na seção de pedidos
        const refreshOrdersSectionBtn = document.getElementById('refresh-orders-section');
        if (refreshOrdersSectionBtn) {
            refreshOrdersSectionBtn.addEventListener('click', () => this.fetchOrders());
        }
        
        // Filtro de pedidos
        const orderFilter = document.getElementById('order-filter');
        if (orderFilter) {
            orderFilter.addEventListener('change', () => this.updateOrdersUI());
        }
        
        // Configurar listeners para modal de pedido
        this.setupOrderModalListeners();
        
        // Configurar listeners para modal de cancelamento
        this.setupCancelModalListeners();
        
        // Checkbox para ativar/desativar auto-refresh
        const autoRefreshCheckbox = document.getElementById('auto-refresh');
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', (e) => {
                this.pollingEnabled = e.target.checked;
                
                if (this.pollingEnabled) {
                    this.startPolling();
                } else {
                    this.stopPolling();
                }
                
                // Salva a preferência
                localStorage.setItem('polling_enabled', this.pollingEnabled);
            });
            
            // Carrega a preferência salva
            const savedPollingEnabled = localStorage.getItem('polling_enabled');
            if (savedPollingEnabled !== null) {
                this.pollingEnabled = savedPollingEnabled === 'true';
                autoRefreshCheckbox.checked = this.pollingEnabled;
                
                if (!this.pollingEnabled) {
                    this.stopPolling();
                }
            }
        }
    },
    
    /**
     * Configura os listeners para o modal de detalhes do pedido
     */
    setupOrderModalListeners: function() {
        // Botão de confirmar pedido
        const confirmOrderBtn = document.getElementById('modal-confirm-order');
        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => {
                if (this.currentOrder) {
                    this.confirmOrder(this.currentOrder.id);
                }
            });
        }
        
        // Botão de despachar pedido
        const dispatchOrderBtn = document.getElementById('modal-dispatch-order');
        if (dispatchOrderBtn) {
            dispatchOrderBtn.addEventListener('click', () => {
                if (this.currentOrder) {
                    this.dispatchOrder(this.currentOrder.id);
                }
            });
        }
        
        // Botão de marcar pedido como pronto para retirada
        const readyOrderBtn = document.getElementById('modal-ready-order');
        if (readyOrderBtn) {
            readyOrderBtn.addEventListener('click', () => {
                if (this.currentOrder) {
                    this.setOrderReady(this.currentOrder.id);
                }
            });
        }
        
        // Botão de cancelar pedido
        const cancelOrderBtn = document.getElementById('modal-cancel-order');
        if (cancelOrderBtn) {
            cancelOrderBtn.addEventListener('click', () => {
                if (this.currentOrder) {
                    this.showCancellationModal(this.currentOrder.id);
                }
            });
        }
        
        // Botão de imprimir pedido
        const printOrderBtn = document.getElementById('modal-print-order');
        if (printOrderBtn) {
            printOrderBtn.addEventListener('click', () => {
                if (this.currentOrder) {
                    this.printOrder(this.currentOrder);
                }
            });
        }
    },
    
    /**
     * Configura os listeners para o modal de cancelamento
     */
    setupCancelModalListeners: function() {
        // Botão de confirmar cancelamento
        const confirmCancelBtn = document.getElementById('confirm-cancel');
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', () => {
                const cancelReason = document.getElementById('cancel-reason');
                if (cancelReason && this.currentOrder) {
                    this.cancelOrder(this.currentOrder.id, cancelReason.value);
                }
            });
        }
    },
    
    /**
     * Inicia o polling para receber eventos de pedidos (Critério: Receber eventos via polling)
     */
    startPolling: function() {
        // Se já existe um intervalo, não cria outro
        if (this.pollingInterval) return;
        
        // Define o intervalo de polling (30 segundos conforme recomendado)
        this.pollingInterval = setInterval(() => {
            this.pollForEvents();
        }, 30000); // 30 segundos
        
        // Faz a primeira chamada imediatamente
        this.pollForEvents();
        
        console.log('Polling iniciado. Verificando eventos a cada 30 segundos.');
    },
    
    /**
     * Para o polling de eventos
     */
    stopPolling: function() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('Polling interrompido.');
        }
    },
    
    /**
     * Faz uma chamada de polling para verificar novos eventos (Critério: Receber eventos via polling)
     */
// Dentro do módulo ORDERS, módulo pollForEvents corrigido com a rota correta
pollForEvents: async function() {
    try {
        if (!this.pollingEnabled) return;
        
        // Verifica se os módulos necessários estão carregados
        if (!window.AUTH || !window.AUTH.credentials) {
            console.error('Módulo AUTH não inicializado corretamente');
            showToast('error', 'Erro na configuração do módulo de autenticação');
            return;
        }
        
        console.log('Verificando novos eventos...');
        this.lastPollTime = new Date();
        
        // Define o merchant ID para o header de filtragem
        const merchantId = window.AUTH.credentials.merchantId;
        if (!merchantId) {
            console.error('ID do merchant não configurado');
            showToast('error', 'Configure o ID do merchant nas configurações');
            return;
        }
        
        // Adiciona verificação de credenciais 
        if (!window.AUTH.credentials.client_id || !window.AUTH.credentials.client_secret) {
            console.error('Credenciais incompletas');
            showToast('error', 'Configure as credenciais de autenticação');
            return;
        }
        
        // Faz a requisição de polling com o header x-polling-merchants
        // Corrigindo a rota para /events:polling (com dois pontos)
        let events;
        try {
            events = await window.AUTH.apiRequest('/events:polling', {
                headers: {
                    'x-polling-merchants': merchantId
                }
            });
        } catch (error) {
            console.warn('Erro no polling, tentando continuar:', error);
            showToast('warning', 'Erro ao verificar novos eventos');
            return;
        }
        
        // Se a resposta for nula ou indefinida, considera como vazia
        if (!events) {
            console.log('Nenhum evento encontrado no polling.');
            return;
        }
        
        console.log('Eventos recebidos:', events);
        
        // Filtra e processa eventos
        const eventosNaoProcessados = events.filter(evento => 
            evento.id && !this.processedEvents.includes(evento.id)
        );
        
        // Processa os eventos recebidos
        if (eventosNaoProcessados.length > 0) {
            await this.processEvents(eventosNaoProcessados);
        }
    } catch (error) {
        console.error('Erro no polling de eventos:', error);
        showToast('error', 'Erro crítico ao processar eventos');
    }
},
    
    /**
     * Processa os eventos recebidos do polling
     * @param {Array} events Lista de eventos para processar
     */
    processEvents: async function(events) {
        if (!events || events.length === 0) return;
        
        // IDs de eventos que precisam de acknowledgment
        const eventIdsForAck = [];
        
        // Processa cada evento
        for (const event of events) {
            // Verifica se o evento já foi processado (Critério: Descartar eventos duplicados)
            if (this.processedEvents.includes(event.id)) {
                console.log(`Evento ${event.id} já processado anteriormente. Ignorando.`);
                continue;
            }
            
            // Adiciona o ID para a lista de acknowledgment
            eventIdsForAck.push(event.id);
            
            // Adiciona o ID à lista de eventos processados
            this.processedEvents.push(event.id);
            
            // Limite de IDs armazenados (mantém os 1000 mais recentes)
            if (this.processedEvents.length > 1000) {
                this.processedEvents = this.processedEvents.slice(-1000);
            }
            
            // Processa o evento com base no seu código
            await this.handleEvent(event);
        }
        
        // Envia acknowledgment para todos os eventos (Critério: Enviar acknowledgment)
        if (eventIdsForAck.length > 0) {
            await this.sendAcknowledgment(eventIdsForAck);
        }
        
        // Salva os dados após processamento
        this.saveOrdersData();
    },
    
/**
 * Envia acknowledgment para os eventos processados (Critério: Enviar acknowledgment)
 * @param {Array} eventIds Lista de IDs de eventos para enviar ack
 */
sendAcknowledgment: async function(eventIds) {
    try {
        if (!eventIds || eventIds.length === 0) return;
        
        // Divide em lotes de 2000 IDs conforme requisito
        const batchSize = 2000;
        for (let i = 0; i < eventIds.length; i += batchSize) {
            const batch = eventIds.slice(i, i + batchSize);
            
            // Corrigindo a rota para /events/acknowledgment
            await window.AUTH.apiRequest('/events/acknowledgment', {
                method: 'POST',
                body: JSON.stringify({
                    eventIds: batch
                })
            });
        }
        
        console.log(`Acknowledgment enviado para ${eventIds.length} eventos.`);
    } catch (error) {
        console.error('Erro ao enviar acknowledgment:', error);
        
        // Adiciona aos pending acks para tentar novamente depois
        this.pendingAcks.push(...eventIds);
    }
},
    
    /**
     * Lida com um evento específico com base no seu código
     * @param {Object} event Evento a ser tratado
     */
    handleEvent: async function(event) {
        try {
            console.log(`Processando evento: ${event.code} (ID: ${event.id})`);
            
            // Verifica se é um evento de pedido
            if (event.code.startsWith('ORDER') || event.code.startsWith('PLACED') || event.code.startsWith('CANCELLED')) {
                // Busca detalhes do pedido
                const orderId = event.correlationId;
                if (orderId) {
                    await this.fetchOrderDetails(orderId);
                }
            }
            
            // Eventos específicos de pedido
            switch (event.code) {
                case 'PLACED':
                case 'ORDER_PLACED':
                    // Novo pedido recebido
                    this.playNewOrderSound();
                    showToast('info', 'Novo pedido recebido!');
                    break;
                
                case 'ORDER_CANCELLED':
                case 'CANCELLED_BY_CUSTOMER':
                    // Pedido cancelado pelo cliente ou iFood
                    this.updateOrderStatus(event.correlationId, 'CANCELLED');
                    showToast('warning', 'Pedido cancelado pelo cliente ou iFood!');
                    break;
                
                case 'ORDER_CONFIRMED':
                    // Pedido confirmado
                    this.updateOrderStatus(event.correlationId, 'CONFIRMED');
                    break;
                
                case 'ORDER_DISPATCHED':
                    // Pedido despachado
                    this.updateOrderStatus(event.correlationId, 'DISPATCHED');
                    break;
                
                case 'ORDER_READY_FOR_PICKUP':
                    // Pedido pronto para retirada
                    this.updateOrderStatus(event.correlationId, 'READY');
                    break;
                
                case 'ORDER_CONCLUDED':
                    // Pedido concluído
                    this.updateOrderStatus(event.correlationId, 'CONCLUDED');
                    break;
                
                default:
                    console.log(`Evento ${event.code} não tratado especificamente.`);
            }
        } catch (error) {
            console.error(`Erro ao processar evento ${event.id}:`, error);
        }
    },
    
    /**
     * Busca todos os pedidos ativos
     */
    fetchOrders: async function() {
        try {
            showLoading(true);
            
            // Na API real, você buscaria os pedidos no endpoint apropriado
            // Para fins de demonstração, vamos simular alguns pedidos
            if (this.orders.length === 0) {
                this.simulateOrders();
            }
            
            this.updateOrdersUI();
            this.updateOrdersStats();
            
            showToast('success', 'Pedidos atualizados com sucesso!');
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error);
            showToast('error', 'Erro ao buscar pedidos');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Busca detalhes de um pedido específico
     * @param {string} orderId ID do pedido
     */
    fetchOrderDetails: async function(orderId) {
        try {
            // Na API real, você buscaria os detalhes do pedido no endpoint específico
            // Para fins de demonstração, vamos verificar se já temos o pedido na lista
            let order = this.orders.find(o => o.id === orderId);
            
            // Se não encontrou, cria um novo pedido simulado
            if (!order) {
                order = this.createSimulatedOrder(orderId);
                this.orders.unshift(order); // Adiciona ao início da lista
            }
            
            this.updateOrdersUI();
            this.updateOrdersStats();
            
            return order;
        } catch (error) {
            console.error(`Erro ao buscar detalhes do pedido ${orderId}:`, error);
            throw error;
        }
    },
    
    /**
     * Atualiza o status de um pedido
     * @param {string} orderId ID do pedido
     * @param {string} newStatus Novo status
     */
    updateOrderStatus: function(orderId, newStatus) {
        // Busca o pedido na lista
        const orderIndex = this.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;
        
        // Atualiza o status
        this.orders[orderIndex].status = newStatus;
        
        // Atualiza a UI
        this.updateOrdersUI();
        this.updateOrdersStats();
        
        // Salva os dados
        this.saveOrdersData();
    },
    
    /**
     * Confirma um pedido (Critério: Receber, confirmar e despachar pedido)
     * @param {string} orderId ID do pedido
     */
    confirmOrder: async function(orderId) {
        try {
            showLoading(true);
            
            // Na API real, você enviaria uma requisição para confirmar o pedido
            // Para fins de demonstração, vamos apenas atualizar o status
            this.updateOrderStatus(orderId, 'CONFIRMED');
            
            // Fecha o modal
            this.closeOrderModal();
            
            showToast('success', 'Pedido confirmado com sucesso!');
        } catch (error) {
            console.error(`Erro ao confirmar pedido ${orderId}:`, error);
            showToast('error', 'Erro ao confirmar pedido');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Despacha um pedido (Critério: Receber, confirmar e despachar pedido)
     * @param {string} orderId ID do pedido
     */
    dispatchOrder: async function(orderId) {
        try {
            showLoading(true);
            
            // Na API real, você enviaria uma requisição para despachar o pedido
            // Para fins de demonstração, vamos apenas atualizar o status
            this.updateOrderStatus(orderId, 'DISPATCHED');
            
            // Fecha o modal
            this.closeOrderModal();
            
            showToast('success', 'Pedido despachado com sucesso!');
        } catch (error) {
            console.error(`Erro ao despachar pedido ${orderId}:`, error);
            showToast('error', 'Erro ao despachar pedido');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Marca um pedido como pronto para retirada (Critério: Pedidos Pra Retirar)
     * @param {string} orderId ID do pedido
     */
    setOrderReady: async function(orderId) {
        try {
            showLoading(true);
            
            // Na API real, você enviaria uma requisição para marcar o pedido como pronto
            // Para fins de demonstração, vamos apenas atualizar o status
            this.updateOrderStatus(orderId, 'READY');
            
            // Fecha o modal
            this.closeOrderModal();
            
            showToast('success', 'Pedido pronto para retirada!');
        } catch (error) {
            console.error(`Erro ao marcar pedido ${orderId} como pronto:`, error);
            showToast('error', 'Erro ao marcar pedido como pronto');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Busca as razões de cancelamento disponíveis (Critério: Cancelamento de pedidos)
     */
    fetchCancellationReasons: async function() {
        try {
            // Na API real, você buscaria os motivos no endpoint /cancellationReasons
            // Para fins de demonstração, vamos retornar alguns motivos padrão
            return [
                { code: 'OUT_OF_PRODUCTS', description: 'Estabelecimento sem produtos' },
                { code: 'CLOSED_RESTAURANT', description: 'Estabelecimento fechado' },
                { code: 'ITEM_OUT_OF_STOCK', description: 'Item(ns) sem estoque' },
                { code: 'CUSTOMER_GAVE_UP', description: 'Cliente desistiu' },
                { code: 'TECHNICAL_PROBLEMS', description: 'Problemas técnicos' },
                { code: 'OTHER', description: 'Outro motivo' }
            ];
        } catch (error) {
            console.error('Erro ao buscar motivos de cancelamento:', error);
            throw error;
        }
    },
    
    /**
     * Exibe o modal de cancelamento com as razões disponíveis
     * @param {string} orderId ID do pedido
     */
    showCancellationModal: async function(orderId) {
        try {
            // Busca as razões de cancelamento
            const reasons = await this.fetchCancellationReasons();
            
            // Preenche o select com as razões
            const cancelReasonSelect = document.getElementById('cancel-reason');
            if (cancelReasonSelect) {
                cancelReasonSelect.innerHTML = '';
                
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason.code;
                    option.textContent = reason.description;
                    cancelReasonSelect.appendChild(option);
                });
            }
            
            // Abre o modal
            const modal = document.getElementById('cancel-order-modal');
            if (modal) {
                modal.classList.add('active');
            }
        } catch (error) {
            console.error('Erro ao exibir modal de cancelamento:', error);
            showToast('error', 'Erro ao carregar motivos de cancelamento');
        }
    },
    
    /**
     * Cancela um pedido (Critério: Cancelamento de pedidos)
     * @param {string} orderId ID do pedido
     * @param {string} reasonCode Código do motivo de cancelamento
     */
    cancelOrder: async function(orderId, reasonCode) {
        try {
            showLoading(true);
            
            // Na API real, você enviaria uma requisição para cancelar o pedido
            // Para fins de demonstração, vamos apenas atualizar o status
            this.updateOrderStatus(orderId, 'CANCELLED');
            
            // Fecha os modais
            this.closeOrderModal();
            this.closeCancelModal();
            
            showToast('success', 'Pedido cancelado com sucesso!');
        } catch (error) {
            console.error(`Erro ao cancelar pedido ${orderId}:`, error);
            showToast('error', 'Erro ao cancelar pedido');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Imprime os detalhes do pedido (Critério: Exibir na tela e/ou comanda impressa)
     * @param {Object} order Pedido a ser impresso
     */
    printOrder: function(order) {
        try {
            if (!order) return;
            
            // Cria o conteúdo da comanda
            let content = `
                <style>
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        line-height: 1.5;
                        margin: 0;
                        padding: 0;
                    }
                    .receipt {
                        width: 302px;
                        padding: 10px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 10px;
                    }
                    .logo {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .address, .info {
                        font-size: 10px;
                        margin-bottom: 5px;
                    }
                    .divider {
                        border-top: 1px dashed #000;
                        margin: 10px 0;
                    }
                    .section-title {
                        font-weight: bold;
                        margin: 5px 0;
                    }
                    .item {
                        margin-bottom: 5px;
                    }
                    .item-name {
                        font-weight: bold;
                    }
                    .item-detail {
                        font-size: 10px;
                        padding-left: 10px;
                    }
                    .pickup-code {
                        font-size: 18px;
                        font-weight: bold;
                        text-align: center;
                        margin: 10px 0;
                        padding: 10px;
                        border: 1px dashed #000;
                    }
                    .summary {
                        margin-top: 10px;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                    }
                    .total {
                        font-weight: bold;
                        margin-top: 5px;
                        font-size: 14px;
                    }
                    .payment {
                        margin-top: 10px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        font-size: 10px;
                    }
                </style>
                <div class="receipt">
                    <div class="header">
                        <div class="logo">${order.merchant?.name || 'iFood PDV'}</div>
                        <div class="address">${order.merchant?.address || 'Endereço do Estabelecimento'}</div>
                        <div class="info">CNPJ: ${order.merchant?.cnpj || '00.000.000/0000-00'}</div>
                        <div class="info">Tel: ${order.merchant?.phone || '(00) 0000-0000'}</div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="order-info">
                        <div class="section-title">PEDIDO #${order.orderNumber || order.id}</div>
                        <div>${new Date(order.createdAt).toLocaleString()}</div>
                        <div>Tipo: ${order.orderType === 'DELIVERY' ? 'Entrega' : 'Retirada'}</div>
                        <div>Status: ${this.getStatusText(order.status)}</div>
                        ${order.scheduling ? `<div>Agendado para: ${new Date(order.scheduling.deliveryDateTime).toLocaleString()}</div>` : ''}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="customer-info">
                        <div class="section-title">CLIENTE</div>
                        <div>${order.customer?.name || 'Nome do Cliente'}</div>
                        <div>${order.customer?.phone || 'Telefone'}</div>
                        ${order.customer?.taxPayerIdentification ? `<div>CPF/CNPJ: ${order.customer.taxPayerIdentification.number}</div>` : ''}
                    </div>
                    
                    ${order.orderType === 'DELIVERY' ? `
                    <div class="divider"></div>
                    
                    <div class="delivery-info">
                        <div class="section-title">ENTREGA</div>
                        <div>${order.delivery?.deliveryAddress?.formattedAddress || 'Endereço de Entrega'}</div>
                        ${order.delivery?.observations ? `<div>Obs: ${order.delivery.observations}</div>` : ''}
                    </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    
                    <div class="items-info">
                        <div class="section-title">ITENS DO PEDIDO</div>
                        ${order.items?.map(item => `
                        <div class="item">
                            <div class="item-name">${item.quantity}x ${item.name}</div>
                            ${item.price ? `<div class="item-detail">Valor unitário: R$ ${(item.price/100).toFixed(2)}</div>` : ''}
                            ${item.observations ? `<div class="item-detail">Obs: ${item.observations}</div>` : ''}
                            ${item.options?.map(option => `
                                <div class="item-detail">+ ${option.name}</div>
                            `).join('') || ''}
                        </div>
                        `).join('') || 'Nenhum item'}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="summary">
                        <div class="summary-row">
                            <div>Subtotal:</div>
                            <div>R$ ${(order.subTotal/100).toFixed(2) || '0,00'}</div>
                        </div>
                        
                        ${order.discount ? `
                        <div class="summary-row">
                            <div>Desconto:</div>
                            <div>R$ ${(order.discount.value/100).toFixed(2)}</div>
                        </div>
                        ` : ''}
                        
                        ${order.deliveryFee ? `
                        <div class="summary-row">
                            <div>Taxa de entrega:</div>
                            <div>R$ ${(order.deliveryFee/100).toFixed(2)}</div>
                        </div>
                        ` : ''}
                        
                        <div class="summary-row total">
                            <div>TOTAL:</div>
                            <div>R$ ${(order.total/100).toFixed(2) || '0,00'}</div>
                        </div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="payment">
                        <div class="section-title">PAGAMENTO</div>
                        <div>Método: ${this.getPaymentMethodText(order.payments)}</div>
                        ${order.payments?.find(p => p.method === 'CASH' && p.changeFor) ? `
                        <div>Troco para: R$ ${(order.payments.find(p => p.method === 'CASH').changeFor/100).toFixed(2)}</div>
                        ` : ''}
                    </div>
                    
                    ${order.pickupCode ? `
                    <div class="divider"></div>
                    
                    <div class="pickup-info">
                        <div class="section-title">CÓDIGO DE RETIRADA</div>
                        <div class="pickup-code">${order.pickupCode}</div>
                    </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    
<div class="footer">
                        Pedido recebido via iFood<br>
                        Obrigado pela preferência!
                    </div>
                </div>
            `;
            
            // Abre uma nova janela para imprimir
            const printWindow = window.open('', '_blank');
            printWindow.document.write(content);
            printWindow.document.close();
            
            // Aguarda o carregamento e imprime
            printWindow.onload = function() {
                printWindow.print();
                // printWindow.close();
            };
        } catch (error) {
            console.error('Erro ao imprimir pedido:', error);
            showToast('error', 'Erro ao imprimir pedido');
        }
    },
    
    /**
     * Fecha o modal de detalhes do pedido
     */
    closeOrderModal: function() {
        const modal = document.getElementById('order-details-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    /**
     * Fecha o modal de cancelamento
     */
    closeCancelModal: function() {
        const modal = document.getElementById('cancel-order-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    /**
     * Simula alguns pedidos para demonstração
     */
    simulateOrders: function() {
        // Array de pedidos simulados
        const demoOrders = [
            this.createSimulatedOrder('order_1', 'PENDING', 'DELIVERY', 'IMMEDIATE'),
            this.createSimulatedOrder('order_2', 'CONFIRMED', 'DELIVERY', 'SCHEDULED'),
            this.createSimulatedOrder('order_3', 'DISPATCHED', 'DELIVERY', 'IMMEDIATE'),
            this.createSimulatedOrder('order_4', 'READY', 'TAKEOUT', 'IMMEDIATE'),
            this.createSimulatedOrder('order_5', 'CANCELLED', 'DELIVERY', 'IMMEDIATE')
        ];
        
        this.orders = demoOrders;
        this.saveOrdersData();
    },
    
    /**
     * Cria um pedido simulado com os dados
     * @param {string} id ID do pedido
     * @param {string} status Status do pedido (opcional)
     * @param {string} orderType Tipo do pedido (opcional)
     * @param {string} orderTiming Tempo do pedido (opcional)
     * @returns {Object} Pedido simulado
     */
    createSimulatedOrder: function(id, status = 'PENDING', orderType = 'DELIVERY', orderTiming = 'IMMEDIATE') {
        // Incrementa o contador de pedidos
        const orderNumber = `${100000 + this.orderIdCounter++}`;
        
        // Gera alguns itens aleatórios
        const items = [];
        const numItems = Math.floor(Math.random() * 4) + 1;
        
        const possibleItems = [
            { name: 'X-Burger', price: 2490, observations: '' },
            { name: 'X-Salada', price: 2890, observations: 'Sem cebola' },
            { name: 'X-Bacon', price: 3290, observations: 'Bacon extra' },
            { name: 'X-Tudo', price: 3690, observations: '' },
            { name: 'Batata Frita P', price: 1290, observations: '' },
            { name: 'Batata Frita M', price: 1690, observations: 'Bem passada' },
            { name: 'Batata Frita G', price: 2190, observations: '' },
            { name: 'Refrigerante Lata', price: 590, observations: 'Bem gelado' },
            { name: 'Água Mineral', price: 390, observations: '' },
            { name: 'Milk Shake', price: 1890, observations: '' }
        ];
        
        for (let i = 0; i < numItems; i++) {
            const itemIndex = Math.floor(Math.random() * possibleItems.length);
            const quantity = Math.floor(Math.random() * 2) + 1;
            
            items.push({
                ...possibleItems[itemIndex],
                quantity,
                totalPrice: possibleItems[itemIndex].price * quantity
            });
        }
        
        // Calcula o subtotal
        const subTotal = items.reduce((total, item) => total + item.totalPrice, 0);
        
        // Define se terá desconto
        const hasDiscount = Math.random() > 0.7;
        const discountValue = hasDiscount ? Math.floor(subTotal * 0.1) : 0;
        const discountSponsor = Math.random() > 0.5 ? 'MERCHANT' : 'IFOOD';
        
        // Define taxa de entrega
        const deliveryFee = orderType === 'DELIVERY' ? 790 : 0;
        
        // Calcula o total
        const total = subTotal - discountValue + deliveryFee;
        
        // Define método de pagamento
        const paymentMethod = Math.random() > 0.5 ? 'CREDIT' : 'CASH';
        const cardBrand = paymentMethod === 'CREDIT' ? ['VISA', 'MASTERCARD', 'ELO', 'AMEX'][Math.floor(Math.random() * 4)] : null;
        
        // Define troco
        const changeFor = paymentMethod === 'CASH' ? Math.ceil(total / 1000) * 1000 : null;
        
        // Define data de criação (aleatória nas últimas 24h)
        const createdAt = new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString();
        
        // Define data para pedidos agendados
        const scheduledDate = orderTiming === 'SCHEDULED' ? 
            new Date(Date.now() + Math.floor(Math.random() * 48 * 60 * 60 * 1000)).toISOString() : null;
        
        // Retorna o pedido simulado
        return {
            id: id || `order_${orderNumber}`,
            orderNumber,
            displayId: orderNumber,
            createdAt,
            status,
            orderType,
            orderTiming,
            merchant: {
                id: AUTH.credentials.merchantId,
                name: 'Restaurante Demo',
                address: 'Rua Exemplo, 123',
                phone: '(11) 99999-9999',
                cnpj: '12.345.678/0001-90'
            },
            customer: {
                name: this.getRandomCustomerName(),
                phone: this.generateRandomPhone(),
                taxPayerIdentification: Math.random() > 0.3 ? {
                    type: 'CPF',
                    number: this.generateRandomCPF()
                } : null
            },
            items,
            subTotal,
            discount: hasDiscount ? {
                value: discountValue,
                sponsor: discountSponsor
            } : null,
            deliveryFee: orderType === 'DELIVERY' ? deliveryFee : 0,
            total,
            payments: [{
                method: paymentMethod,
                type: paymentMethod === 'CREDIT' ? 'ONLINE' : 'OFFLINE',
                brand: cardBrand,
                changeFor
            }],
            delivery: orderType === 'DELIVERY' ? {
                deliveryAddress: {
                    formattedAddress: this.getRandomAddress(),
                    latitude: -23.5505,
                    longitude: -46.6333
                },
                observations: Math.random() > 0.7 ? 'Entregar na portaria' : ''
            } : null,
            scheduling: orderTiming === 'SCHEDULED' ? {
                deliveryDateTime: scheduledDate
            } : null,
            pickupCode: orderType === 'TAKEOUT' ? `${Math.floor(Math.random() * 900) + 100}` : null
        };
    },

    /**
     * Exibe os detalhes de um pedido no modal
     * @param {string} orderId ID do pedido a ser exibido
     */
    showOrderDetails: function(orderId) {
        // Busca o pedido
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        // Salva o pedido atual
        this.currentOrder = order;
        
        // Preenche os dados do modal
        document.getElementById('modal-order-id').textContent = order.orderNumber || order.id;
        
        // Status
        const statusBadge = document.getElementById('modal-order-status');
        if (statusBadge) {
            statusBadge.textContent = this.getStatusText(order.status);
            statusBadge.className = 'order-status-badge ' + order.status.toLowerCase();
        }
        
        // Tipo de pedido
        if (document.getElementById('modal-order-type')) {
            let orderTypeText = order.orderType === 'DELIVERY' ? 'Entrega' : 'Retirada';
            if (order.orderTiming === 'SCHEDULED') {
                orderTypeText += ' Agendada';
            }
            document.getElementById('modal-order-type').textContent = orderTypeText;
        }
        
        // Data/Hora
        if (document.getElementById('modal-order-datetime')) {
            const date = new Date(order.createdAt);
            document.getElementById('modal-order-datetime').textContent = date.toLocaleString();
        }
        
        // Código de retirada
        if (document.getElementById('modal-pickup-code')) {
            document.getElementById('modal-pickup-code').textContent = order.pickupCode || '-';
        }
        
        // Forma de pagamento
        if (document.getElementById('modal-payment-method')) {
            document.getElementById('modal-payment-method').textContent = this.getPaymentMethodText(order.payments);
        }
        
        // Valor
        if (document.getElementById('modal-order-total')) {
            document.getElementById('modal-order-total').textContent = `R$ ${(order.total/100).toFixed(2)}`;
        }
        
        // CPF/CNPJ
        if (document.getElementById('modal-customer-tax-id')) {
            document.getElementById('modal-customer-tax-id').textContent = 
                order.customer?.taxPayerIdentification?.number || '-';
        }
        
        // Cliente
        if (document.getElementById('modal-customer-name')) {
            document.getElementById('modal-customer-name').textContent = order.customer?.name || '-';
        }
        
        if (document.getElementById('modal-customer-phone')) {
            document.getElementById('modal-customer-phone').textContent = order.customer?.phone || '-';
        }
        
        // Entrega
        const deliverySection = document.getElementById('modal-delivery-section');
        if (deliverySection) {
            if (order.orderType === 'DELIVERY') {
                deliverySection.style.display = 'block';
                
                if (document.getElementById('modal-delivery-address')) {
                    document.getElementById('modal-delivery-address').textContent = 
                        order.delivery?.deliveryAddress?.formattedAddress || '-';
                }
                
                if (document.getElementById('modal-delivery-notes')) {
                    document.getElementById('modal-delivery-notes').textContent = 
                        order.delivery?.observations || '-';
                }
            } else {
                deliverySection.style.display = 'none';
            }
        }
        
        // Itens do pedido
        const itemsContainer = document.getElementById('modal-order-items');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemElem = document.createElement('div');
                    itemElem.className = 'order-item';
                    
                    itemElem.innerHTML = `
                        <div class="item-details">
                            <div class="item-name">${item.quantity}x ${item.name}</div>
                            ${item.observations ? `<div class="item-notes">${item.observations}</div>` : ''}
                        </div>
                        <div class="item-price">
                            R$ ${((item.totalPrice || item.price * item.quantity)/100).toFixed(2)}
                        </div>
                    `;
                    
                    itemsContainer.appendChild(itemElem);
                });
            } else {
                itemsContainer.innerHTML = '<p>Nenhum item encontrado.</p>';
            }
        }
        
        // Resumo
        if (document.getElementById('modal-subtotal')) {
            document.getElementById('modal-subtotal').textContent = `R$ ${(order.subTotal/100).toFixed(2)}`;
        }
        
        // Desconto
        const discountRow = document.getElementById('modal-discount-row');
        if (discountRow) {
            if (order.discount) {
                discountRow.style.display = 'flex';
                
                if (document.getElementById('modal-discount-value')) {
                    document.getElementById('modal-discount-value').textContent = 
                        `R$ ${(order.discount.value/100).toFixed(2)}`;
                }
                
                if (document.getElementById('modal-discount-sponsor')) {
                    document.getElementById('modal-discount-sponsor').textContent = 
                        order.discount.sponsor === 'MERCHANT' ? 'Loja' : 'iFood';
                }
            } else {
                discountRow.style.display = 'none';
            }
        }
        
        // Taxa de entrega
        const deliveryFeeRow = document.getElementById('modal-delivery-fee-row');
        if (deliveryFeeRow) {
            if (order.orderType === 'DELIVERY' && order.deliveryFee) {
                deliveryFeeRow.style.display = 'flex';
                
                if (document.getElementById('modal-delivery-fee')) {
                    document.getElementById('modal-delivery-fee').textContent = 
                        `R$ ${(order.deliveryFee/100).toFixed(2)}`;
                }
            } else {
                deliveryFeeRow.style.display = 'none';
            }
        }
        
        // Total
        if (document.getElementById('modal-total')) {
            document.getElementById('modal-total').textContent = `R$ ${(order.total/100).toFixed(2)}`;
        }
        
        // Troco
        const changeRow = document.getElementById('modal-change-row');
        if (changeRow) {
            const payment = order.payments?.find(p => p.method === 'CASH' && p.changeFor);
            
            if (payment) {
                changeRow.style.display = 'flex';
                
                if (document.getElementById('modal-change-for')) {
                    document.getElementById('modal-change-for').textContent = 
                        `R$ ${(payment.changeFor/100).toFixed(2)}`;
                }
            } else {
                changeRow.style.display = 'none';
            }
        }
        
        // Botões de ação
        this.updateOrderActionButtons(order);
        
        // Abre o modal
        const modal = document.getElementById('order-details-modal');
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    /**
     * Atualiza os botões de ação no modal com base no status do pedido
     * @param {Object} order Pedido atual
     */
    updateOrderActionButtons: function(order) {
        const confirmBtn = document.getElementById('modal-confirm-order');
        const dispatchBtn = document.getElementById('modal-dispatch-order');
        const readyBtn = document.getElementById('modal-ready-order');
        const cancelBtn = document.getElementById('modal-cancel-order');
        
        // Esconde todos os botões inicialmente
        if (confirmBtn) confirmBtn.style.display = 'none';
        if (dispatchBtn) dispatchBtn.style.display = 'none';
        if (readyBtn) readyBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        // Exibe os botões conforme o status
        switch (order.status) {
            case 'PENDING':
                if (confirmBtn) confirmBtn.style.display = 'flex';
                if (cancelBtn) cancelBtn.style.display = 'flex';
                break;
                
            case 'CONFIRMED':
                if (order.orderType === 'DELIVERY') {
                    if (dispatchBtn) dispatchBtn.style.display = 'flex';
                } else {
                    if (readyBtn) readyBtn.style.display = 'flex';
                }
                if (cancelBtn) cancelBtn.style.display = 'flex';
                break;
                
            case 'DISPATCHED':
                // Não tem ações disponíveis
                break;
                
            case 'READY':
                // Não tem ações disponíveis
                break;
                
            case 'CANCELLED':
                // Não tem ações disponíveis
                break;
        }
    },
    
    /**
     * Atualiza a UI com os pedidos
     */
    updateOrdersUI: function() {
        // Atualiza os cards de pedidos no dashboard
        this.updateDashboardOrdersUI();
        
        // Atualiza a lista completa de pedidos
        this.updateOrdersListUI();
    },
    
    /**
     * Atualiza os cards de pedidos na dashboard
     */
    updateDashboardOrdersUI: function() {
        const ordersContainer = document.getElementById('orders-container');
        if (!ordersContainer) return;
        
        // Limpa o container
        ordersContainer.innerHTML = '';
        
        // Filtra os pedidos ativos (exclui cancelados e concluídos)
        const activeOrders = this.orders.filter(o => 
            !['CANCELLED', 'CONCLUDED'].includes(o.status)
        );
        
        // Pega os 4 pedidos mais recentes
        const recentOrders = activeOrders.slice(0, 4);
        
        // Se não houver pedidos, exibe mensagem
        if (recentOrders.length === 0) {
            ordersContainer.innerHTML = '<p class="no-data">Nenhum pedido ativo.</p>';
            return;
        }
        
        // Cria os cards para cada pedido
        recentOrders.forEach(order => {
            this.createOrderCard(order, ordersContainer);
        });
    },
    
    /**
     * Atualiza a lista completa de pedidos
     */
    updateOrdersListUI: function() {
        const ordersListContainer = document.getElementById('orders-list-container');
        if (!ordersListContainer) return;
        
        // Limpa o container
        ordersListContainer.innerHTML = '';
        
        // Filtra os pedidos de acordo com o filtro selecionado
        const filterSelect = document.getElementById('order-filter');
        const filter = filterSelect ? filterSelect.value : 'all';
        
        const filteredOrders = this.filterOrders(this.orders, filter);
        
        // Se não houver pedidos, exibe mensagem
        if (filteredOrders.length === 0) {
            ordersListContainer.innerHTML = '<p class="no-data">Nenhum pedido encontrado.</p>';
            return;
        }
        
        // Cria o elemento de lista
        const ordersList = document.createElement('div');
        ordersList.className = 'orders-table';
        
        // Cabeçalho da tabela
        ordersList.innerHTML = `
            <div class="orders-table-header">
                <div class="order-column order-id">Pedido</div>
                <div class="order-column order-datetime">Data/Hora</div>
                <div class="order-column order-customer">Cliente</div>
                <div class="order-column order-type">Tipo</div>
                <div class="order-column order-total">Valor</div>
                <div class="order-column order-status">Status</div>
                <div class="order-column order-actions">Ações</div>
            </div>
        `;
        
        // Container para as linhas
        const ordersRows = document.createElement('div');
        ordersRows.className = 'orders-table-body';
        
        // Adiciona cada pedido à lista
        filteredOrders.forEach(order => {
            const orderRow = document.createElement('div');
            orderRow.className = 'order-row';
            
            // Formata a data
            const date = new Date(order.createdAt);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Tipo de pedido
            let orderTypeText = order.orderType === 'DELIVERY' ? 'Entrega' : 'Retirada';
            if (order.orderTiming === 'SCHEDULED') {
                orderTypeText += '<br><span class="scheduled">Agendado</span>';
            }
            
            orderRow.innerHTML = `
                <div class="order-column order-id">#${order.orderNumber}</div>
                <div class="order-column order-datetime">
                    <div class="date">${formattedDate}</div>
                    <div class="time">${formattedTime}</div>
                </div>
                <div class="order-column order-customer">${order.customer?.name || '-'}</div>
                <div class="order-column order-type">${orderTypeText}</div>
                <div class="order-column order-total">R$ ${(order.total/100).toFixed(2)}</div>
                <div class="order-column order-status">
                    <span class="order-status ${order.status.toLowerCase()}">${this.getStatusText(order.status)}</span>
                </div>
                <div class="order-column order-actions">
                    <button class="view-order-btn" data-id="${order.id}">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </div>
            `;
            
            ordersRows.appendChild(orderRow);
        });
        
        // Adiciona as linhas à tabela
        ordersList.appendChild(ordersRows);
        
        // Adiciona a tabela ao container
        ordersListContainer.appendChild(ordersList);
        
        // Adiciona eventos aos botões
        const viewButtons = ordersListContainer.querySelectorAll('.view-order-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.showOrderDetails(btn.dataset.id);
            });
        });
    },
    
    /**
     * Filtra os pedidos de acordo com o filtro selecionado
     * @param {Array} orders Lista de pedidos
     * @param {string} filter Filtro aplicado
     * @returns {Array} Lista de pedidos filtrados
     */
    filterOrders: function(orders, filter) {
        switch (filter) {
            case 'pending':
                return orders.filter(o => o.status === 'PENDING');
            case 'confirmed':
                return orders.filter(o => o.status === 'CONFIRMED');
            case 'dispatched':
                return orders.filter(o => o.status === 'DISPATCHED' || o.status === 'READY');
            case 'delivered':
                return orders.filter(o => o.status === 'CONCLUDED');
            case 'cancelled':
                return orders.filter(o => o.status === 'CANCELLED');
            case 'all':
            default:
                return [...orders];
        }
    },
    
    /**
     * Cria um card de pedido
     * @param {Object} order Pedido a ser exibido
     * @param {HTMLElement} container Container onde o card será adicionado
     */
    createOrderCard: function(order, container) {
        // Cria o elemento do card
        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.id = order.id;
        
        // Formata a data
        const date = new Date(order.createdAt);
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // HTML do card
        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-id">#${order.orderNumber}</div>
                <div class="order-time">${formattedTime}</div>
            </div>
            <div class="order-card-body">
                <div class="order-type-info">
                    <div class="order-type">
                        <i class="fas ${order.orderType === 'DELIVERY' ? 'fa-motorcycle' : 'fa-shopping-bag'}"></i>
                        ${order.orderType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                        ${order.orderTiming === 'SCHEDULED' ? ' <span class="scheduled">(Agendado)</span>' : ''}
                    </div>
                    <div class="order-price">R$ ${(order.total/100).toFixed(2)}</div>
                </div>
                <div class="order-customer">
                    <div class="customer-name">${order.customer?.name || '-'}</div>
                    ${order.orderType === 'DELIVERY' && order.delivery?.deliveryAddress ? 
                        `<div class="customer-address">${order.delivery.deliveryAddress.formattedAddress}</div>` : ''}
                </div>
                <div class="order-items">
                    <div class="items-title">Itens:</div>
                    <div class="items-list">
                        ${order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'Nenhum item'}
                    </div>
                </div>
            </div>
            <div class="order-card-footer">
                <div class="order-status ${order.status.toLowerCase()}">${this.getStatusText(order.status)}</div>
                <button class="order-detail-btn" data-id="${order.id}">Ver detalhes</button>
            </div>
        `;
        
        // Adiciona o card ao container
        container.appendChild(card);
        
        // Adiciona evento de clique para exibir detalhes
        const detailBtn = card.querySelector('.order-detail-btn');
        if (detailBtn) {
            detailBtn.addEventListener('click', () => {
                this.showOrderDetails(order.id);
            });
        }
        
        // Adiciona evento de clique para o card inteiro
        card.addEventListener('click', (e) => {
            // Ignora clique se foi no botão de detalhes (já tratado acima)
            if (e.target.closest('.order-detail-btn')) return;
            
            this.showOrderDetails(order.id);
        });
    },
    
    /**
     * Atualiza as estatísticas de pedidos no dashboard
     */
    updateOrdersStats: function() {
        // Total de pedidos hoje
        const totalOrdersElem = document.getElementById('total-orders');
        if (totalOrdersElem) {
            // Filtra pedidos de hoje
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayOrders = this.orders.filter(o => {
                const orderDate = new Date(o.createdAt);
                return orderDate >= today;
            });
            
            totalOrdersElem.textContent = todayOrders.length;
        }
        
        // Faturamento total
        const totalRevenueElem = document.getElementById('total-revenue');
        if (totalRevenueElem) {
            // Calcula faturamento (soma dos totais dos pedidos concluídos)
            const revenue = this.orders
                .filter(o => ['CONCLUDED', 'DISPATCHED', 'READY'].includes(o.status))
                .reduce((total, order) => total + order.total, 0);
            
            totalRevenueElem.textContent = `R$ ${(revenue/100).toFixed(2)}`;
        }
        
        // Avaliação média (simulada)
        const avgRatingElem = document.getElementById('avg-rating');
        if (avgRatingElem) {
            avgRatingElem.textContent = '4.8';
        }
        
        // Tempo médio de preparo (simulado)
        const avgTimeElem = document.getElementById('avg-time');
        if (avgTimeElem) {
            avgTimeElem.textContent = '28 min';
        }
    },
    
    /**
     * Toca o som de notificação para novos pedidos
     */
    playNewOrderSound: function() {
        // Verifica se o som está habilitado
        const soundEnabled = document.getElementById('sound-alert')?.checked !== false;
        
        if (soundEnabled) {
            const sound = document.getElementById('new-order-sound');
            if (sound) {
                sound.play().catch(e => console.log('Não foi possível reproduzir o som:', e));
            }
        }
    },
    
    /**
     * Obtém o texto do status para exibição
     * @param {string} status Status do pedido
     * @returns {string} Texto do status
     */
    getStatusText: function(status) {
        switch (status) {
            case 'PENDING':
                return 'Pendente';
            case 'CONFIRMED':
                return 'Confirmado';
            case 'DISPATCHED':
                return 'Despachado';
            case 'READY':
                return 'Pronto para Retirada';
            case 'CONCLUDED':
                return 'Concluído';
            case 'CANCELLED':
                return 'Cancelado';
            default:
                return status;
        }
    },
    
    /**
     * Obtém o texto do método de pagamento para exibição
     * @param {Array} payments Pagamentos do pedido
     * @returns {string} Texto do método de pagamento
     */
    getPaymentMethodText: function(payments) {
        if (!payments || payments.length === 0) return 'Não informado';
        
        const payment = payments[0];
        
        // Métodos de pagamento
        switch (payment.method) {
            case 'CREDIT':
                return `Cartão de Crédito ${payment.brand ? `(${payment.brand})` : ''}`;
            case 'DEBIT':
                return `Cartão de Débito ${payment.brand ? `(${payment.brand})` : ''}`;
            case 'CASH':
                return 'Dinheiro';
            case 'MEAL_VOUCHER':
                return 'Vale Refeição';
            case 'FOOD_VOUCHER':
                return 'Vale Alimentação';
            case 'PIX':
                return 'Pix';
            default:
                return payment.method;
        }
    },
    
    /**
     * Gera um nome de cliente aleatório para simulação
     * @returns {string} Nome aleatório
     */
    getRandomCustomerName: function() {
        const firstNames = ['Maria', 'João', 'Ana', 'Pedro', 'Lucas', 'Julia', 'Carlos', 'Fernanda', 'Rafael', 'Mariana'];
        const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Carvalho', 'Almeida', 'Rodrigues'];
        
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        
        return `${firstName} ${lastName}`;
    },
    
    /**
     * Gera um número de telefone aleatório para simulação
     * @returns {string} Telefone aleatório
     */
    generateRandomPhone: function() {
        const ddd = Math.floor(Math.random() * 89) + 11; // DDDs entre 11 e 99
        const part1 = Math.floor(Math.random() * 9000) + 1000; // 4 dígitos
        const part2 = Math.floor(Math.random() * 9000) + 1000; // 4 dígitos
        
        return `(${ddd}) 9${part1}-${part2}`;
    },
    
    /**
     * Gera um CPF aleatório para simulação
     * @returns {string} CPF aleatório formatado
     */
    generateRandomCPF: function() {
        const n1 = Math.floor(Math.random() * 10);
        const n2 = Math.floor(Math.random() * 10);
        const n3 = Math.floor(Math.random() * 10);
        const n4 = Math.floor(Math.random() * 10);
        const n5 = Math.floor(Math.random() * 10);
        const n6 = Math.floor(Math.random() * 10);
        const n7 = Math.floor(Math.random() * 10);
        const n8 = Math.floor(Math.random() * 10);
        const n9 = Math.floor(Math.random() * 10);
        
        // Apenas para formatação, não é um CPF válido com dígitos verificadores corretos
        return `${n1}${n2}${n3}.${n4}${n5}${n6}.${n7}${n8}${n9}-00`;
    },
    
    /**
     * Gera um endereço aleatório para simulação
     * @returns {string} Endereço aleatório
     */
    getRandomAddress: function() {
        const streets = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Alameda Santos', 'Rua Oscar Freire', 'Av. Brigadeiro Faria Lima'];
        const numbers = [123, 456, 789, 1000, 2500, 360, 720];
        const neighborhoods = ['Centro', 'Jardins', 'Pinheiros', 'Vila Madalena', 'Moema', 'Itaim Bibi'];
        const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'];
        const states = ['SP', 'RJ', 'MG', 'PR', 'RS'];
        
        const street = streets[Math.floor(Math.random() * streets.length)];
        const number = numbers[Math.floor(Math.random() * numbers.length)];
        const neighborhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
        const cityIndex = Math.floor(Math.random() * cities.length);
        
        return `${street}, ${number} - ${neighborhood}, ${cities[cityIndex]} - ${states[cityIndex]}`;
    }
};
