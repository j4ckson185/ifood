import { API_BASE_URL } from './config.js';

async function fazerRequisicaoAPI(endpoint, metodo = 'GET', corpo = null) {
    try {
        const opcoes = {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (corpo) {
            opcoes.body = JSON.stringify(corpo);
        }

        console.log(`Fazendo requisição para ${API_BASE_URL}${endpoint}`, opcoes);
        const resposta = await fetch(`${API_BASE_URL}${endpoint}`, opcoes);
        
        const texto = await resposta.text();
        console.log(`Resposta da API (${resposta.status}):`, texto);

        if (!resposta.ok) {
            throw new Error(`Erro na API: ${resposta.status} ${resposta.statusText}\nResposta: ${texto}`);
        }

        return texto ? JSON.parse(texto) : null;
    } catch (error) {
        console.error(`Erro ao fazer requisição para ${endpoint}:`, error);
        throw error;
    }
}

export async function polling() {
    return fazerRequisicaoAPI('/events/v1.0/events:polling');
}

export async function acknowledgeEventos(eventIds) {
    return fazerRequisicaoAPI('/events/v1.0/events/acknowledgment', 'POST', eventIds);
}

export async function obterDetalhesPedido(orderId) {
    return fazerRequisicaoAPI(`/order/v1.0/orders/${orderId}`);
}

export async function confirmarPedido(orderId) {
    return fazerRequisicaoAPI(`/order/v1.0/orders/${orderId}/confirm`, 'POST');
}

export async function despacharPedido(orderId) {
    return fazerRequisicaoAPI(`/order/v1.0/orders/${orderId}/dispatch`, 'POST');
}

export async function obterMotivoCancelamento(orderId) {
    return fazerRequisicaoAPI(`/order/v1.0/orders/${orderId}/cancellationReasons`);
}

export async function cancelarPedido(orderId, cancelCodeId) {
    return fazerRequisicaoAPI(`/order/v1.0/orders/${orderId}/requestCancellation`, 'POST', { cancellationCode: cancelCodeId });
}
