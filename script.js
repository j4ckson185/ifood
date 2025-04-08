/**
 * Arquivo principal que inicializa a aplicação
 */

// Inicializa a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

/**
 * Inicializa a aplicação
 */
function initApp() {
    // Inicializa o módulo de autenticação
    AUTH.init();
    
    // Inicializa o módulo de merchant
    MERCHANT.init();
    
    // Inicializa o módulo de pedidos
    ORDERS.init();
    
    // Inicializa o módulo de avaliações
    REVIEWS.init();
    
    // Configura listeners de eventos para UI
    setupUIEvents();
    
    // Carrega dados iniciais após 500ms para garantir que todos os módulos foram inicializados
    setTimeout(() => {
        loadInitialData();
    }, 500);
}

/**
 * Configura eventos de UI globais
 */
function setupUIEvents() {
    // Menu lateral - alternar entre seções
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove classe active de todos os itens
            menuItems.forEach(i => i.classList.remove('active'));
            
            // Adiciona classe active ao item clicado
            this.classList.add('active');
            
            // Obtém a seção a ser mostrada
            const sectionId = this.dataset.section;
            
            // Atualiza o título da seção
            const sectionTitle = this.querySelector('span').textContent;
            document.getElementById('current-section-title').textContent = sectionTitle;
            
            // Esconde todas as seções
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(s => s.classList.remove('active'));
            
            // Mostra a seção selecionada
            const selectedSection = document.getElementById(sectionId);
            if (selectedSection) {
                selectedSection.classList.add('active');
            }
        });
    });
    
    // Toggle do menu lateral em dispositivos móveis
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('mobile-active');
        });
    }
    
    // Botões para fechar modais
    const closeButtons = document.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Fecha modal clicando fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Salvar configurações de API
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            const clientId = document.getElementById('client-id').value;
            const clientSecret = document.getElementById('client-secret').value;
            const merchantId = document.getElementById('merchant-id-input').value;
            const merchantUuid = document.getElementById('merchant-uuid-input').value;
            
            // Salva as credenciais
            AUTH.saveCredentials({
                client_id: clientId,
                client_secret: clientSecret,
                merchantId,
                merchantUuid
            });
            
            showToast('success', 'Configurações salvas com sucesso!');
            
            // Recarrega os dados com as novas configurações
            loadInitialData();
        });
    }
    
    // Salvar preferências
    const savePreferencesBtn = document.getElementById('save-preferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', function() {
            // Salva as preferências no localStorage
            const autoRefresh = document.getElementById('auto-refresh').checked;
            const soundAlert = document.getElementById('sound-alert').checked;
            const darkMode = document.getElementById('dark-mode').checked;
            
            localStorage.setItem('preferences', JSON.stringify({
                autoRefresh,
                soundAlert,
                darkMode
            }));
            
            // Aplica modo escuro se necessário
            document.body.classList.toggle('dark-mode', darkMode);
            
            showToast('success', 'Preferências salvas com sucesso!');
        });
    }
    
    // Carrega preferências salvas
    const savedPreferences = localStorage.getItem('preferences');
    if (savedPreferences) {
        try {
            const preferences = JSON.parse(savedPreferences);
            
            // Aplica preferências
            if (document.getElementById('auto-refresh')) {
                document.getElementById('auto-refresh').checked = preferences.autoRefresh !== false;
            }
            
            if (document.getElementById('sound-alert')) {
                document.getElementById('sound-alert').checked = preferences.soundAlert !== false;
            }
            
            if (document.getElementById('dark-mode')) {
                document.getElementById('dark-mode').checked = !!preferences.darkMode;
                document.body.classList.toggle('dark-mode', preferences.darkMode);
            }
        } catch (err) {
            console.error('Erro ao carregar preferências:', err);
        }
    }
}

/**
 * Carrega dados iniciais da aplicação
 */
function loadInitialData() {
    // Carrega dados do merchant
    MERCHANT.loadAllMerchantData().catch(err => {
        console.error('Erro ao carregar dados do merchant:', err);
    });
    
    // Carrega pedidos
    ORDERS.fetchOrders().catch(err => {
        console.error('Erro ao carregar pedidos:', err);
    });
    
    // Carrega avaliações
    REVIEWS.fetchReviews().catch(err => {
        console.error('Erro ao carregar avaliações:', err);
    });
}

/**
 * Exibe um indicador de carregamento
 * @param {boolean} show Se deve mostrar ou esconder o indicador
 */
function showLoading(show) {
    // Implementar indicador de carregamento
    // Por simplicidade, apenas exibe uma mensagem no console
    console.log(show ? 'Carregando...' : 'Carregamento concluído.');
}

/**
 * Exibe uma notificação toast
 * @param {string} type Tipo de toast (success, error, warning, info)
 * @param {string} message Mensagem a ser exibida
 */
function showToast(type, message) {
    // Cria o elemento toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Define o ícone com base no tipo
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i>';
            break;
    }
    
    // Define o conteúdo do toast
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    // Adiciona ao container
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Adiciona evento para fechar o toast
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            container.removeChild(toast);
        });
    }
    
// Remove automaticamente após 3 segundos
    setTimeout(() => {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}
