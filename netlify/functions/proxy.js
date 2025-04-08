// netlify/functions/proxy.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // URL base da API do iFood
  const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
  
  // Tratamento de CORS para preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Polling-Merchants',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }
  
  try {
    // Obtém o caminho da requisição (removendo o path da função)
    const path = event.path.replace('/.netlify/functions/proxy', '');
    
    // Se não houver path, responde com erro
    if (!path) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Path não especificado' })
      };
    }
    
    // URL completa para a API
    const url = `${IFOOD_API_BASE}${path}`;
    
    // Prepara os headers
    const headers = {};
    
    // Copia headers importantes
    if (event.headers.authorization) headers.Authorization = event.headers.authorization;
    if (event.headers['content-type']) headers['Content-Type'] = event.headers['content-type'];
    if (event.headers['x-polling-merchants']) headers['X-Polling-Merchants'] = event.headers['x-polling-merchants'];
    
    // Opções para fetch
    const options = {
      method: event.httpMethod,
      headers: headers
    };
    
    // Para métodos com body, adiciona o body
    if (['POST', 'PUT', 'PATCH'].includes(event.httpMethod) && event.body) {
      options.body = event.body;
    }
    
    // Faz a requisição para a API
    const response = await fetch(url, options);
    
    // Obtém o corpo da resposta
    let responseBody = '';
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      responseBody = text || '';  // Pode ser vazio para algumas APIs
    } else {
      responseBody = await response.text();
    }
    
    // Retorna a resposta para o cliente
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-polling-merchants',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: responseBody
    };
  } catch (error) {
    // Log de erro
    console.error('Erro no proxy:', error);
    
    // Retorna erro para o cliente
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Erro no proxy',
        message: error.message
      })
    };
  }
};
