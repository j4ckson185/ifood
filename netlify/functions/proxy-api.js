// netlify/functions/proxy-api.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Log para depuração
  console.log("Requisição recebida:", {
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers,
    queryStringParameters: event.queryStringParameters
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: "Proxy funcionando!",
      event_path: event.path,
      raw_path: event.rawPath || "não disponível",
      raw_query: event.rawQuery || "não disponível"
    })
  };
};
