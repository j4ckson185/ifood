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
    
// Dentro do módulo AUTH, modifique o método init
init: function() {
    console.log("Inicializando módulo AUTH");
    
    // Credenciais padrão
    this.credentials = {
        client_id: '6015fafa-fd3e-4053-9080-bfdbf6e78526',
        client_secret: 'p1jv9gtn6loszhrl6tmcpwaeuk21w4ukrudeinuzfwihb9fqdutubsbbggav8rkbsiqgik45kdgdp471ua2ivmh25dz7mywcfc4',
        merchantId: '2733980',
        merchantUuid: '3a9fc83b-ffc3-43e9-aeb6-36c9e827a143'
    };
    
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
    
    // Garante que todas as propriedades estejam definidas
    ['client_id', 'client_secret', 'merchantId', 'merchantUuid'].forEach(prop => {
        if (!this.credentials[prop]) {
            console.warn(`Propriedade ${prop} não definida. Usando valor padrão.`);
            this.credentials[prop] = this.credentials[prop] || '';
        }
    });
    
    // Salva as credenciais mescladas de volta no localStorage
    localStorage.setItem('ifood_credentials', JSON.stringify(this.credentials));
    
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
    
    // Salva o token no localStorage
    saveToken: function(tokenData) {
        // Calcula quando o token irá expirar (current time + expires_in)
        var expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        this.token = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_at: expiresAt,
            token_type: tokenData.token_type || 'bearer'
        };
        
        localStorage.setItem('ifood_token', JSON.stringify(this.token));
        console.log("Token salvo, expira em:", new Date(expiresAt).toLocaleString());
    },
    
    // Verifica se o token está expirado
    isTokenExpired: function() {
        return !this.token.access_token || 
               !this.token.expires_at || 
               Date.now() >= this.token.expires_at;
    },
    
    // Verifica se o token está perto de expirar
    isTokenNearExpiration: function() {
        if (!this.token.access_token || !this.token.expires_at) return true;
        
        var timeRemaining = this.token.expires_at - Date.now();
        return timeRemaining < 300000; // 5 minutos
    },
    
    // Obtém um token de acesso
    getAccessToken: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (self.isTokenExpired()) {
                console.log('Token expirado. Renovando...');
                self.authenticate()
                    .then(function() {
                        resolve(self.token.access_token);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
            } 
            else if (self.isTokenNearExpiration()) {
                console.log('Token perto de expirar. Renovando em segundo plano...');
                self.authenticate()
                    .catch(function(err) {
                        console.error('Erro ao renovar token:', err);
                    });
                resolve(self.token.access_token);
            }
            else {
                resolve(self.token.access_token);
            }
        });
    },
    
    // Realiza a autenticação
    authenticate: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                if (!self.credentials.client_id || !self.credentials.client_secret) {
                    throw new Error('Credenciais não configuradas. Configure o Client ID e Client Secret nas configurações.');
                }
                
                console.log("Tentando autenticar com:", {
                    client_id: self.credentials.client_id,
                    client_secret: "******" // segurança
                });
                
// Dentro da função authenticate, modifique a criação do formData
var formData = new URLSearchParams();
formData.append('grant_type', 'client_credentials'); // Sempre definir
formData.append('client_id', this.credentials.client_id);
formData.append('client_secret', this.credentials.client_secret);
                
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
                            console.error("Texto de erro:", text);
                            
                            var errorData;
                            try {
                                errorData = JSON.parse(text);
                                console.error("Dados de erro:", errorData);
                            } catch (e) {
                                errorData = { error_description: text || response.statusText };
                            }
                            
                            throw new Error('Erro de autenticação: ' + (errorData.error_description || response.statusText));
                        });
                    }
                    return response.text();
                })
                .then(function(text) {
                    console.log("Texto da resposta:", text ? "Recebido" : "Vazio");
                    
                    if (!text) {
                        throw new Error('Resposta de autenticação vazia');
                    }
                    
                    var tokenData;
                    try {
                        tokenData = JSON.parse(text);
                        console.log("Token recebido:", tokenData.access_token ? "Válido" : "Inválido");
                    } catch (e) {
                        console.error("Erro ao parsejar token:", e);
                        throw new Error('Resposta inválida: ' + e.message);
                    }
                    
                    self.saveToken(tokenData);
                    
                    showToast('success', 'Autenticação realizada com sucesso!');
                    resolve(tokenData);
                })
                .catch(function(error) {
                    console.error('Erro na autenticação:', error);
                    showToast('error', error.message || 'Erro na autenticação');
                    reject(error);
                });
            } catch (error) {
                console.error('Erro na autenticação:', error);
                showToast('error', error.message || 'Erro na autenticação');
                reject(error);
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
    
    // Realiza uma requisição autenticada
    apiRequest: function(endpoint, options) {
        var self = this;
        options = options || {};

        return new Promise(function(resolve, reject) {
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
                    return fetch(self.baseUrl + endpoint, fetchOptions);
                })
                .then(function(response) {
                    // Se receber erro de autenticação, tenta renovar o token
                    if (response.status === 401) {
                        console.log('Token inválido. Renovando e repetindo requisição...');
                        return self.authenticate()
                            .then(function() {
                                return self.getAuthHeaders();
                            })
                            .then(function(newHeaders) {
                                var fetchOptions = {
                                    method: options.method || 'GET',
                                    headers: Object.assign({}, newHeaders, options.headers || {})
                                };
                                
                                if (options.body) {
                                    fetchOptions.body = options.body;
                                }
                                
                                return fetch(self.baseUrl + endpoint, fetchOptions);
                            });
                    }
                    return response;
                })
                .then(function(response) {
                    console.log("Resposta da API:", response.status, response.statusText);
                    
                    if (!response.ok) {
                        return response.text().then(function(text) {
                            console.error("Texto de erro:", text);
                            
                            var errorData;
                            try {
                                errorData = JSON.parse(text);
                                console.error("Dados de erro:", errorData);
                            } catch (e) {
                                errorData = { message: text || response.statusText };
                            }
                            
                            throw new Error('Erro na requisição: ' + (errorData.message || response.statusText));
                        });
                    }
                    
                    // Verifica se a resposta é JSON
                    var contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return response.text().then(function(text) {
                            if (!text) {
                                console.log("Resposta vazia com content-type JSON");
                                return null;
                            }
                            
                            try {
                                return JSON.parse(text);
                            } catch (e) {
                                console.error("Erro ao parsejar resposta JSON:", e, "Texto:", text);
                                return text;
                            }
                        });
                    }
                    
                    return response.text();
                })
                .then(resolve)
                .catch(function(error) {
                    console.error('Erro na requisição para ' + endpoint + ':', error);
                    reject(error);
                });
        });
    }
};
