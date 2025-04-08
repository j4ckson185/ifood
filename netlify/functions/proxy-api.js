// netlify/functions/proxy-api.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // URLs base da API do iFood
    const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
    
    console.log("Requisição recebida:", {
        path: event.path,
        httpMethod: event.httpMethod,
        headers: event.headers,
        body: event.body
    });
    
    // Tratamento de CORS para preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Polling-Merchants, user-code',
                'Access-Control-Max-Age': '86400'
            }
        };
    }
    
    try {
        // Obtém o caminho da requisição removendo o prefixo da função
        const pathParts = event.path.split('/');
        const functionPathIndex = pathParts.indexOf('proxy-api');
        
        let apiPath = functionPathIndex !== -1 
            ? '/' + pathParts.slice(functionPathIndex + 1).join('/')
            : event.path.replace('/.netlify/functions/proxy-api', '');
        
        // Se o caminho estiver vazio, use '/'
        if (!apiPath || apiPath === '') {
            apiPath = '/';
        }
        
        console.log("Caminho da API:", apiPath);
        
        // URL completa para a API - trata caminhos especiais
        let url;
        if (apiPath.includes('/oauth/')) {
            // Todos os endpoints de autenticação
            url = `${IFOOD_API_BASE}/authentication/v1.0${apiPath}`;
            console.log("URL para API de autenticação iFood:", url);
        } else {
            url = `${IFOOD_API_BASE}${apiPath}`;
            console.log("URL para API iFood:", url);
        }
        
        // Prepara os headers
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Copia headers relevantes
        Object.keys(event.headers).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'authorization') {
                headers['Authorization'] = event.headers[key];
            }
            if (lowerKey === 'x-polling-merchants') {
                headers['X-Polling-Merchants'] = event.headers[key];
            }
            if (lowerKey === 'user-code') {
                headers['user-code'] = event.headers[key];
            }
        });
        
        console.log("Headers enviados:", headers);
        
        // Opções para fetch
        const options = {
            method: event.httpMethod,
            headers: headers
        };
        
        // Para métodos com body
        if (['POST', 'PUT', 'PATCH'].includes(event.httpMethod) && event.body) {
            options.body = event.body;
        }
        
        console.log("Opções da requisição:", {
            method: options.method,
            headers: options.headers,
            body: options.body
        });
        
        // Faz a requisição para a API
        console.log("Enviando requisição para iFood...");
        const response = await fetch(url, options);
        console.log("Resposta recebida:", response.status, response.statusText);
        
        // Obtém o corpo da resposta
        let responseBody;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            try {
                JSON.parse(text); // Valida o JSON
                responseBody = text;
            } catch (e) {
                console.error("Erro ao parsear JSON:", e);
                responseBody = text || '{}';
            }
        } else {
            responseBody = await response.text();
        }
        
        // Retorna a resposta para o cliente
        return {
            statusCode: response.status,
            headers: {
                'Content-Type': contentType || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Polling-Merchants, user-code',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: responseBody
        };
    } catch (error) {
        console.error('Erro no proxy:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Erro no proxy',
                message: error.message,
                stack: error.stack
            })
        };
    }
};
