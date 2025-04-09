/**
 * Módulo para gerenciamento das funcionalidades relacionadas ao Merchant
 * Implementa os critérios de homologação do módulo Merchant
 */

// Atribuir ao objeto global
window.MERCHANT = {
    // Propriedades...
    currentMerchant: null,
    currentStatus: null,
    openingHours: null,
    interruptions: [],
    
    // Métodos
    init: function() {
        console.log("Inicializando módulo MERCHANT");
        this.initEventListeners();
        
        // Carrega dados do merchant do localStorage
        var savedData = localStorage.getItem('merchant_data');
        if (savedData) {
            try {
                var data = JSON.parse(savedData);
                this.currentMerchant = data.merchant || null;
                this.currentStatus = data.status || null;
                this.openingHours = data.openingHours || null;
                this.interruptions = data.interruptions || [];
                
                this.updateMerchantUI();
            } catch (err) {
                console.error('Erro ao carregar dados do merchant:', err);
            }
        }
    },

    initEventListeners: function() {
    // Botão de atualizar dados do merchant
    var refreshMerchantBtn = document.getElementById('refresh-merchant');
    if (refreshMerchantBtn) {
        refreshMerchantBtn.addEventListener('click', () => {
            this.loadAllMerchantData();
        });
    }

        loadAllMerchantData() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                showLoading(true);
                
                // Encadeia as promessas para executar sequencialmente
                self.listMerchants()
                    .then(function() {
                        return self.getMerchantDetails();
                    })
                    .then(function() {
                        return self.getMerchantStatus();
                    })
                    .then(function() {
                        return self.listInterruptions();
                    })
                    .then(function() {
                        return self.getOpeningHours();
                    })
                    .then(function() {
                        showToast('success', 'Dados da loja atualizados com sucesso!');
                        resolve();
                    })
                    .catch(function(error) {
                        console.error('Erro ao carregar dados do merchant:', error);
                        showToast('error', 'Erro ao carregar dados da loja');
                        reject(error);
                    })
                    .finally(function() {
                        showLoading(false);
                    });
            } catch (error) {
                console.error('Erro ao carregar dados do merchant:', error);
                showToast('error', 'Erro ao carregar dados da loja');
                showLoading(false);
                reject(error);
            }
        });
    },
    
    // Botão de alternar status da loja
    var toggleStatusBtn = document.getElementById('toggle-store-status');
    if (toggleStatusBtn) {
        toggleStatusBtn.addEventListener('click', () => {
            this.toggleMerchantStatus();
        });
    }
    
    // Botão de criar interrupção
    var createInterruptionBtn = document.getElementById('create-interruption');
    if (createInterruptionBtn) {
        createInterruptionBtn.addEventListener('click', () => {
            this.showInterruptionModal();
        });
    }
    
    // Botão de confirmar criação de interrupção
    var confirmInterruptionBtn = document.getElementById('confirm-interruption');
    if (confirmInterruptionBtn) {
        confirmInterruptionBtn.addEventListener('click', () => {
            this.createInterruption();
        });
    }
    
    // Botão de editar horários de funcionamento
    var editOpeningHoursBtn = document.getElementById('edit-opening-hours');
    if (editOpeningHoursBtn) {
        editOpeningHoursBtn.addEventListener('click', () => {
            this.showOpeningHoursModal();
        });
    }
    
    // Botão de salvar horários de funcionamento
    var saveOpeningHoursBtn = document.getElementById('save-opening-hours');
    if (saveOpeningHoursBtn) {
        saveOpeningHoursBtn.addEventListener('click', () => {
            this.updateOpeningHours();
        });
    }
},

    /**
     * Obtém os horários de funcionamento da loja (Critério: Listar horário de funcionamento)
     * GET /merchants/{merchantId}/opening-hours
     */
    async getOpeningHours() {
        try {
            const merchantId = AUTH.credentials.merchantId;
            if (!merchantId) {
                throw new Error('ID do merchant não configurado');
            }
            
            console.log('Buscando horários de funcionamento para o merchant ID:', merchantId);
            
            // Tenta primeiro com o endpoint mais provável
            try {
                const openingHours = await AUTH.apiRequest(`/merchant/v1.0/merchants/${merchantId}/opening-hours`);
                console.log('Opening Hours:', openingHours);
                
                // Verifica se o retorno é um array válido
                this.openingHours = Array.isArray(openingHours) ? openingHours : [];
                
                this.updateOpeningHoursUI();
                this.saveData();
                
                return this.openingHours;
            } catch (firstError) {
                console.warn('Erro no primeiro endpoint de horários:', firstError);
                
                // Tenta um endpoint alternativo
                try {
                    const alternativeOpeningHours = await AUTH.apiRequest(`/merchants/${merchantId}/opening-hours`);
                    console.log('Opening Hours (endpoint alternativo):', alternativeOpeningHours);
                    
                    // Verifica se o retorno é um array válido
                    this.openingHours = Array.isArray(alternativeOpeningHours) ? alternativeOpeningHours : [];
                    
                    this.updateOpeningHoursUI();
                    this.saveData();
                    
                    return this.openingHours;
                } catch (secondError) {
                    console.error('Erro em ambos os endpoints de horários:', secondError);
                    
                    // Define como array vazio para evitar erros
                    this.openingHours = [];
                    this.updateOpeningHoursUI();
                    
                    throw secondError;
                }
            }
        } catch (error) {
            console.error('Erro ao obter horários de funcionamento:', error);
            
            // Define como array vazio para evitar erros
            this.openingHours = [];
            this.updateOpeningHoursUI();
            
            throw error;
        }
    },

    /**
     * Atualiza a UI com os horários de funcionamento
     */
    updateOpeningHoursUI() {
        const openingHoursList = document.getElementById('opening-hours-list');
        if (!openingHoursList) return;
        
        // Limpa a lista atual
        openingHoursList.innerHTML = '';
        
        // Verifica se openingHours existe e é um array
        if (!this.openingHours || !Array.isArray(this.openingHours) || this.openingHours.length === 0) {
            openingHoursList.innerHTML = '<p class="no-data">Nenhum horário de funcionamento definido.</p>';
            return;
        }
        
        // Mapeia os dias da semana para português
        const weekdayMap = {
            'MONDAY': 'Segunda-feira',
            'TUESDAY': 'Terça-feira',
            'WEDNESDAY': 'Quarta-feira',
            'THURSDAY': 'Quinta-feira',
            'FRIDAY': 'Sexta-feira',
            'SATURDAY': 'Sábado',
            'SUNDAY': 'Domingo'
        };
        
        // Ordena os dias da semana
        const weekdayOrder = {
            'MONDAY': 1,
            'TUESDAY': 2,
            'WEDNESDAY': 3,
            'THURSDAY': 4,
            'FRIDAY': 5,
            'SATURDAY': 6,
            'SUNDAY': 7
        };
        
        const sortedHours = [...this.openingHours].sort((a, b) => {
            return weekdayOrder[a.weekday] - weekdayOrder[b.weekday];
        });
        
        // Para cada dia, cria um item na lista
        sortedHours.forEach(day => {
            const dayName = weekdayMap[day.weekday] || day.weekday;
            
            // Verifica se workingDay existe
            const opens = day.workingDay ? day.workingDay.opens : 'N/A';
            const closes = day.workingDay ? day.workingDay.closes : 'N/A';
            
            // Cria o elemento HTML
            const dayElem = document.createElement('div');
            dayElem.className = 'opening-hours-item';
            dayElem.innerHTML = `
                <div class="weekday">${dayName}</div>
                <div class="hours">${opens} - ${closes}</div>
            `;
            
            openingHoursList.appendChild(dayElem);
        });
    },

    // Todos os métodos restantes originais continuam aqui...
    
    /**
     * Atualiza a UI com as interrupções
     */
    updateInterruptionsUI() {
        const interruptionsList = document.getElementById('interruptions-list');
        if (!interruptionsList) return;
        
        // Limpa a lista atual
        interruptionsList.innerHTML = '';
        
        // Se não houver interrupções, mostra mensagem
        if (!this.interruptions || this.interruptions.length === 0) {
            interruptionsList.innerHTML = '<p class="no-data">Nenhuma interrupção ativa.</p>';
            return;
        }
        
        // Para cada interrupção, cria um item na lista
        this.interruptions.forEach(interruption => {
            // Formata as datas
            const startDate = new Date(interruption.start);
            const endDate = new Date(interruption.end);
            const formattedStart = startDate.toLocaleString();
            const formattedEnd = endDate.toLocaleString();
            
            // Traduz o motivo
            const reasonMap = {
                'STOCK_OUT_OF_PRODUCTS': 'Falta de Produtos',
                'NO_DELIVERY_PROVIDERS_AVAILABLE': 'Sem Entregadores',
                'TECHNICAL_PROBLEMS': 'Problemas Técnicos',
                'OTHER': 'Outro'
            };
            
            const reasonText = reasonMap[interruption.reason] || interruption.reason;
            
            // Cria o elemento HTML
            const interruptionElem = document.createElement('div');
            interruptionElem.className = 'interruption-item';
            interruptionElem.innerHTML = `
                <div class="interruption-details">
                    <div class="interruption-reason">${reasonText}</div>
                    <div class="interruption-period">
                        <span class="date-label">Início:</span> ${formattedStart}<br>
                        <span class="date-label">Fim:</span> ${formattedEnd}
                    </div>
                </div>
                <button class="remove-interruption" data-id="${interruption.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            interruptionsList.appendChild(interruptionElem);
            
            // Adiciona o event listener ao botão de remover
            const removeBtn = interruptionElem.querySelector('.remove-interruption');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    this.removeInterruption(interruption.id);
                });
            }
        });
    },

/**
     * Exibe o modal para editar horários de funcionamento
     */
    showOpeningHoursModal() {
        const openingHoursForm = document.getElementById('opening-hours-form');
        if (!openingHoursForm) return;
        
        // Limpa o formulário
        openingHoursForm.innerHTML = '';
        
        // Dias da semana
        const weekdays = [
            { id: 'MONDAY', label: 'Segunda-feira' },
            { id: 'TUESDAY', label: 'Terça-feira' },
            { id: 'WEDNESDAY', label: 'Quarta-feira' },
            { id: 'THURSDAY', label: 'Quinta-feira' },
            { id: 'FRIDAY', label: 'Sexta-feira' },
            { id: 'SATURDAY', label: 'Sábado' },
            { id: 'SUNDAY', label: 'Domingo' }
        ];
        
        // Para cada dia da semana, cria inputs para horários
        weekdays.forEach(day => {
            // Busca o horário existente para este dia
            const daySchedule = this.openingHours && this.openingHours.find(h => h.weekday === day.id);
            
            const html = `
                <div class="opening-hours-day">
                    <h4>${day.label}</h4>
                    <div class="day-status">
                        <label>
                            <input type="checkbox" id="enabled-${day.id}" ${daySchedule ? 'checked' : ''}>
                            Aberto
                        </label>
                    </div>
                    <div class="time-slots" id="time-slots-${day.id}" ${!daySchedule ? 'style="display:none"' : ''}>
                        <div class="time-slot">
                            <div class="time-input">
                                <label>Abertura:</label>
                                <input type="time" id="opening-${day.id}" value="${daySchedule?.workingDay?.opens || '08:00'}">
                            </div>
                            <div class="time-input">
                                <label>Fechamento:</label>
                                <input type="time" id="closing-${day.id}" value="${daySchedule?.workingDay?.closes || '18:00'}">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            openingHoursForm.innerHTML += html;
            
            // Adiciona event listener para o checkbox (depois de inserir no DOM)
            setTimeout(() => {
                const checkbox = document.getElementById(`enabled-${day.id}`);
                const timeSlots = document.getElementById(`time-slots-${day.id}`);
                
                if (checkbox && timeSlots) {
                    checkbox.addEventListener('change', () => {
                        timeSlots.style.display = checkbox.checked ? 'block' : 'none';
                    });
                }
            }, 0);
        });
        
        // Abre o modal
        const modal = document.getElementById('opening-hours-modal');
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    /**
     * Atualiza os horários de funcionamento da loja (Critério: Criar horário de funcionamento)
     * PUT /merchants/{merchantId}/opening-hours
     */
    async updateOpeningHours() {
        try {
            const merchantId = AUTH.credentials.merchantId;
            if (!merchantId) {
                throw new Error('ID do merchant não configurado');
            }
            
            // Dias da semana
            const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
            
            // Coleta os dados do formulário
            const openingHours = [];
            
            weekdays.forEach(day => {
                const enabledCheckbox = document.getElementById(`enabled-${day}`);
                
                if (enabledCheckbox && enabledCheckbox.checked) {
                    const opensInput = document.getElementById(`opening-${day}`);
                    const closesInput = document.getElementById(`closing-${day}`);
                    
                    if (opensInput && closesInput) {
                        openingHours.push({
                            weekday: day,
                            workingDay: {
                                opens: opensInput.value,
                                closes: closesInput.value
                            }
                        });
                    }
                }
            });
            
            showLoading(true);
            
            // Envia os novos horários para a API
            await AUTH.apiRequest(`/merchants/${merchantId}/opening-hours`, {
                method: 'PUT',
                body: JSON.stringify(openingHours)
            });
            
            console.log('Horários atualizados:', openingHours);
            
            // Atualiza os horários locais
            this.openingHours = openingHours;
            this.updateOpeningHoursUI();
            this.saveData();
            
            // Fecha o modal
            const modal = document.getElementById('opening-hours-modal');
            if (modal) {
                modal.classList.remove('active');
            }
            
            showToast('success', 'Horários de funcionamento atualizados com sucesso!');
        } catch (error) {
            console.error('Erro ao atualizar horários de funcionamento:', error);
            showToast('error', 'Erro ao atualizar horários de funcionamento');
            throw error;
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Remove uma interrupção da loja (Critério: Remover uma interrupção)
     * DELETE /merchants/{merchantId}/interruptions/{interruptionId}
     */
    async removeInterruption(interruptionId) {
        try {
            const merchantId = AUTH.credentials.merchantId;
            if (!merchantId) {
                throw new Error('ID do merchant não configurado');
            }
            
            if (!interruptionId) {
                throw new Error('ID da interrupção não fornecido');
            }
            
            showLoading(true);
            
            await AUTH.apiRequest(`/merchants/${merchantId}/interruptions/${interruptionId}`, {
                method: 'DELETE'
            });
            
            console.log('Interrupção removida:', interruptionId);
            
            // Atualiza a lista de interrupções
            await this.listInterruptions();
            
            // Atualiza o status da loja
            await this.getMerchantStatus();
            
            showToast('success', 'Interrupção removida com sucesso!');
        } catch (error) {
            console.error('Erro ao remover interrupção:', error);
            showToast('error', 'Erro ao remover interrupção');
            throw error;
        } finally {
            showLoading(false);
        }
    },
    
    /**
     * Atualiza a UI com os dados do merchant
     */
    updateMerchantUI() {
        // Atualiza os elementos da UI com os dados do merchant
        if (this.currentMerchant) {
            // Informações básicas
            const merchantNameElems = document.querySelectorAll('#merchant-name, .merchant-name');
            merchantNameElems.forEach(elem => {
                if (elem) elem.textContent = this.currentMerchant.name || '-';
            });
            
            const merchantIdElems = document.querySelectorAll('#merchant-id, #merchant-id-display');
            merchantIdElems.forEach(elem => {
                if (elem) elem.textContent = this.currentMerchant.id || '-';
            });
            
            if (document.getElementById('merchant-uuid')) {
                document.getElementById('merchant-uuid').textContent = this.currentMerchant.uuid || '-';
            }
            
            // Endereço
            if (document.getElementById('merchant-address')) {
                const address = this.currentMerchant.address || {};
                const addressStr = [
                    address.streetName,
                    address.streetNumber,
                    address.neighborhood,
                    address.city,
                    address.state,
                    address.postalCode
                ].filter(Boolean).join(', ');
                
                document.getElementById('merchant-address').textContent = addressStr || '-';
            }
            
            // Telefone
            if (document.getElementById('merchant-phone')) {
                document.getElementById('merchant-phone').textContent = 
                    this.currentMerchant.phoneNumber || '-';
            }
        }
    },
    
    /**
     * Atualiza a UI com o status do merchant
     */
    updateStatusUI() {
        // Atualiza os elementos da UI com o status atual
        const statusElem = document.getElementById('store-status');
        const merchantStatusElem = document.getElementById('merchant-current-status');
        
        if (this.currentStatus) {
            const isAvailable = this.currentStatus.available;
            const statusText = isAvailable ? 'Aberto' : 'Fechado';
            const statusClass = isAvailable ? 'open' : 'closed';
            
            if (statusElem) {
                statusElem.textContent = statusText;
                statusElem.className = 'status-value ' + statusClass;
            }
            
            if (merchantStatusElem) {
                merchantStatusElem.textContent = statusText;
                merchantStatusElem.className = 'info-value ' + statusClass;
            }
        } else {
            if (statusElem) {
                statusElem.textContent = 'Desconhecido';
                statusElem.className = 'status-value';
            }
            
            if (merchantStatusElem) {
                merchantStatusElem.textContent = 'Desconhecido';
                merchantStatusElem.className = 'info-value';
            }
        }
        
        // Atualiza o botão de alternar status
        const toggleStatusBtn = document.getElementById('toggle-store-status');
        if (toggleStatusBtn) {
            toggleStatusBtn.textContent = this.currentStatus && this.currentStatus.available ? 
                'Fechar Loja' : 'Abrir Loja';
        }
    }
};
