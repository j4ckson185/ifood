/**
 * Módulo de autenticação para gerenciar tokens de acesso à API iFood
 */

// Atribuir ao objeto global
window.AUTH = {
    // URL base para a API de produção
    baseUrl: '/.netlify/functions/proxy-api',
    
    // Credenciais de autenticação
    credentials: {
        client_id: 'e6415912-782e-4bd9-b6ea-af48c81ae323',
        client_secret: '', // Segredo do cliente, se aplicável
        merchantId: '2733980',
        merchantUuid: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143'
    },
    
    // Informações do token
    token: {
        access_token: '',
        refresh_token: '',
        expires_at: 0,
        token_type: 'bearer'
    },
    
    // Inicializa o módulo de autenticação
    init: function() {
        console.log("Inicializando módulo AUTH");
        
        // Carregar credenciais do localStorage
        this.loadCredentialsFromStorage();
        
        // Carregar token do localStorage
        this.loadTokenFromStorage();
        
        // Atualiza a UI com o ID do merchant
        this.updateMerchantDisplay();
        
        // Preencher campos do formulário de configurações
        this.updateSettingsForm();
        
        // Inicia o processo de manutenção do token
        this.startTokenMaintenanceTimer();
    },
    
    // Carrega credenciais do localStorage
    loadCredentialsFromStorage: function() {
        const savedCredentials = localStorage.getItem('ifood_credentials');
        if (savedCredentials) {
            try {
                const parsed = JSON.parse(savedCredentials);
                this.credentials = {
                    ...this.credentials,
                    ...parsed
                };
            } catch (e) {
                console.error("Erro ao carregar credenciais:", e);
            }
        }
    },
    
    // Carrega token do localStorage
    loadTokenFromStorage: function() {
        const savedToken = localStorage.getItem('ifood_token');
        if (savedToken) {
            try {
                const parsedToken = JSON.parse(savedToken);
                this.token = parsedToken;
            } catch (e) {
                console.error("Erro ao carregar token:", e);
            }
        }
    },
    
    // Atualiza display do merchant
    updateMerchantDisplay: function() {
        const merchantDisplay = document.getElementById('merchant-id-display');
        if (merchantDisplay) {
            merchantDisplay.textContent = this.credentials.merchantUuid;
        }
    },
    
    // Atualiza formulário de configurações
    updateSettingsForm: function() {
        const fields = [
            { id: 'client-id', value: this.credentials.client_id },
            { id: 'client-secret', value: this.credentials.client_secret },
            { id: 'merchant-id-input', value: this.credentials.merchantId },
            { id: 'merchant-uuid-input', value: this.credentials.merchantUuid }
        ];
        
        fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) element.value = field.value;
        });
    },
    
    // Salva credenciais
    saveCredentials: function(newCredentials) {
        this.credentials = {
            ...this.credentials,
            ...newCredentials
        };
        
        localStorage.setItem('ifood_credentials', JSON.stringify(this.credentials));
        this.updateMerchantDisplay();
        console.log("Credenciais atualizadas:", this.credentials);
    },
    
    // Verifica se o token está expirado
    isTokenExpired: function() {
        // Se não há token, está expirado
        if (!this.token.access_token) return true;
        
        // Verifica expiração com 5 minutos de antecedência
        const currentTime = Date.now();
        const expirationBuffer = 5 * 60 * 1000; // 5 minutos
        
        return currentTime >= (this.token.expires_at - expirationBuffer);
    },
    
    // Inicia timer para manutenção do token
    startTokenMaintenanceTimer: function() {
        // Verifica o token a cada 15 minutos
        setInterval(() => {
            if (this.isTokenExpired()) {
                this.refreshAccessToken();
            }
        }, 15 * 60 * 1000);
    },
    
    // Obtém um novo token de acesso
    refreshAccessToken: function() {
        const self = this;
        return new Promise((resolve, reject) => {
            console.log('Iniciando renovação de token...');
            
            // Prepara dados para renovação
            const formData = new URLSearchParams();
            formData.append('grant_type', 'client_credentials');
            formData.append('client_id', this.credentials.client_id);
            
            // Adiciona client_secret se existir
            if (this.credentials.client_secret) {
                formData.append('client_secret', this.credentials.client_secret);
            }
            
            fetch(this.baseUrl + '/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha na renovação do token');
                }
                return response.json();
            })
            .then(tokenData => {
                // Salva o novo token
                self.saveToken(tokenData);
                
                console.log('Token renovado com sucesso');
                showToast('success', 'Token atualizado automaticamente');
                
                resolve(tokenData);
            })
            .catch(error => {
                console.error('Erro na renovação do token:', error);
                showToast('error', 'Falha ao atualizar token');
                reject(error);
            });
        });
    },
    
    // Salva o token
    saveToken: function(tokenData) {
        // Calcula tempo de expiração
        const currentTime = Date.now();
        const expiresIn = tokenData.expires_in 
            ? parseInt(tokenData.expires_in) * 1000  // converte para milissegundos
            : 21599 * 1000;  // Tempo padrão de 21599 segundos
        
        this.token = {
            access_token: tokenData.access_token || '',
            refresh_token: tokenData.refresh_token || this.token.refresh_token || '',
            expires_at: currentTime + expiresIn,
            token_type: tokenData.token_type || 'bearer'
        };
        
        // Salva no localStorage
        localStorage.setItem('ifood_token', JSON.stringify(this.token));
        
        console.log(`Token atualizado. Expira em: ${new Date(this.token.expires_at).toLocaleString()}`);
    },
    
    // Obtém o token de acesso
    getAccessToken: function() {
        const self = this;
        return new Promise((resolve, reject) => {
            // Se o token estiver expirado, renova
            if (this.isTokenExpired()) {
                this.refreshAccessToken()
                    .then(() => resolve(this.token.access_token))
                    .catch(reject);
            } else {
                // Retorna o token atual
                resolve(this.token.access_token);
            }
        });
    },
    
    // Obtém headers de autenticação
    getAuthHeaders: function() {
        return this.getAccessToken()
            .then(token => ({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }));
    },
    
    // Realiza uma requisição autenticada
    apiRequest: function(endpoint, options = {}) {
        const self = this;
        
        return new Promise((resolve, reject) => {
            this.getAuthHeaders()
                .then(headers => {
                    const fetchOptions = {
                        method: options.method || 'GET',
                        headers: { ...headers, ...options.headers }
                    };
                    
                    if (options.body) {
                        fetchOptions.body = options.body;
                    }
                    
                    return fetch(this.baseUrl + endpoint, fetchOptions);
                })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(errorText => {
                            throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
                        });
                    }
                    return response.json();
                })
                .then(resolve)
                .catch(reject);
        });
    }
};
