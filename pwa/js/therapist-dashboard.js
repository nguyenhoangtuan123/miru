/**
 * Therapist Dashboard - Main JavaScript Module
 * Tách riêng logic xử lý chính và event handling
 */

const TherapistDashboard = (function () {
    'use strict';

    const THERAPIST_ID = localStorage.getItem('therapist_id') || 'demo-therapist';
    const API_BASE = window.APP_CONFIG?.getApiUrl?.() || '';

    // === DOM Elements ===
    const elements = {
        clientList: document.getElementById('client-list'),
        assignmentList: document.getElementById('assignment-list'),
        crisisList: document.getElementById('crisis-list'),
        crisisSection: document.getElementById('crisis-section'),
        appointmentList: document.getElementById('appointment-list'),
        messageList: document.getElementById('message-list'),
        groupList: document.getElementById('group-list'),
        assignClient: document.getElementById('assign-client'),
        groupAddClient: document.getElementById('group-add-client'),
        groupSelect: document.getElementById('group-select'),
        totalClients: document.getElementById('total-clients')
    };

    // === Data Loading ===
    async function loadClients() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/clients/${THERAPIST_ID}`);
            const data = await res.json();
            renderClients(data.clients || []);
        } catch (e) {
            console.error('Error loading clients:', e);
        }
    }

    async function loadAssignments() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/assignments/${THERAPIST_ID}`);
            const data = await res.json();
            renderAssignments(data.assignments || []);
        } catch (e) {
            console.error('Error loading assignments:', e);
        }
    }

    async function loadCrises() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/crises/${THERAPIST_ID}`);
            const data = await res.json();
            renderCrises(data.crises || []);
        } catch (e) {
            console.error('Error loading crises:', e);
        }
    }

    async function loadAppointments() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/appointments/${THERAPIST_ID}/upcoming?days=30`);
            const data = await res.json();
            renderAppointments(data.appointments || []);
        } catch (e) {
            console.error('Error loading appointments:', e);
        }
    }

    async function loadMessages() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/${THERAPIST_ID}/conversations`);
            const data = await res.json();
            renderMessages(data.conversations || []);
        } catch (e) {
            console.error('Error loading messages:', e);
        }
    }

    async function loadGroups() {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/client-groups/${THERAPIST_ID}`);
            const data = await res.json();
            renderGroups(data.groups || []);
        } catch (e) {
            console.error('Error loading groups:', e);
        }
    }

    // === Rendering ===
    function renderClients(clients) {
        if (!clients.length) {
            elements.clientList.innerHTML = '<div class="empty-state">Chưa có thân chủ nào</div>';
            return;
        }

        elements.clientList.innerHTML = clients.map(c => `
            <div class="client-item" onclick="TherapistDashboard.viewClient('${c.client_id}')">
                <div>
                    <div class="name">${c.users?.name || 'Unknown'}</div>
                    <div class="stats">${c.users?.email || ''}</div>
                </div>
            </div>
        `).join('');

        // Update dropdowns
        elements.assignClient.innerHTML = '<option value="">-- Chọn thân chủ --</option>' +
            clients.map(c => `<option value="${c.client_id}">${c.users?.name || c.client_id}</option>`).join('');

        elements.groupAddClient.innerHTML = '<option value="">-- Chọn thân chủ --</option>' +
            clients.map(c => `<option value="${c.client_id}">${c.users?.name || c.client_id}</option>`).join('');

        // Update stats
        if (elements.totalClients) {
            elements.totalClients.textContent = clients.length;
        }
    }

    function renderAssignments(assignments) {
        if (!assignments.length) {
            elements.assignmentList.innerHTML = '<div class="empty-state">Chưa có bài tập nào</div>';
            return;
        }
        elements.assignmentList.innerHTML = assignments.map(a => `
            <div class="assignment-item">
                <div style="display: flex; justify-content: space-between;">
                    <div class="title">${a.title}</div>
                    <span class="status-badge status-${a.status}">${a.status}</span>
                </div>
                <div class="meta">
                    ${a.users?.name || a.client_id} · 
                    ${a.due_date ? 'Hạn: ' + a.due_date : 'Không có hạn'}
                </div>
            </div>
        `).join('');
    }

    function renderCrises(crises) {
        if (!crises.length) {
            elements.crisisList.innerHTML = '<div class="empty-state">Không có cảnh báo mới</div>';
            elements.crisisSection.style.display = 'none';
            return;
        }
        elements.crisisSection.style.display = 'block';
        elements.crisisList.innerHTML = crises.map(c => `
            <div class="crisis-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="level">${c.crisis_level}</span> - ${c.users?.name || c.client_id}
                        <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
                            "${c.message_snippet}"
                        </div>
                    </div>
                    <button class="btn btn-danger" onclick="TherapistDashboard.acknowledgeCrisis(${c.id})">
                        Đã xem
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderAppointments(appointments) {
        if (!appointments.length) {
            elements.appointmentList.innerHTML = '<div class="empty-state">Chưa có lịch hẹn nào</div>';
            return;
        }
        elements.appointmentList.innerHTML = appointments.map(a => `
            <div class="appointment-card ${a.status}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="title">${a.users?.name || 'Unknown'}</div>
                        <div class="meta">
                            ${new Date(a.appointment_date).toLocaleString('vi-VN')} · 
                            ${a.duration_minutes} phút · ${a.type}
                        </div>
                    </div>
                    <span class="status-badge status-${a.status}">${a.status}</span>
                </div>
            </div>
        `).join('');
    }

    function renderMessages(conversations) {
        if (!conversations.length) {
            elements.messageList.innerHTML = '<div class="empty-state">Chưa có tin nhắn nào</div>';
            return;
        }
        elements.messageList.innerHTML = conversations.map(c => `
            <div class="message-item ${c.unread_count > 0 ? 'unread' : ''}" onclick="TherapistDashboard.viewConversation('${c.client.id}')">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <div class="name">${c.client?.name || 'Unknown'}</div>
                        <div class="meta">${c.last_message || ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; opacity: 0.7;">
                            ${new Date(c.last_time).toLocaleDateString('vi-VN')}
                        </div>
                        ${c.unread_count > 0 ? `<span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${c.unread_count}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderGroups(groups) {
        if (!groups.length) {
            elements.groupList.innerHTML = '<div class="empty-state">Chưa có nhóm nào</div>';
            return;
        }
        elements.groupList.innerHTML = groups.map(g => `
            <div class="group-card" onclick="TherapistDashboard.viewGroup('${g.id}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="group-color" style="background: ${g.color || '#667eea'}"></span>
                    <div>
                        <div class="name">${g.name}</div>
                        <div class="meta">${g.members?.[0]?.count || 0} thành viên</div>
                    </div>
                </div>
            </div>
        `).join('');

        // Update group select
        elements.groupSelect.innerHTML = '<option value="">-- Chọn nhóm --</option>' +
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }

    // === Actions ===
    async function pairClient(clientId) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/clients/${THERAPIST_ID}/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId })
            });
            if (res.ok) {
                TherapistDashboard.closePairModal();
                loadClients();
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function createAssignment(clientId, title, description, dueDate) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/assignments/${THERAPIST_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId, title, description, due_date: dueDate || null })
            });
            if (res.ok) {
                TherapistDashboard.closeAssignModal();
                loadAssignments();
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function acknowledgeCrisis(crisisId) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/crises/${crisisId}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function createAppointment(clientId, date, duration, type, link) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/appointments/${THERAPIST_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    appointment_date: date,
                    duration_minutes: parseInt(duration) || 60,
                    type: type || 'online',
                    meeting_link: link || null
                })
            });
            if (res.ok) {
                TherapistDashboard.closeAppointmentModal();
                loadAppointments();
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function createGroup(name, description, color) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/client-groups/${THERAPIST_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, color })
            });
            if (res.ok) {
                TherapistDashboard.closeGroupModal();
                loadGroups();
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async function addClientToGroup(clientId, groupId) {
        try {
            const res = await fetch(`${API_BASE}/api/therapist/client-groups/${THERAPIST_ID}/${groupId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId })
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    // === Navigation ===
    function viewClient(clientId) {
        alert(`Xem chi tiết thân chủ: ${clientId}`);
    }

    function viewConversation(clientId) {
        alert(`Mở chat với thân chủ: ${clientId}`);
    }

    function viewGroup(groupId) {
        alert(`Xem nhóm: ${groupId}`);
    }

    // === Initialization ===
    async function init() {
        await loadClients();
        await loadAssignments();
        await loadCrises();
        await loadAppointments();
        await loadMessages();
        await loadGroups();
    }

    // Public API
    return {
        init,
        loadClients,
        loadAssignments,
        loadCrises,
        loadAppointments,
        loadMessages,
        loadGroups,
        renderClients,
        renderAssignments,
        renderCrises,
        renderAppointments,
        renderMessages,
        renderGroups,
        pairClient,
        createAssignment,
        acknowledgeCrisis,
        createAppointment,
        createGroup,
        addClientToGroup,
        viewClient,
        viewConversation,
        viewGroup,
        // Modal controls - exposed for onclick handlers
        openPairModal: () => document.getElementById('pair-modal').classList.add('open'),
        closePairModal: () => document.getElementById('pair-modal').classList.remove('open'),
        openAssignModal: () => document.getElementById('assign-modal').classList.add('open'),
        closeAssignModal: () => document.getElementById('assign-modal').classList.remove('open'),
        openAppointmentModal: () => document.getElementById('appointment-modal').classList.add('open'),
        closeAppointmentModal: () => document.getElementById('appointment-modal').classList.remove('open'),
        openGroupModal: () => document.getElementById('group-modal').classList.add('open'),
        closeGroupModal: () => document.getElementById('group-modal').classList.remove('open'),
        logout: () => {
            localStorage.removeItem('therapist_id');
            window.location.href = '/';
        }
    };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TherapistDashboard.init);
} else {
    TherapistDashboard.init();
}
