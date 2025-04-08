/**
 * Módulo de autenticação para gerenciar tokens de acesso à API iFood
 */

const AUTH = {
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
    init() {
        // Carrega as credenciais do localStorage
        const savedCredentials = localStorage.getItem('ifood_credentials');
        if (savedCredentials) {
            this.credentials = JSON.parse(savedCredentials);
        }
        
        // Carrega o token do localStorage
        const savedToken = localStorage.getItem('ifood_token');
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
    saveCredentials(credentials) {
        this.credentials = { ...this.credentials, ...credentials };
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
    saveToken(tokenData) {
        // Calcula quando o token irá expirar (current time + expires_in)
        const expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
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
    isTokenExpired() {
        // Se não houver token ou a data de expiração for anterior à atual
        return !this.token.access_token || 
               !this.token.expires_at || 
               Date.now() >= this.token.expires_at;
    },
    
    /**
     * Verifica se o token está perto de expirar (menos de 5 minutos)
     * @returns {boolean} - true se o token estiver perto de expirar
     */
    isTokenNearExpiration() {
        if (!this.token.access_token || !this.token.expires_at) return true;
        
        // Verifica se o token expira em menos de 5 minutos (300000ms)
        const timeRemaining = this.token.expires_at - Date.now();
        return timeRemaining < 300000;
    },
    
    /**
     * Obtém um token de acesso, automaticamente fazendo refresh se necessário
     * @returns {Promise<string>} - Access token
     */
    async getAccessToken() {
        // Se o token está expirado, renova
        if (this.isTokenExpired()) {
            console.log('Token expirado. Renovando...');
            await this.refreshToken();
        } 
        // Se o token está perto de expirar, renova em segundo plano
        else if (this.isTokenNearExpiration()) {
            console.log('Token perto de expirar. Renovando em segundo plano...');
            this.refreshToken().catch(err => console.error('Erro ao renovar token:', err));
        }
        
        return this.token.access_token;
    },
    
    /**
     * Realiza a autenticação para obter novos tokens
     * @returns {Promise<Object>} - Dados do token
     */
    async authenticate() {
        try {
            if (!this.credentials.client_id || !this.credentials.client_secret) {
                throw new Error('Credenciais não configuradas. Configure o Client ID e Client Secret nas configurações.');
            }
            
            const response = await fetch(`${this.baseUrl}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'grant_type': 'client_credentials',
                    'client_id': this.credentials.client_id,
                    'client_secret': this.credentials.client_secret
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro de autenticação: ${errorData.error_description || response.statusText}`);
            }
            
            const tokenData = await response.json();
            this.saveToken(tokenData);
            
            showToast('success', 'Autenticação realizada com sucesso!');
            return tokenData;
        } catch (error) {
            console.error('Erro na autenticação:', error);
            showToast('error', error.message || 'Erro na autenticação');
            throw error;
        }
    },
    
    /**
     * Renova o token usando o refresh_token
     * @returns {Promise<Object>} - Dados do novo token
     */
    async refreshToken() {
        try {
            // Se não tiver refresh token, faz autenticação completa
            if (!this.token.refresh_token) {
                return await this.authenticate();
            }
            
            const response = await fetch(`${this.baseUrl}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'grant_type': 'refresh_token',
                    'refresh_token': this.token.refresh_token
                })
            });
            
            if (!response.ok) {
                // Se der erro no refresh, tenta autenticação completa
                console.warn('Refresh token inválido. Tentando autenticação completa...');
                return await this.authenticate();
            }
            
            const tokenData = await response.json();
            this.saveToken(tokenData);
            
            return tokenData;
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            return await this.authenticate(); // Fallback para autenticação completa
        }
    },
    
    /**
     * Cria cabeçalhos de autenticação para as requisições
     * @returns {Promise<Object>} - Headers com token de autenticação
     */
    async getAuthHeaders() {
        const token = await this.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    },
    
    /**
     * Realiza uma requisição autenticada à API
     * @param {string} endpoint - Endpoint da API (sem a URL base)
     * @param {Object} options - Opções da requisição fetch
     * @returns {Promise<Object>} - Resposta da API
     */
    async apiRequest(endpoint, options = {}) {
        try {
            const headers = await this.getAuthHeaders();
            
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            });
            
            // Se receber erro de autenticação, tenta renovar o token e refazer a requisição
            if (response.status === 401) {
                console.log('Token inválido. Renovando e repetindo requisição...');
                await this.authenticate();
                
                // Refaz a requisição com o novo token
                const newHeaders = await this.getAuthHeaders();
                const newResponse = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    headers: {
                        ...newHeaders,
                        ...options.headers
                    }
                });
                
                if (!newResponse.ok) {
                    const errorData = await newResponse.json().catch(() => ({}));
                    throw new Error(`Erro na requisição: ${errorData.message || newResponse.statusText}`);
                }
                
                return await newResponse.json();
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Erro na requisição: ${errorData.message || response.statusText}`);
            }
            
            // Verifica se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`Erro na requisição para ${endpoint}:`, error);
            throw error;
        }
    }
};
