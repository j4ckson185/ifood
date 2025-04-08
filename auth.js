/**
 * Módulo de autenticação para gerenciar autenticação distribuída com a API iFood
 */

// Atribuir ao objeto global
window.AUTH = {
    // URL base para a API de produção
    baseUrl: '/.netlify/functions/proxy-api',
    
    // Credenciais de autenticação
    credentials: {
        client_id: '6015fafa-fd3e-4053-9080-bfdbf6e78526',
        client_secret: 'p1jv9gtn6loszhrl6tmcpwaeuk21w4ukrudeinuzfwihb9fqdutubsbbggav8rkbsiqgik45kdgdp471ua2ivmh25dz7mywcfc4',
        merchantId: '2733980',
        merchantUuid: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143'
    },
    
    // Informações do código de usuário e verificação
    userCodeInfo: {
        userCode: '',
        verificationUrl: '',
        verificationUrlComplete: '',
        expiresIn: 0,
        interval: 0,
        verifier: '' // Código verificador para usar na obtenção do token
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
        
        // Carrega as credenciais do localStorage
        var savedCredentials = localStorage.getItem('ifood_credentials');
        if (savedCredentials) {
            try {
                var parsed = JSON.parse(savedCredentials);
                this.credentials = {
                    client_id: parsed.client_id || this.credentials.client_id,
                    client_secret: parsed.client_secret || this.credentials.client_secret,
                    merchantId: parsed.merchantId || this.credentials.merchantId,
                    merchantUuid: parsed.merchantUuid || this.credentials.merchantUuid
                };
            } catch (e) {
                console.error("Erro ao analisar credenciais salvas:", e);
            }
        }
        
        // Carrega o token do localStorage
        var savedToken = localStorage.getItem('ifood_token');
        if (savedToken) {
            try {
                this.token = JSON.parse(savedToken);
            } catch (e) {
                console.error("Erro ao analisar token salvo:", e);
                this.token = {
                    access_token: '',
                    refresh_token: '',
                    expires_at: 0,
                    token_type: 'bearer'
                };
            }
        }

        // Carrega informações do código de usuário do localStorage
        var savedUserCode = localStorage.getItem('ifood_user_code');
        if (savedUserCode) {
            try {
                this.userCodeInfo = JSON.parse(savedUserCode);
            } catch (e) {
                console.error("Erro ao analisar código de usuário salvo:", e);
            }
        }
        
        // Atualiza a UI com o ID do merchant
        if (document.getElementById('merchant-id-display')) {
            document.getElementById('merchant-id-display').textContent = this.credentials.merchantId;
        }
        
        // Preencher campos do formulário de configurações com valores atuais
        this.updateSettingsForm();

        // Adiciona os event listeners para os botões de autenticação
        document.getElementById('generate-user-code')?.addEventListener('click', () => this.generateUserCode());
        document.getElementById('check-auth-status')?.addEventListener('click', () => this.checkAuthStatus());
    },

    // Gera o código de usuário para autenticação
    generateUserCode: async function() {
        try {
            showLoading(true);

            // Prepara os dados como form-url-encoded
            const formData = new URLSearchParams();
            formData.append('clientId', this.credentials.client_id);
            formData.append('grantType', 'authorization_code');

            const response = await fetch(this.baseUrl + '/oauth/userCode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Resposta de erro:', errorText);
                throw new Error('Falha ao gerar código de usuário: ' + errorText);
            }

            const data = await response.json();
            
            // Salva as informações do código
            this.userCodeInfo = {
                userCode: data.userCode,
                verificationUrl: data.verificationUrl,
                verificationUrlComplete: data.verificationUrlComplete,
                expiresIn: data.expiresIn,
                interval: data.interval,
                verifier: data.verifier
            };

            // Salva no localStorage
            localStorage.setItem('ifood_user_code', JSON.stringify(this.userCodeInfo));

            // Atualiza a UI
            this.updateUserCodeUI();

            // Inicia a verificação periódica
            this.startAuthCheck();

            showToast('success', 'Código de autenticação gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar código de usuário:', error);
            showToast('error', 'Erro ao gerar código de autenticação');
        } finally {
            showLoading(false);
        }
    },

    // Atualiza a UI com as informações do código de usuário
    updateUserCodeUI: function() {
        const authStatus = document.getElementById('auth-status');
        const userCodeDisplay = document.getElementById('user-code-display');
        const verificationUrl = document.getElementById('verification-url');
        const expiresIn = document.getElementById('expires-in');

        if (authStatus && this.userCodeInfo.userCode) {
            authStatus.style.display = 'block';
            userCodeDisplay.textContent = this.userCodeInfo.userCode;
            verificationUrl.href = this.userCodeInfo.verificationUrlComplete;
            verificationUrl.textContent = this.userCodeInfo.verificationUrl;

            // Calcula o tempo restante
            const expirationTime = new Date(Date.now() + (this.userCodeInfo.expiresIn * 1000));
            expiresIn.textContent = `Expira em: ${expirationTime.toLocaleTimeString()}`;
        }
    },

    // Inicia a verificação periódica do status da autenticação
    startAuthCheck: function() {
        console.log('Iniciando verificação periódica...');
        
        // Limpa qualquer intervalo existente
        if (this._authCheckInterval) {
            clearInterval(this._authCheckInterval);
        }

        // Faz a primeira verificação imediatamente
        this.checkAuthStatus();

        // Define o intervalo para verificações subsequentes
        // Usa um intervalo mínimo de 5 segundos ou o intervalo sugerido pela API
        const checkInterval = Math.max(5, this.userCodeInfo.interval || 5) * 1000;
        console.log(`Configurando verificação a cada ${checkInterval/1000} segundos`);

        this._authCheckInterval = setInterval(() => {
            this.checkAuthStatus();
        }, checkInterval);

        // Define um timeout para parar as verificações após o tempo de expiração
        const expiresIn = (this.userCodeInfo.expiresIn || 600) * 1000; // 10 minutos padrão
        console.log(`Verificação será interrompida em ${expiresIn/1000} segundos`);

        setTimeout(() => {
            if (this._authCheckInterval) {
                console.log('Tempo expirado, parando verificação');
                clearInterval(this._authCheckInterval);
                this._authCheckInterval = null;
                showToast('warning', 'Tempo de autenticação expirou. Gere um novo código se necessário.');
            }
        }, expiresIn);
    },

    // Verifica o status da autenticação
    checkAuthStatus: async function() {
        try {
            if (!this.userCodeInfo.userCode) {
                console.log('Nenhum código de autenticação ativo');
                if (this._authCheckInterval) {
                    clearInterval(this._authCheckInterval);
                    this._authCheckInterval = null;
                }
                return;
            }

            console.log('Verificando status para o código:', this.userCodeInfo.userCode);

            const response = await fetch(this.baseUrl + '/oauth/userCode/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'user-code': this.userCodeInfo.userCode
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta do status:', errorText);
                throw new Error('Falha ao verificar status: ' + errorText);
            }

            const data = await response.json();
            console.log('Status recebido:', data);

            if (data.status === 'AUTHORIZATION_PENDING') {
                console.log('Aguardando autorização do usuário...');
                showToast('info', 'Aguardando autorização do usuário...');
            } else if (data.status === 'AUTHORIZATION_GRANTED') {
                console.log('Autorização concedida! Código:', data.authorizationCode);
                // Limpa o intervalo de verificação
                if (this._authCheckInterval) {
                    clearInterval(this._authCheckInterval);
                    this._authCheckInterval = null;
                }

                // Obtém o token de acesso
                await this.getTokenWithAuthCode(data.authorizationCode);
            } else if (data.status === 'EXPIRED') {
                console.log('Código expirado');
                showToast('error', 'Código expirado. Gere um novo código.');
                if (this._authCheckInterval) {
                    clearInterval(this._authCheckInterval);
                    this._authCheckInterval = null;
                }
            }
        } catch (error) {
            console.error('Erro detalhado ao verificar status:', error);
            // Não mostra toast de erro para não sobrecarregar a interface
            // showToast('error', 'Erro ao verificar status da autenticação');
            
            // Se o erro for de código expirado ou inválido, para a verificação
            if (error.message.includes('404') || error.message.includes('EXPIRED')) {
                console.log('Parando verificação devido a código inválido ou expirado');
                if (this._authCheckInterval) {
                    clearInterval(this._authCheckInterval);
                    this._authCheckInterval = null;
                }
            }
        }
    },

    // Obtém o token de acesso usando o código de autorização
    getTokenWithAuthCode: async function(authorizationCode) {
        try {
            const response = await fetch(this.baseUrl + '/authentication/v1.0/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code: authorizationCode,
                    client_id: this.credentials.client_id,
                    client_secret: this.credentials.client_secret,
                    verifier: this.userCodeInfo.verifier
                })
            });

            if (!response.ok) {
                throw new Error('Falha ao obter token de acesso');
            }

            const tokenData = await response.json();
            this.saveToken(tokenData);

            showToast('success', 'Autenticação concluída com sucesso!');
        } catch (error) {
            console.error('Erro ao obter token de acesso:', error);
            showToast('error', 'Erro ao obter token de acesso');
        }
    },
    
    // Atualiza os campos do formulário de configurações
    updateSettingsForm: function() {
        var clientIdInput = document.getElementById('client-id');
        var clientSecretInput = document.getElementById('client-secret');
        var merchantIdInput = document.getElementById('merchant-id-input');
        var merchantUuidInput = document.getElementById('merchant-uuid-input');
        
        if (clientIdInput) clientIdInput.value = this.credentials.client_id;
        if (clientSecretInput) clientSecretInput.value = this.credentials.client_secret;
        if (merchantIdInput) merchantIdInput.value = this.credentials.merchantId;
        if (merchantUuidInput) merchantUuidInput.value = this.credentials.merchantUuid;
    },
    
    // Salva as credenciais no localStorage
    saveCredentials: function(credentials) {
        var updated = {
            client_id: credentials.client_id || this.credentials.client_id,
            client_secret: credentials.client_secret || this.credentials.client_secret,
            merchantId: credentials.merchantId || this.credentials.merchantId,
            merchantUuid: credentials.merchantUuid || this.credentials.merchantUuid
        };
        
        this.credentials = updated;
        localStorage.setItem('ifood_credentials', JSON.stringify(this.credentials));
        
        // Atualiza a UI com o ID do merchant
        if (document.getElementById('merchant-id-display')) {
            document.getElementById('merchant-id-display').textContent = this.credentials.merchantId;
        }
        
        console.log("Credenciais salvas:", this.credentials);
    },
    
    // Método para verificar expiração do token
    isTokenExpired: function() {
        if (!this.token.access_token) return true;
        if (!this.token.expires_at) return true;
        
        const currentTime = Date.now();
        const expirationBuffer = 15 * 60 * 1000; // 15 minutos
        
        return currentTime >= (this.token.expires_at - expirationBuffer);
    },
    
    // Método para salvar o token com tratamento adicional
    saveToken: function(tokenData) {
        const currentTime = Date.now();
        const expiresIn = tokenData.expires_in 
            ? parseInt(tokenData.expires_in) * 1000  // converte para milissegundos
            : 3 * 60 * 60 * 1000;  // 3 horas como padrão

        this.token = {
            access_token: tokenData.access_token || '',
            refresh_token: tokenData.refresh_token || this.token.refresh_token || '',
            expires_at: currentTime + expiresIn,
            token_type: tokenData.token_type || 'bearer'
        };
        
        console.log(`Token salvo. 
            Expira em: ${new Date(this.token.expires_at).toLocaleString()}
            Tempo restante: ${((this.token.expires_at - currentTime) / 60000).toFixed(2)} minutos`
        );
        
        localStorage.setItem('ifood_token', JSON.stringify(this.token));
    },
    
    // Método para renovar token usando refresh token
    refreshAccessToken: async function() {
        try {
            if (!this.token.refresh_token) {
                console.log('Sem refresh token disponível.');
                throw new Error('Refresh token não disponível');
            }

            const response = await fetch(this.baseUrl + '/authentication/v1.0/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: this.token.refresh_token,
                    client_id: this.credentials.client_id,
                    client_secret: this.credentials.client_secret
                })
            });

            if (!response.ok) {
                throw new Error('Falha ao atualizar token');
            }

            const tokenData = await response.json();
            
            if (!tokenData.access_token) {
                throw new Error('Novo token inválido');
            }

            this.saveToken(tokenData);
            console.log('Token atualizado com sucesso via refresh token');
            showToast('info', 'Token atualizado automaticamente');
            
            return tokenData.access_token;
        } catch (error) {
            console.error('Erro no refresh token:', error);
            throw error;
        }
    },
    
    // Obtém um token de acesso
    getAccessToken: async function() {
        try {
            if (this.isTokenExpired()) {
                console.log('Token expirado ou próximo de expirar. Iniciando renovação.');
                
                if (this.token.refresh_token) {
                    return await this.refreshAccessToken();
                } else {
                    throw new Error('Necessário nova autenticação');
                }
            }
            
            return this.token.access_token;
        } catch (error) {
            console.error('Erro ao obter token de acesso:', error);
            throw error;
        }
    },
    
    // Obtém headers de autenticação
    getAuthHeaders: async function() {
        const token = await this.getAccessToken();
        return {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        };
    },
    
    // Realiza uma requisição autenticada
    apiRequest: async function(endpoint, options = {}) {
        try {
            if (!this.credentials || !this.credentials.client_id) {
                throw new Error('Credenciais não configuradas. Configure no menu de Configurações.');
            }

            const headers = await this.getAuthHeaders();
            const fetchOptions = {
                method: options.method || 'GET',
                headers: { ...headers, ...(options.headers || {}) }
            };
            
            if (options.body) {
                fetchOptions.body = options.body;
            }
            
            console.log("Fazendo requisição para:", endpoint);
            console.log("Merchant ID em uso:", this.credentials.merchantId);
            
            const response = await fetch(this.baseUrl + endpoint, fetchOptions);

            if (!response.ok) {
                if (response.status === 401) {
                    // Se o token expirou, tenta renovar e refaz a requisição
                    await this.refreshAccessToken();
                    return this.apiRequest(endpoint, options);
                }
                
                const text = await response.text();
                throw new Error(`Erro ${response.status}: ${text}`);
            }
            
            // Verifica se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            }
            
            return response.text();
        } catch (error) {
            console.error('Erro na requisição:', error);
            throw error;
        }
    }
};
