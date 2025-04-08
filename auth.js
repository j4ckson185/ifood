/**
 * Módulo de autenticação para gerenciar tokens de acesso à API iFood
 */

// Extendendo o objeto global AUTH, não redeclarando
// NÃO use "const AUTH = { ... }"
AUTH = {
    // URL base para a API de produção (usar .netlify/functions/proxy para contornar CORS)
    baseUrl: '/.netlify/functions/proxy',
    
    // Credenciais de autenticação
    credentials: {
        client_id: '',
        client_secret: '',
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
    
    /**
     * Inicializa o módulo de autenticação carregando credenciais salvas
     */
    init: function() {
        // Carrega as credenciais do localStorage
        var savedCredentials = localStorage.getItem('ifood_credentials');
        if (savedCredentials) {
            this.credentials = JSON.parse(savedCredentials);
        }
        
        // Carrega o token do localStorage
        var savedToken = localStorage.getItem('ifood_token');
        if (savedToken) {
            this.token = JSON.parse(savedToken);
        }
        
        // Atualiza a UI com o ID do merchant
        if (document.getElementById('merchant-id-display')) {
            document.getElementById('merchant-id-display').textContent = this.credentials.merchantId;
        }
    },
    
    /**
     * Salva as credenciais no localStorage
     * @param {Object} credentials - Credenciais de autenticação
     */
    saveCredentials: function(credentials) {
        this.credentials = Object.assign({}, this.credentials, credentials);
        localStorage.setItem('ifood_credentials', JSON.stringify(this.credentials));
        
        // Atualiza a UI com o ID do merchant
        if (document.getElementById('merchant-id-display')) {
            document.getElementById('merchant-id-display').textContent = this.credentials.merchantId;
        }
    },
    
    /**
     * Salva o token no localStorage
     * @param {Object} tokenData - Dados do token
     */
    saveToken: function(tokenData) {
        // Calcula quando o token irá expirar (current time + expires_in)
        var expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        this.token = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            token_type: tokenData.token_type || 'bearer'
        };
        
        localStorage.setItem('ifood_token', JSON.stringify(this.token));
    },
    
    /**
     * Verifica se o token está expirado
     * @returns {boolean} - true se o token estiver expirado
     */
    isTokenExpired: function() {
        // Se não houver token ou a data de expiração for anterior à atual
        return !this.token.access_token || 
               !this.token.expires_at || 
               Date.now() >= this.token.expires_at;
    },
    
    /**
     * Verifica se o token está perto de expirar (menos de 5 minutos)
     * @returns {boolean} - true se o token estiver perto de expirar
     */
    isTokenNearExpiration: function() {
        if (!this.token.access_token || !this.token.expires_at) return true;
        
        // Verifica se o token expira em menos de 5 minutos (300000ms)
        var timeRemaining = this.token.expires_at - Date.now();
        return timeRemaining < 300000;
    },
    
    /**
     * Obtém um token de acesso, automaticamente fazendo refresh se necessário
     * @returns {Promise<string>} - Access token
     */
    getAccessToken: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            // Se o token está expirado, renova
            if (self.isTokenExpired()) {
                console.log('Token expirado. Renovando...');
                self.refreshToken()
                    .then(function() {
                        resolve(self.token.access_token);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
            } 
            // Se o token está perto de expirar, renova em segundo plano
            else if (self.isTokenNearExpiration()) {
                console.log('Token perto de expirar. Renovando em segundo plano...');
                self.refreshToken()
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
    
    /**
     * Realiza a autenticação para obter novos tokens
     * @returns {Promise<Object>} - Dados do token
     */
    authenticate: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                if (!self.credentials.client_id || !self.credentials.client_secret) {
                    throw new Error('Credenciais não configuradas. Configure o Client ID e Client Secret nas configurações.');
                }
                
                fetch(self.baseUrl + '/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'grant_type': 'client_credentials',
                        'client_id': self.credentials.client_id,
                        'client_secret': self.credentials.client_secret
                    })
                })
                .then(function(response) {
                    if (!response.ok) {
                        return response.text().then(function(text) {
                            var errorData;
                            try {
                                errorData = JSON.parse(text);
                            } catch (e) {
                                errorData = { error_description: text || response.statusText };
                            }
                            throw new Error('Erro de autenticação: ' + (errorData.error_description || response.statusText));
                        });
                    }
                    return response.text();
                })
                .then(function(text) {
                    if (!text) {
                        throw new Error('Resposta de autenticação vazia');
                    }
                    var tokenData = JSON.parse(text);
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
    
    /**
     * Renova o token usando o refresh_token
     * @returns {Promise<Object>} - Dados do novo token
     */
    refreshToken: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // Se não tiver refresh token, faz autenticação completa
                if (!self.token.refresh_token) {
                    return self.authenticate()
                        .then(resolve)
                        .catch(reject);
                }
                
                fetch(self.baseUrl + '/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'grant_type': 'refresh_token',
                        'refresh_token': self.token.refresh_token
                    })
                })
                .then(function(response) {
                    if (!response.ok) {
                        // Se der erro no refresh, tenta autenticação completa
                        console.warn('Refresh token inválido. Tentando autenticação completa...');
                        return self.authenticate();
                    }
                    return response.json();
                })
                .then(function(tokenData) {
                    self.saveToken(tokenData);
                    resolve(tokenData);
                })
                .catch(function(error) {
                    console.error('Erro ao renovar token:', error);
                    // Fallback para autenticação completa
                    self.authenticate()
                        .then(resolve)
                        .catch(reject);
                });
            } catch (error) {
                console.error('Erro ao renovar token:', error);
                reject(error);
            }
        });
    },
    
    /**
     * Cria cabeçalhos de autenticação para as requisições
     * @returns {Promise<Object>} - Headers com token de autenticação
     */
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
    
    /**
     * Realiza uma requisição autenticada à API
     * @param {string} endpoint - Endpoint da API (sem a URL base)
     * @param {Object} options - Opções da requisição fetch
     * @returns {Promise<Object|string>} - Resposta da API
     */
    apiRequest: function(endpoint, options) {
        var self = this;
        options = options || {};

        return new Promise(function(resolve, reject) {
            self.getAuthHeaders()
                .then(function(headers) {
                    var fetchOptions = Object.assign({}, options, {
                        headers: Object.assign({}, headers, options.headers || {})
                    });
                    
                    return fetch(self.baseUrl + endpoint, fetchOptions);
                })
                .then(function(response) {
                    // Se receber erro de autenticação, tenta renovar o token e refazer a requisição
                    if (response.status === 401) {
                        console.log('Token inválido. Renovando e repetindo requisição...');
                        return self.authenticate()
                            .then(function() {
                                return self.getAuthHeaders();
                            })
                            .then(function(newHeaders) {
                                var fetchOptions = Object.assign({}, options, {
                                    headers: Object.assign({}, newHeaders, options.headers || {})
                                });
                                return fetch(self.baseUrl + endpoint, fetchOptions);
                            });
                    }
                    return response;
                })
                .then(function(response) {
                    if (!response.ok) {
                        return response.text().then(function(text) {
                            var errorData;
                            try {
                                errorData = JSON.parse(text);
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
                            return text ? JSON.parse(text) : null;
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
