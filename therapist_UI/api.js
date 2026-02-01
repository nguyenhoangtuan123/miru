/**
 * Miru Therapist API Client
 * Shared JavaScript for all therapist UI pages
 */

const TherapistAPI = {
    // Get base URL from config
    get baseUrl() {
        return window.CONFIG?.API_BASE || '';
    },

    // Get therapist ID from localStorage
    get therapistId() {
        return localStorage.getItem('user_id');
    },

    // Check if logged in
    checkLogin() {
        if (!this.therapistId) {
            window.location.href = '/app/auth';
            return false;
        }
        return true;
    },

    // Fetch with auth headers
    async fetch(url, options = {}) {
        const headers = {
            'X-User-Id': this.therapistId,
            ...options.headers
        };
        
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        
        return fetch(url, { 
            ...options, 
            headers, 
            credentials: 'include' 
        });
    },

    // === User Profile ===
    async getProfile() {
        try {
            const res = await this.fetch(`${this.baseUrl}/api/users/${this.therapistId}/profile`);
            if (res.ok) {
                const data = await res.json();
                return data.profile || {};
            }
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
        return null;
    },

    // === Clients ===
    async getClients() {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}`);
        if (res.ok) {
            const data = await res.json();
            return data.clients || [];
        }
        throw new Error('Failed to load clients');
    },

    async getClientSummary(clientId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/summary`);
        if (res.ok) {
            return await res.json();
        }
        throw new Error('Failed to load client summary');
    },

    async pairClient(pairingCode, notes) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/pair`, {
            method: 'POST',
            body: { pairing_code: pairingCode, notes }
        });
        if (res.ok) {
            return await res.json();
        }
        const err = await res.json();
        throw new Error(err.detail || 'Failed to pair client');
    },

    // === Messages ===
    async getConversations() {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/${this.therapistId}/conversations`);
        if (res.ok) {
            const data = await res.json();
            return data.conversations || [];
        }
        return [];
    },

    async getUnreadCount() {
        try {
            const res = await this.fetch(`${this.baseUrl}/api/therapist/${this.therapistId}/unread-count`);
            if (res.ok) {
                const data = await res.json();
                return data.unread_count || 0;
            }
        } catch (err) {
            console.error('Failed to get unread count:', err);
        }
        return 0;
    },

    async getMessages(clientId, limit = 50) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/messages?limit=${limit}`);
        if (res.ok) {
            const data = await res.json();
            return data.messages || [];
        }
        return [];
    },

    async sendMessage(clientId, content) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/messages`, {
            method: 'POST',
            body: { content }
        });
        return res.ok;
    },

    // === Appointments ===
    async getAppointments(year, month) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}?year=${year}&month=${month}`);
        if (res.ok) {
            const data = await res.json();
            return data.appointments || [];
        }
        return [];
    },

    async getTodayAppointments() {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}/today`);
        if (res.ok) {
            const data = await res.json();
            return data.appointments || [];
        }
        return [];
    },

    async getUpcomingAppointments(limit = 5, clientId = null) {
        let url = `${this.baseUrl}/api/therapist/appointments/${this.therapistId}/upcoming?limit=${limit}`;
        if (clientId) url += `&client_id=${clientId}`;
        const res = await this.fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data.appointments || [];
        }
        return [];
    },

    async createAppointment(data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}`, {
            method: 'POST',
            body: data
        });
        if (res.ok) {
            return await res.json();
        }
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create appointment');
    },

    async updateAppointment(id, data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}/${id}`, {
            method: 'PUT',
            body: data
        });
        return res.ok;
    },

    async cancelAppointment(id) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}/${id}/cancel`, {
            method: 'POST'
        });
        return res.ok;
    },

    async completeAppointment(id) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/appointments/${this.therapistId}/${id}/complete`, {
            method: 'POST'
        });
        return res.ok;
    },

    // === Assignments ===
    async getAssignments(clientId = null) {
        let url = `${this.baseUrl}/api/therapist/assignments/${this.therapistId}`;
        if (clientId) url += `?client_id=${clientId}`;
        const res = await this.fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data.assignments || [];
        }
        return [];
    },

    async createAssignment(data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/assignments/${this.therapistId}`, {
            method: 'POST',
            body: data
        });
        return res.ok;
    },

    async completeAssignment(assignmentId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/assignments/${assignmentId}/complete`, {
            method: 'POST'
        });
        return res.ok;
    },

    // === Medical Profile ===
    async getMedicalProfile(clientId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/medical-profile`);
        if (res.ok) {
            const data = await res.json();
            return data.profile || null;
        }
        return null;
    },

    async saveMedicalProfile(clientId, data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/medical-profile`, {
            method: 'POST',
            body: data
        });
        return res.ok;
    },

    // === Session Notes ===
    async getSessionNotes(clientId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/session-notes`);
        if (res.ok) {
            const data = await res.json();
            return data.notes || [];
        }
        return [];
    },

    async createSessionNote(clientId, data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/session-notes`, {
            method: 'POST',
            body: data
        });
        return res.ok;
    },

    async updateSessionNote(noteId, data) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/session-notes/${this.therapistId}/${noteId}`, {
            method: 'PUT',
            body: data
        });
        return res.ok;
    },

    async deleteSessionNote(noteId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/session-notes/${this.therapistId}/${noteId}`, {
            method: 'DELETE'
        });
        return res.ok;
    },

    // === Progress ===
    async getProgressMetrics(clientId, limit = 4) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/progress-metrics?limit=${limit}`);
        if (res.ok) {
            const data = await res.json();
            return data.metrics || [];
        }
        return [];
    },

    async getTreatmentOutcome(clientId) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/clients/${this.therapistId}/${clientId}/treatment-outcome`);
        if (res.ok) {
            const data = await res.json();
            return data.outcome || null;
        }
        return null;
    },

    // === Crisis ===
    async getCrises() {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/crises/${this.therapistId}`);
        if (res.ok) {
            const data = await res.json();
            return data.crises || [];
        }
        return [];
    },

    async acknowledgeCrisis(crisisId, notes) {
        const res = await this.fetch(`${this.baseUrl}/api/therapist/crises/${crisisId}/acknowledge`, {
            method: 'POST',
            body: { notes }
        });
        return res.ok;
    }
};

// Export for use in pages
window.TherapistAPI = TherapistAPI;
