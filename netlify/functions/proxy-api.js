// netlify/functions/proxy-api.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // URLs base da API do iFood
  const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
  
  // Log para depuração completa
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Polling-Merchants',
        'Access-Control-Max-Age': '86400'
      }
    };
  }
  
  try {
    // Obtém o caminho da requisição removendo o prefixo da função
    const pathParts = event.path.split('/');
    const functionPathIndex = pathParts.indexOf('proxy-api');
    
    // Se não encontrar 'proxy-api' no caminho, usa o método antigo
    let apiPath;
    if (functionPathIndex !== -1) {
      // Remove tudo até 'proxy-api' (inclusive) para obter o caminho da API
      apiPath = '/' + pathParts.slice(functionPathIndex + 1).join('/');
    } else {
      // Fallback para o método antigo
      apiPath = event.path.replace('/.netlify/functions/proxy-api', '');
    }
    
    // Se o caminho estiver vazio, use '/' para evitar erros
    if (!apiPath || apiPath === '') {
      apiPath = '/';
    }
    
    console.log("Caminho da API:", apiPath);
    
    // URL completa para a API - trata caminhos especiais
    let url;
    if (apiPath.includes('/oauth/token')) {
      // Corrige o endpoint de autenticação
      url = `${IFOOD_API_BASE}/authentication/v1.0/oauth/token`;
      console.log("URL para API de autenticação iFood:", url);
    } else {
      url = `${IFOOD_API_BASE}${apiPath}`;
      console.log("URL para API iFood:", url);
    }
    
    // Prepara os headers
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
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
    });
    
    console.log("Headers enviados:", headers);
    
    // Opções para fetch
    const options = {
      method: event.httpMethod,
      headers: headers
    };
    
    // Para métodos com body, adiciona o body
    if (['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      if (apiPath.includes('/oauth/token')) {
        // Garante que o grant_type seja incluído
        const bodyParams = new URLSearchParams(event.body || '');
        if (!bodyParams.get('grant_type')) {
          bodyParams.set('grant_type', 'client_credentials');
        }
        options.body = bodyParams.toString();
      } else if (event.body) {
        options.body = event.body;
      }
    }
    
    console.log("Corpo da requisição:", options.body);
    
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
        // Tenta parsear JSON para validar
        JSON.parse(text);
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Polling-Merchants',
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
