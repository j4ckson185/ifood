import { API_BASE_URL } from './config.js';

export async function obterTokenAutenticacao() {
    try {
        // Use o token direto se já tiver sido obtido anteriormente
        if (window.AUTH && window.AUTH.token && window.AUTH.token.access_token) {
            return window.AUTH.token.access_token;
        }

        const response = await fetch(`${API_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials&client_id=e6415912-782e-4bd9-b6ea-af48c81ae323'
        });

        if (!response.ok) {
            throw new Error(`Falha na autenticação: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Erro ao obter token:', error);
        throw error;
    }
}
