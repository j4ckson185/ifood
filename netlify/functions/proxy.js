// netlify/functions/proxy.js

// Importe fetch para Node.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // URL base da API do iFood
    const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
    
    // Para requisições OPTIONS (pré-voo CORS), retorna permitindo acesso
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: ''
        };
    }
    
    try {
        // Obtém o caminho e método da requisição
        const path = event.path.replace('/.netlify/functions/proxy', '');
        const method = event.httpMethod;
        
        console.log(`Proxy recebeu requisição ${method} para ${path}`);
        console.log("Headers:", JSON.stringify(event.headers));
        
        // Se não houver path, retorna erro
        if (!path) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Path não especificado' })
            };
        }
        
        // Monta a URL completa para a API do iFood
        const url = `${IFOOD_API_BASE}${path}`;
        console.log("URL completa:", url);
        
        // Preparar headers para a requisição
        const headers = {};
        
        // Copia os headers relevantes
        const forwardHeaders = ['content-type', 'authorization', 'x-polling-merchants'];
        
        for (const [key, value] of Object.entries(event.headers)) {
            const lowerKey = key.toLowerCase();
            if (forwardHeaders.includes(lowerKey)) {
                headers[lowerKey] = value;
            }
        }
        
        console.log("Headers enviados:", JSON.stringify(headers));
        
        // Configura opções da requisição
        const requestOptions = {
            method: method,
            headers: headers,
            redirect: 'follow'
        };
        
        // Se for POST, PUT ou PATCH, adiciona o body
        if (['POST', 'PUT', 'PATCH'].includes(method) && event.body) {
            console.log("Body da requisição:", event.body.substring(0, 100) + "...");
            requestOptions.body = event.body;
        }
        
        // Faz a requisição para a API do iFood
        console.log("Enviando requisição para iFood API...");
        const response = await fetch(url, requestOptions);
        console.log("Resposta recebida:", response.status, response.statusText);
        
        // Obtém o corpo da resposta
        let responseBody;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const responseText = await response.text();
            console.log("Resposta JSON recebida:", responseText ? "Não vazia" : "Vazia");
            
            if (!responseText) {
                responseBody = '';
            } else {
                try {
                    // Tenta parsejar para validar e depois converte de volta para string
                    const jsonData = JSON.parse(responseText);
                    responseBody = JSON.stringify(jsonData);
                } catch (e) {
                    console.error("Erro ao parsejar resposta JSON:", e);
                    responseBody = responseText;
                }
            }
        } else {
            responseBody = await response.text();
            console.log("Resposta texto recebida:", responseBody ? "Não vazia" : "Vazia");
        }
        
        // Retorna a resposta
        return {
            statusCode: response.status,
            body: responseBody,
            headers: {
                'Content-Type': contentType || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        };
    } catch (error) {
        console.error('Erro no proxy:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Erro ao processar a requisição',
                message: error.message,
                stack: error.stack
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        };
    }
};
