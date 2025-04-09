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
        document.getElementById('submit-auth-code')?.addEventListener('click', () => this.submitAuthorizationCode());
    },

// Preencher campos do formulário de configurações
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

    // Gera o código de usuário para autenticação
generateUserCode: async function() {
    try {
        showLoading(true);

        console.log('Iniciando geração de código de usuário...');

        const formData = new URLSearchParams();
        formData.append('clientId', this.credentials.client_id);
        formData.append('grantType', 'authorization_code');

        console.log('Enviando requisição para gerar código...');
        const response = await fetch(this.baseUrl + '/oauth/userCode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Resposta de erro:', errorText);
            throw new Error('Falha ao gerar código de usuário: ' + errorText);
        }

        const data = await response.json();
        console.log('Resposta da API:', data);

        // Verificação dos campos obrigatórios
        if (!data.userCode || !data.authorizationCodeVerifier) {
            console.error('Dados incompletos recebidos da API:', data);
            throw new Error('Resposta incompleta da API');
        }
        
        // Salva as informações do código
        this.userCodeInfo = {
            userCode: data.userCode,
            verificationUrl: data.verificationUrl || 'https://portal.ifood.com.br/apps/code',
            verificationUrlComplete: data.verificationUrlComplete || 
                `https://portal.ifood.com.br/apps/code?c=${data.userCode}`,
            expiresIn: data.expiresIn || 600,
            interval: data.interval || 5,
            verifier: data.authorizationCodeVerifier
        };

         console.log('⭐ CODE VERIFIER GERADO:', this.userCodeInfo.verifier);


        // Salva o momento da geração para contagem regressiva
        localStorage.setItem('user_code_generated_at', new Date().toISOString());

        console.log('UserCodeInfo salvo:', this.userCodeInfo);

        // Salva no localStorage
        localStorage.setItem('ifood_user_code', JSON.stringify(this.userCodeInfo));

        // Atualiza a UI
        this.updateUserCodeUI();

        showToast('success', 'Código de autenticação gerado com sucesso!');
    } catch (error) {
        console.error('Erro ao gerar código de usuário:', error);
        showToast('error', 'Erro ao gerar código de autenticação: ' + error.message);
    } finally {
        showLoading(false);
    }
},

// Obtém o token de acesso usando o código de autorização
getTokenWithAuthCode: async function(authorizationCode) {
    try {
        console.log('🔍 DETALHES COMPLETOS DE AUTENTICAÇÃO:');
        console.log('Authorization Code:', authorizationCode);
        console.log('Stored Code Verifier:', this.userCodeInfo.verifier);
        console.log('Client ID:', this.credentials.client_id);

        // Verificações de integridade
        if (!authorizationCode) {
            throw new Error('Código de autorização não fornecido');
        }

        if (!this.userCodeInfo.verifier) {
            throw new Error('Code verifier não encontrado');
        }

let formData = new URLSearchParams();
        
        // Adiciona parâmetros de forma EXATA
const formData = new URLSearchParams();
formData.append('grant_type', 'authorization_code');
formData.append('client_id', this.credentials.client_id);
formData.append('client_secret', this.credentials.client_secret);
formData.append('code', authorizationCode);
formData.append('code_verifier', this.userCodeInfo.verifier);

const response = await fetch(this.baseUrl + '/oauth/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    },
    body: formData.toString()
});

        console.log('📡 Resposta do servidor:');
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Corpo da resposta:', responseText);

        // Parse da resposta
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao parsear resposta:', parseError);
            console.log('Resposta bruta que não pôde ser parseada:', responseText);
            throw new Error('Resposta da API em formato inválido');
        }

        // Verificações de erro
        if (!response.ok) {
            console.error('Erro na resposta detalhado:', {
                status: response.status,
                data: data
            });
            throw new Error(`Erro ao obter token: ${data?.error?.message || 'Erro desconhecido'}`);
        }

        // Verificação final do token
        if (!data.access_token) {
            throw new Error('Nenhum token de acesso recebido');
        }

        // Salvamento do token
        this.saveToken(data);
        showToast('success', 'Token de acesso obtido com sucesso!');
        
        // Limpeza
        this.clearUserCode();

        return data;

    } catch (error) {
        console.error('❌ Erro completo:', {
            message: error.message,
            stack: error.stack
        });
        showToast('error', `Falha na autenticação: ${error.message}`);
        throw error;
    }
},

// Para a verificação de status
stopAuthCheck: function() {
    if (this._authCheckInterval) {
        clearInterval(this._authCheckInterval);
        this._authCheckInterval = null;
        console.log('Verificação periódica interrompida');
    }
},

// Atualiza a UI com as informações do código de usuário
updateUserCodeUI: function() {
    const authStatus = document.getElementById('auth-status');
    const userCodeDisplay = document.getElementById('user-code-display');
    const verificationUrl = document.getElementById('verification-url');
    const expiresIn = document.getElementById('expires-in');

    if (authStatus && this.userCodeInfo.userCode) {
        // Exibe a seção de status de autenticação
        authStatus.style.display = 'block';

        // Atualiza o código de usuário
        if (userCodeDisplay) {
            userCodeDisplay.textContent = this.userCodeInfo.userCode;
        }

        // Atualiza o link de verificação
        if (verificationUrl) {
            verificationUrl.href = this.userCodeInfo.verificationUrlComplete;
            verificationUrl.textContent = this.userCodeInfo.verificationUrl;
        }

        // Calcula o tempo restante de expiração
        if (expiresIn) {
            const expirationTime = new Date(Date.now() + (this.userCodeInfo.expiresIn * 1000));
            expiresIn.textContent = `Expira em: ${expirationTime.toLocaleTimeString()}`;
        }

        // Inicia o countdown para expiração
        this.startUserCodeCountdown();
    }
},

// Adicione este método ao seu objeto AUTH
stopAuthCheck: function() {
    if (this._authCheckInterval) {
        clearInterval(this._authCheckInterval);
        this._authCheckInterval = null;
        console.log('Verificação periódica interrompida');
    }
},

// Inicia uma contagem regressiva para o código de usuário
startUserCodeCountdown: function() {
    // Para qualquer countdown anterior
    this.stopUserCodeCountdown();

    const expiresIn = document.getElementById('expires-in');
    if (!expiresIn) return;

    // Salva o intervalo para poder parar depois
    this._userCodeCountdown = setInterval(() => {
        const remainingSeconds = Math.max(0, Math.floor((this.userCodeInfo.expiresIn * 1000 - (Date.now() - Date.parse(localStorage.getItem('user_code_generated_at')))) / 1000));

        if (remainingSeconds > 0) {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            expiresIn.textContent = `Expira em: ${minutes}m ${seconds}s`;
        } else {
            // Código expirado
            this.stopUserCodeCountdown();
            expiresIn.textContent = 'Código Expirado';
            
            // Oculta a seção de status
            const authStatus = document.getElementById('auth-status');
            if (authStatus) {
                authStatus.style.display = 'none';
            }

            // Limpa as informações de código de usuário
            this.userCodeInfo = {
                userCode: '',
                verificationUrl: '',
                verificationUrlComplete: '',
                expiresIn: 0,
                interval: 0,
                verifier: ''
            };
            localStorage.removeItem('ifood_user_code');
            localStorage.removeItem('user_code_generated_at');
        }
    }, 1000);
},

// Para o countdown do código de usuário
stopUserCodeCountdown: function() {
    if (this._userCodeCountdown) {
        clearInterval(this._userCodeCountdown);
        this._userCodeCountdown = null;
    }
},

// Método para limpar o código de usuário
clearUserCode: function() {
    // Reseta as informações do código de usuário
    this.userCodeInfo = {
        userCode: '',
        verificationUrl: '',
        verificationUrlComplete: '',
        expiresIn: 0,
        interval: 0,
        verifier: ''
    };

    // Remove do localStorage
    localStorage.removeItem('ifood_user_code');
    localStorage.removeItem('user_code_generated_at');

    // Esconde a seção de status de autenticação
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
        authStatus.style.display = 'none';
    }
},

    // Método para obter o token de acesso
    getAccessToken: async function() {
        try {
            // Verifica se o token atual é válido
            if (!this.isTokenExpired()) {
                return this.token.access_token;
            }

            // Se tiver refresh token, tenta renová-lo
            if (this.token.refresh_token) {
                console.log('Tentando renovar token usando refresh token');
                const refreshedToken = await this.refreshAccessToken();
                return refreshedToken;
            }

            // Se não tiver refresh token, precisa de nova autenticação
            console.log('Necessário iniciar novo fluxo de autenticação');
            throw new Error('Necessário nova autenticação');

        } catch (error) {
            console.error('Erro ao obter token de acesso:', error);
            
            // Limpa tokens antigos
            this.token = {
                access_token: '',
                refresh_token: '',
                expires_at: 0,
                token_type: 'bearer'
            };
            localStorage.removeItem('ifood_token');

            // Mostra mensagem para iniciar nova autenticação
            showToast('warning', 'Por favor, inicie o processo de autenticação novamente.');
            
            throw error;
        }
    },

    // Método para verificar se o token expirou
    isTokenExpired: function() {
        if (!this.token.access_token) return true;
        
        const currentTime = Date.now();
        const expirationBuffer = 5 * 60 * 1000; // 5 minutos de buffer
        
        return currentTime >= (this.token.expires_at - expirationBuffer);
    },

    // Atualiza o token usando refresh token
    refreshAccessToken: async function() {
        try {
            console.log('Iniciando renovação de token');

            const formData = new URLSearchParams();
            formData.append('grant_type', 'refresh_token');
            formData.append('refresh_token', this.token.refresh_token);
            formData.append('client_id', this.credentials.client_id);
            formData.append('client_secret', this.credentials.client_secret);

            const response = await fetch(this.baseUrl + '/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na renovação do token:', errorText);
                throw new Error('Falha ao renovar token: ' + errorText);
            }

            const tokenData = await response.json();

            // Salva o novo token
            this.saveToken(tokenData);

            console.log('Token renovado com sucesso');
            return tokenData.access_token;

        } catch (error) {
            console.error('Erro no refresh token:', error);
            throw error;
        }
    },

    // Salva o token recebido
    saveToken: function(tokenData) {
        const currentTime = Date.now();
        const expiresIn = tokenData.expires_in 
            ? parseInt(tokenData.expires_in) * 1000  // converte para milissegundos
            : 3600000;  // 1 hora como padrão

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
    },
    
submitAuthorizationCode: async function() {
        try {
            const authCodeInput = document.getElementById('authorization-code');
            const authorizationCode = authCodeInput?.value?.trim();

            console.log('⭐ AUTHORIZATION CODE RECEBIDO:', authorizationCode);
            console.log('⭐ STORED CODE VERIFIER:', this.userCodeInfo.verifier);

            if (!authorizationCode) {
                showToast('error', 'Por favor, insira o código de autorização');
                return;
            }

            if (!this.userCodeInfo.verifier) {
                console.log('UserCodeInfo atual:', this.userCodeInfo);
                showToast('error', 'Informações de autenticação incompletas. Gere um novo código.');
                return;
            }

            showLoading(true);

            // Para qualquer verificação em andamento
            this.stopAuthCheck();

            await this.getTokenWithAuthCode(authorizationCode);
            
            // Limpa o campo de entrada
            if (authCodeInput) {
                authCodeInput.value = '';
            }

            showToast('success', 'Autenticação concluída com sucesso!');
            
            // Oculta a seção de autenticação
            document.getElementById('auth-status').style.display = 'none';

        } catch (error) {
            console.error('Erro ao processar código de autorização:', error);
            showToast('error', 'Erro ao processar código de autorização');
        } finally {
            showLoading(false);
        }
    }
};
