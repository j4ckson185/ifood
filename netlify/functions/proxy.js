// netlify/functions/proxy.js

// Importe fetch para Node.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // URL base da API do iFood
    const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
    
    try {
        // Obtém o caminho e método da requisição
        const path = event.path.replace('/.netlify/functions/proxy', '');
        const method = event.httpMethod;
        
        // Se não houver path, retorna erro
        if (!path) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Path não especificado' })
            };
        }
        
        // Monta a URL completa para a API do iFood
        const url = `${IFOOD_API_BASE}${path}`;
        
        // Preparar headers para a requisição
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Copia os headers que começam com 'x-'
        for (const [key, value] of Object.entries(event.headers)) {
            if (key.toLowerCase().startsWith('x-')) {
                headers[key] = value;
            }
        }
        
        // Se tiver Authorization, copia
        if (event.headers.authorization) {
            headers['Authorization'] = event.headers.authorization;
        }
        
        // Configura opções da requisição
        const requestOptions = {
            method: method,
            headers: headers,
            redirect: 'follow'
        };
        
        // Se for POST, PUT ou PATCH, adiciona o body
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            requestOptions.body = event.body;
        }
        
        // Faz a requisição para a API do iFood
        const response = await fetch(url, requestOptions);
        
        // Obtém o corpo da resposta
        let responseBody;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseBody = await response.json();
            responseBody = JSON.stringify(responseBody);
        } else {
            responseBody = await response.text();
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
            body: JSON.stringify({ error: 'Erro ao processar a requisição: ' + error.message }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        };
    }
};
