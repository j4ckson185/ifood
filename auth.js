/**
 * Módulo de autenticação para gerenciar tokens de acesso à API iFood
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
                // Mescla as credenciais salvas com as credenciais padrão
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
        
        // Atualiza a UI com o ID do merchant
        if (document.getElementById('merchant-id-display')) {
            document.getElementById('merchant-id-display').textContent = this.credentials.merchantId;
        }
        
        // Preencher campos do formulário de configurações com valores atuais
        this.updateSettingsForm();
    },
    
    // Atualiza os campos do formulário de configurações
    updateSettingsForm: function() {
        // Preenche os campos com as credenciais atuais
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
        // Se não há token, está expirado
        if (!this.token.access_token) return true;
        
        // Se não tem data de expiração, considera expirado
        if (!this.token.expires_at) return true;
        
        // Verifica se está expirado ou vai expirar em breve (15 minutos)
        const currentTime = Date.now();
        const expirationBuffer = 15 * 60 * 1000; // 15 minutos
        
        return currentTime >= (this.token.expires_at - expirationBuffer);
    },
    
    // Método para salvar o token com tratamento adicional
    saveToken: function(tokenData) {
        // Calcula o tempo de expiração
        const currentTime = Date.now();
        const expiresIn = tokenData.expires_in 
            ? parseInt(tokenData.expires_in) * 1000  // converte para milissegundos
            : 3 * 60 * 60 * 1000;  // 3 horas como padrão para modo de teste

        this.token = {
            access_token: tokenData.access_token || '',
            refresh_token: tokenData.refresh_token || this.token.refresh_token || '',
            expires_at: currentTime + expiresIn,
            token_type: tokenData.token_type || 'bearer'
        };
        
        // Log detalhado de expiração
        console.log(`Token salvo. 
            Expira em: ${new Date(this.token.expires_at).toLocaleString()}
            Tempo restante: ${((this.token.expires_at - currentTime) / 60000).toFixed(2)} minutos`
        );
        
        // Salva no localStorage
        localStorage.setItem('ifood_token', JSON.stringify(this.token));
    },
    
    // Método para renovar token usando refresh token
    refreshAccessToken: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            // Verifica se há um refresh token disponível
            if (!self.token.refresh_token) {
                console.log('Sem refresh token. Realizando autenticação completa.');
                return self.authenticate().then(resolve).catch(reject);
            }

            console.log('Tentando renovar token com refresh token');

            var formData = new URLSearchParams();
            formData.append('grant_type', 'refresh_token');
            formData.append('client_id', self.credentials.client_id);
            formData.append('client_secret', self.credentials.client_secret);
            formData.append('refresh_token', self.token.refresh_token);
            
            fetch(self.baseUrl + '/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.text().then(function(text) {
                        console.error('Erro ao atualizar token:', text);
                        throw new Error('Falha ao atualizar token');
                    });
                }
                return response.json();
            })
            .then(function(tokenData) {
                if (!tokenData.access_token) {
                    throw new Error('Novo token inválido');
                }

                // Salva o novo token
                self.saveToken(tokenData);
                
                console.log('Token atualizado com sucesso via refresh token');
                showToast('info', 'Token atualizado automaticamente');
                
                resolve(tokenData.access_token);
            })
            .catch(function(error) {
                console.error('Erro no refresh token:', error);
                
                // Se falhar, tenta autenticação completa
                self.authenticate()
                    .then(resolve)
                    .catch(reject);
            });
        });
    },
    
    // Obtém um token de acesso
    getAccessToken: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            // Verifica se o token está expirado ou próximo de expirar
            if (self.isTokenExpired()) {
                console.log('Token expirado ou próximo de expirar. Iniciando renovação.');
                
                // Tenta usar refresh token primeiro
                self.refreshAccessToken()
                    .then(function(newToken) {
                        resolve(newToken);
                    })
                    .catch(function(err) {
                        console.error('Falha ao renovar token:', err);
                        
                        // Fallback para autenticação completa
                        self.authenticate()
                            .then(function() {
                                resolve(self.token.access_token);
                            })
                            .catch(function(authError) {
                                console.error('Falha na autenticação:', authError);
                                reject(new Error('Não foi possível obter um token válido'));
                            });
                    });
            } else {
                // Retorna o token existente se ainda for válido
                resolve(self.token.access_token);
            }
        });
    },
    
    // Obtém headers de autenticação
    getAuthHeaders: function() {
        var self = this;
        return this.getAccessToken()
            .then(function(token) {
                return {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                };
            });
    },
    
    // Realiza a autenticação
    authenticate: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // Verifica se as credenciais estão presentes
                if (!self.credentials || !self.credentials.client_id || !self.credentials.client_secret) {
                    throw new Error('Credenciais incompletas. Configure nas configurações.');
                }
                
                console.log("Iniciando autenticação...");
                
                var formData = new URLSearchParams();
                formData.append('grant_type', 'client_credentials');
                formData.append('client_id', self.credentials.client_id);
                formData.append('client_secret', self.credentials.client_secret);
                
                fetch(self.baseUrl + '/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData.toString()
                })
                .then(function(response) {
                    console.log("Resposta de autenticação:", response.status);
                    
                    if (!response.ok) {
                        return response.text().then(function(text) {
                            console.error("Erro de autenticação:", text);
                            
                            let errorDetails;
                            try {
                                errorDetails = JSON.parse(text);
                            } catch {
                                errorDetails = { message: text || 'Erro desconhecido' };
                            }
                            
                            throw new Error(errorDetails.message || 'Falha na autenticação');
                        });
                    }
                    return response.json();
                })
                .then(function(tokenData) {
                    console.log("Token recebido com sucesso");
                    
                    // Validações adicionais do token
                    if (!tokenData.access_token) {
                        throw new Error('Token de acesso inválido');
                    }
                    
                    // Salva o token
                    self.saveToken(tokenData);
                    
                    // Mostra notificação de sucesso
                    showToast('success', 'Autenticação realizada com sucesso!');
                    
                    resolve(tokenData);
                })
                .catch(function(error) {
                    console.error('Erro crítico na autenticação:', error);
                    
                    // Mostra mensagem de erro
                    showToast('error', error.message || 'Erro na autenticação');
                    
                    reject(error);
                });
            } catch (error) {
                console.error('Erro de configuração na autenticação:', error);
                showToast('error', error.message || 'Erro de configuração');
                reject(error);
            }
        });
    },
    
    // Realiza uma requisição autenticada
    apiRequest: function(endpoint, options) {
        var self = this;
        options = options || {};

        return new Promise(function(resolve, reject) {
            // Verificação adicional de credenciais
            if (!self.credentials || !self.credentials.client_id) {
                console.error('Credenciais não configuradas');
                return reject(new Error('Credenciais não configuradas. Configure no menu de Configurações.'));
            }

            self.getAuthHeaders()
                .then(function(headers) {
                    var fetchOptions = {
                        method: options.method || 'GET',
                        headers: Object.assign({}, headers, options.headers || {})
                    };
                    
                    if (options.body) {
                        fetchOptions.body = options.body;
                    }
                    
                    console.log("Fazendo requisição para:", endpoint);
                    console.log("Merchant ID em uso:", self.credentials.merchantId);
                    
                    return fetch(self.baseUrl + endpoint, fetchOptions);
                })
                .then(function(response) {
                    // Trata respostas de erro, especialmente 401 (não autorizado)
                    if (!response.ok) {
                        if (response.status === 401) {
                            console.log('Token inválido. Tentando renovar...');
                            // Força renovação do token e repete a requisição
                            return self.authenticate()
                                .then(function() {
                                    return self.apiRequest(endpoint, options);
                                });
                        }
                        
                        return response.text().then(function(text) {
                            console.error("Erro na requisição:", text);
                            throw new Error(`Erro ${response.status}: ${text}`);
                        });
                    }
                    
                    // Verifica se a resposta é JSON
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.json();
                    }
                    
                    return response.text();
                })
                .then(resolve)
                .catch(reject);
        });
    }
};
