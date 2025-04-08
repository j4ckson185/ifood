/**
 * Arquivo principal que inicializa a aplicação
 */

// Inicializa a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM carregado, iniciando aplicação...");
    
    // Verifica se os objetos foram carregados
    if (typeof window.AUTH === 'undefined' || 
        typeof window.MERCHANT === 'undefined' || 
        typeof window.ORDERS === 'undefined' || 
        typeof window.REVIEWS === 'undefined') {
        console.error("Erro: Objetos globais não estão definidos!");
        alert("Erro ao inicializar aplicação. Verifique se todos os scripts foram carregados.");
        return;
    }
    
    // Verifica se as funções init existem
    if (typeof window.AUTH.init !== 'function') {
        console.error("Erro: AUTH.init não é uma função!");
        return;
    }
    
    if (typeof window.MERCHANT.init !== 'function') {
        console.error("Erro: MERCHANT.init não é uma função!");
        return;
    }
    
    if (typeof window.ORDERS.init !== 'function') {
        console.error("Erro: ORDERS.init não é uma função!");
        return;
    }
    
    if (typeof window.REVIEWS.init !== 'function') {
        console.error("Erro: REVIEWS.init não é uma função!");
        return;
    }
    
    // Inicializa a aplicação
    initApp();
});

function initApp() {
    try {
        console.log("Iniciando aplicação...");
        
        // Inicializa os módulos
        window.AUTH.init();
        window.MERCHANT.init();
        window.ORDERS.init();
        window.REVIEWS.init();
        
        // Configura listeners de eventos para UI
        setupUIEvents();
        
        // Carrega dados iniciais após 500ms
        setTimeout(function() {
            loadInitialData();
        }, 500);
        
        console.log("Aplicação iniciada com sucesso!");
    } catch (error) {
        console.error("Erro ao inicializar a aplicação:", error);
        alert("Erro ao inicializar aplicação: " + error.message);
    }
}

/**
 * Configura eventos de UI globais
 */
function setupUIEvents() {
    // Menu lateral - alternar entre seções
    var menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(function(item) {
        item.addEventListener('click', function() {
            // Remove classe active de todos os itens
            menuItems.forEach(function(i) {
                i.classList.remove('active');
            });
            
            // Adiciona classe active ao item clicado
            this.classList.add('active');
            
            // Obtém a seção a ser mostrada
            var sectionId = this.dataset.section;
            
            // Atualiza o título da seção
            var sectionTitle = this.querySelector('span').textContent;
            document.getElementById('current-section-title').textContent = sectionTitle;
            
            // Esconde todas as seções
            var sections = document.querySelectorAll('.content-section');
            sections.forEach(function(s) {
                s.classList.remove('active');
            });
            
            // Mostra a seção selecionada
            var selectedSection = document.getElementById(sectionId);
            if (selectedSection) {
                selectedSection.classList.add('active');
            }
        });
    });
    
    // Toggle do menu lateral em dispositivos móveis
    var sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            var sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('mobile-active');
        });
    }
    
    // Botões para fechar modais
    var closeButtons = document.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            var modal = this.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Fecha modal clicando fora
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Salvar configurações de API
    var saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            var clientId = document.getElementById('client-id').value;
            var clientSecret = document.getElementById('client-secret').value;
            var merchantId = document.getElementById('merchant-id-input').value;
            var merchantUuid = document.getElementById('merchant-uuid-input').value;
            
            // Salva as credenciais
            AUTH.saveCredentials({
                client_id: clientId,
                client_secret: clientSecret,
                merchantId: merchantId,
                merchantUuid: merchantUuid
            });
            
            showToast('success', 'Configurações salvas com sucesso!');
            
            // Recarrega os dados com as novas configurações
            loadInitialData();
        });
    }
    
    // Salvar preferências
    var savePreferencesBtn = document.getElementById('save-preferences');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', function() {
            // Salva as preferências no localStorage
            var autoRefresh = document.getElementById('auto-refresh').checked;
            var soundAlert = document.getElementById('sound-alert').checked;
            var darkMode = document.getElementById('dark-mode').checked;
            
            localStorage.setItem('preferences', JSON.stringify({
                autoRefresh: autoRefresh,
                soundAlert: soundAlert,
                darkMode: darkMode
            }));
            
            // Aplica modo escuro se necessário
            document.body.classList.toggle('dark-mode', darkMode);
            
            showToast('success', 'Preferências salvas com sucesso!');
        });
    }
    
    // Carrega preferências salvas
    var savedPreferences = localStorage.getItem('preferences');
    if (savedPreferences) {
        try {
            var preferences = JSON.parse(savedPreferences);
            
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
    MERCHANT.loadAllMerchantData().catch(function(err) {
        console.error('Erro ao carregar dados do merchant:', err);
    });
    
    // Carrega pedidos
    ORDERS.fetchOrders().catch(function(err) {
        console.error('Erro ao carregar pedidos:', err);
    });
    
    // Carrega avaliações
    REVIEWS.fetchReviews().catch(function(err) {
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
    var toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Define o ícone com base no tipo
    var icon = '';
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
    var container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Adiciona evento para fechar o toast
    var closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            container.removeChild(toast);
        });
    }
    
    // Remove automaticamente após 3 segundos
    setTimeout(function() {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}
