/**
 * Módulo para gerenciamento das funcionalidades relacionadas às avaliações
 * Implementa os critérios de homologação do módulo Review
 */

// Extendendo o objeto global REVIEWS, não redeclarando
// NÃO use "const REVIEWS = { ... }"
REVIEWS = {
    /**
     * Lista de avaliações
     */
    reviews: [],
    
    /**
     * Avaliação atual selecionada
     */
    currentReview: null,
    
    /**
     * Inicializa o módulo de avaliações
     */
    init: function() {
        // Carrega avaliações do localStorage (se existirem)
        this.loadSavedReviews();
        
        // Inicializa eventos de UI
        this.initUIEvents();
    },
    
    /**
     * Carrega avaliações salvas no localStorage
     */
    loadSavedReviews() {
        const savedReviews = localStorage.getItem('reviews_data');
        if (savedReviews) {
            try {
                this.reviews = JSON.parse(savedReviews);
                
                // Atualiza a UI com as avaliações carregadas
                this.updateReviewsUI();
            } catch (err) {
                console.error('Erro ao carregar dados de avaliações:', err);
            }
        } else {
            // Se não houver avaliações salvas, simula algumas
            this.simulateReviews();
        }
    },
    
    /**
     * Salva as avaliações no localStorage
     */
    saveReviewsData() {
        localStorage.setItem('reviews_data', JSON.stringify(this.reviews));
    },
    
    /**
     * Inicializa eventos de UI relacionados a avaliações
     */
    initUIEvents() {
        // Botão de atualizar avaliações
        const refreshReviewsBtn = document.getElementById('refresh-reviews');
        if (refreshReviewsBtn) {
            refreshReviewsBtn.addEventListener('click', () => this.fetchReviews());
        }
        
        // Botão de enviar resposta à avaliação
        const sendReplyBtn = document.getElementById('send-review-reply');
        if (sendReplyBtn) {
            sendReplyBtn.addEventListener('click', () => this.submitReviewAnswer());
        }
    },
    
    /**
     * Busca as avaliações do merchant (Critério: Listar avaliações)
     */
    async fetchReviews() {
        try {
            showLoading(true);
            
            const merchantId = AUTH.credentials.merchantId;
            if (!merchantId) {
                throw new Error('ID do merchant não configurado');
            }
            
            // Faz a requisição para obter as avaliações
            const reviews = await AUTH.apiRequest(`/merchants/${merchantId}/reviews`);
            console.log('Reviews:', reviews);
            
            // Se não receber avaliações ou ocorrer erro, usa simuladas
            if (!reviews || !Array.isArray(reviews)) {
                this.simulateReviews();
            } else {
                this.reviews = reviews;
                this.saveReviewsData();
            }
            
            this.updateReviewsUI();
            
            showToast('success', 'Avaliações atualizadas com sucesso!');
        } catch (error) {
            console.error('Erro ao buscar avaliações:', error);
            showToast('error', 'Erro ao buscar avaliações');
            
            // Em caso de erro, usa avaliações simuladas
            this.simulateReviews();
            this.updateReviewsUI();
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Busca detalhes de uma avaliação específica (Critério: Obter detalhes das avaliações)
     * @param {string} reviewId ID da avaliação
     */
    async fetchReviewDetails(reviewId) {
        try {
            const merchantId = AUTH.credentials.merchantId;
            if (!merchantId || !reviewId) {
                throw new Error('ID do merchant ou da avaliação não configurado');
            }
            
            // Faz a requisição para obter os detalhes da avaliação
            const reviewDetails = await AUTH.apiRequest(`/merchants/${merchantId}/reviews/${reviewId}`);
            console.log('Review Details:', reviewDetails);
            
            return reviewDetails;
        } catch (error) {
            console.error(`Erro ao buscar detalhes da avaliação ${reviewId}:`, error);
            throw error;
        }
    },
    
    /**
     * Exibe o modal para responder a uma avaliação
     * @param {string} reviewId ID da avaliação
     */
    async showReviewReplyModal(reviewId) {
        try {
            // Busca os detalhes da avaliação
            let review = this.reviews.find(r => r.id === reviewId);
            
            // Se não encontrou nos detalhes em cache, tenta buscar da API
            if (!review) {
                try {
                    review = await this.fetchReviewDetails(reviewId);
                } catch (error) {
                    throw new Error('Não foi possível carregar os detalhes da avaliação');
                }
            }
            
            // Salva a avaliação atual
            this.currentReview = review;
            
            // Preenche os dados do modal
            document.getElementById('modal-review-rating').innerHTML = '★'.repeat(review.rating);
            
            // Formata a data
            const date = new Date(review.date);
            document.getElementById('modal-review-date').textContent = date.toLocaleDateString();
            
            // Texto da avaliação
            document.getElementById('modal-review-text').textContent = review.comment || 'Sem comentário';
            
            // Limpa o campo de resposta
            document.getElementById('review-reply').value = review.answer || '';
            
            // Abre o modal
            const modal = document.getElementById('review-reply-modal');
            if (modal) {
                modal.classList.add('active');
            }
        } catch (error) {
            console.error('Erro ao exibir modal de resposta:', error);
            showToast('error', error.message || 'Erro ao carregar avaliação');
        }
    },
    
    /**
     * Envia uma resposta à avaliação (Critério: Responder uma avaliação)
     */
    async submitReviewAnswer() {
        try {
            if (!this.currentReview) {
                throw new Error('Nenhuma avaliação selecionada');
            }
            
            const merchantId = AUTH.credentials.merchantId;
            const reviewId = this.currentReview.id;
            
            if (!merchantId || !reviewId) {
                throw new Error('ID do merchant ou da avaliação não configurado');
            }
            
            // Obtém o texto da resposta
            const answerText = document.getElementById('review-reply').value.trim();
            
            if (!answerText) {
                throw new Error('Digite uma resposta para a avaliação');
            }
            
            showLoading(true);
            
            // Envia a resposta para a API
            const response = await AUTH.apiRequest(`/merchants/${merchantId}/reviews/${reviewId}/answers`, {
                method: 'POST',
                body: JSON.stringify({
                    text: answerText
                })
            });
            
            console.log('Review answer response:', response);
            
            // Atualiza a resposta na lista de avaliações local
            const reviewIndex = this.reviews.findIndex(r => r.id === reviewId);
            if (reviewIndex !== -1) {
                this.reviews[reviewIndex].answer = answerText;
                this.saveReviewsData();
            }
            
            // Fecha o modal
            const modal = document.getElementById('review-reply-modal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            // Atualiza a UI
            this.updateReviewsUI();
            
            showToast('success', 'Resposta enviada com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
            showToast('error', error.message || 'Erro ao enviar resposta');
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Simula algumas avaliações para demonstração
     */
    simulateReviews() {
        // Cria algumas avaliações simuladas
        this.reviews = [
            {
                id: 'review_1',
                orderId: 'order_123456',
                rating: 5,
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                customer: {
                    name: 'Roberto Silva'
                },
                comment: 'Excelente atendimento e comida deliciosa! Entrega rápida e pedido chegou perfeito.',
                answer: 'Obrigado pelo feedback, Roberto! Ficamos felizes que tenha gostado do nosso serviço. Volte sempre!'
            },
            {
                id: 'review_2',
                orderId: 'order_123457',
                rating: 4,
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                customer: {
                    name: 'Carla Santos'
                },
                comment: 'Comida muito boa, mas demorou um pouco para entregar.',
                answer: null
            },
            {
                id: 'review_3',
                orderId: 'order_123458',
                rating: 3,
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                customer: {
                    name: 'Marcelo Oliveira'
                },
                comment: 'O pedido veio com um item faltando, mas a comida estava boa.',
                answer: 'Olá Marcelo, lamentamos pelo transtorno. Vamos melhorar nossos processos para que isso não aconteça novamente. Agradecemos o feedback!'
            },
            {
                id: 'review_4',
                orderId: 'order_123459',
                rating: 5,
                date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                customer: {
                    name: 'Juliana Lima'
                },
                comment: 'Melhor hambúrguer que já comi! Super recomendo.',
                answer: null
            },
            {
                id: 'review_5',
                orderId: 'order_123460',
                rating: 2,
                date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                customer: {
                    name: 'Fernando Costa'
                },
                comment: 'Entrega muito demorada e a comida chegou fria.',
                answer: 'Olá Fernando, lamentamos pela experiência ruim. Estamos trabalhando para melhorar nosso tempo de entrega. Gostaríamos de oferecer uma compensação na sua próxima compra.'
            }
        ];
        
        // Salva as avaliações simuladas
        this.saveReviewsData();
    },
    
    /**
     * Atualiza a UI com as avaliações
     */
    updateReviewsUI() {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;
        
        // Limpa a lista
        reviewsList.innerHTML = '';
        
        // Se não houver avaliações, exibe mensagem
        if (!this.reviews || this.reviews.length === 0) {
            reviewsList.innerHTML = '<p class="no-data">Nenhuma avaliação encontrada.</p>';
            return;
        }
        
        // Ordena as avaliações por data (mais recentes primeiro)
        const sortedReviews = [...this.reviews].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // Cria um card para cada avaliação
        sortedReviews.forEach(review => {
            const reviewCard = document.createElement('div');
            reviewCard.className = 'review-card';
            
            // Formata estrelas com base na avaliação
            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            
            // Formata a data
            const date = new Date(review.date);
            const formattedDate = date.toLocaleDateString();
            
            reviewCard.innerHTML = `
                <div class="review-header">
                    <div class="review-rating">${stars}</div>
                    <div class="review-date">${formattedDate}</div>
                </div>
                <div class="review-customer">${review.customer?.name || 'Cliente'}</div>
                <div class="review-text">${review.comment || 'Sem comentário'}</div>
                ${review.answer ? `
                <div class="review-answer">
                    <div class="review-answer-header">Sua resposta:</div>
                    <div>${review.answer}</div>
                </div>
                ` : `
                <div class="review-actions">
                    <button class="review-reply-btn" data-id="${review.id}">Responder</button>
                </div>
                `}
            `;
            
            reviewsList.appendChild(reviewCard);
            
            // Adiciona event listener ao botão de responder
            const replyBtn = reviewCard.querySelector('.review-reply-btn');
            if (replyBtn) {
                replyBtn.addEventListener('click', () => {
                    this.showReviewReplyModal(review.id);
                });
            }
        });
    }
};
