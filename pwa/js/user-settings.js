/**
 * User Settings Module
 * Xử lý profile và privacy settings
 */

const UserSettings = (function () {
    'use strict';

    const API_BASE = window.APP_CONFIG?.getApiUrl?.() || '';

    // === DOM Elements ===
    let elements = {};

    function initElements() {
        elements = {
            // Profile form
            dateOfBirth: document.getElementById('date_of_birth'),
            gender: document.getElementById('gender'),
            phone: document.getElementById('phone'),
            address: document.getElementById('address'),
            emergencyName: document.getElementById('emergency_contact_name'),
            emergencyPhone: document.getElementById('emergency_contact_phone'),
            profileForm: document.getElementById('profile-form'),
            profileSaveBtn: document.getElementById('profile-save-btn'),

            // Privacy toggles
            chatHistoryToggle: document.getElementById('allow_chat_history'),
            moodJournalToggle: document.getElementById('allow_mood_journal'),
            assignmentsToggle: document.getElementById('allow_assignments'),
            goalsToggle: document.getElementById('allow_goals'),
            memoriesToggle: document.getElementById('allow_memories'),
            notifyAccessToggle: document.getElementById('notify_therapist_access'),
            shareDays: document.getElementById('share_history_days'),

            // Export/Delete
            exportDataBtn: document.getElementById('export-data-btn'),
            deleteAccountBtn: document.getElementById('delete-account-btn'),
            deleteConfirmModal: document.getElementById('delete-confirm-modal'),

            // Status
            statusMessage: document.getElementById('status-message')
        };
    }

    // === API Calls ===
    async function getProfile() {
        const userId = localStorage.getItem('user_id');
        if (!userId) return null;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/profile`, {
                credentials: 'include'
            });
            const data = await res.json();
            return data.profile;
        } catch (e) {
            console.error('Error fetching profile:', e);
            return null;
        }
    }

    async function updateProfile(data) {
        const userId = localStorage.getItem('user_id');
        if (!userId) return false;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) {
            console.error('Error updating profile:', e);
            return false;
        }
    }

    async function getPrivacySettings() {
        const userId = localStorage.getItem('user_id');
        if (!userId) return null;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/privacy-settings`, {
                credentials: 'include'
            });
            const data = await res.json();
            return data.privacy_settings;
        } catch (e) {
            console.error('Error fetching privacy settings:', e);
            return null;
        }
    }

    async function updatePrivacySettings(data) {
        const userId = localStorage.getItem('user_id');
        if (!userId) return false;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/privacy-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) {
            console.error('Error updating privacy settings:', e);
            return false;
        }
    }

    async function updateSinglePrivacySetting(key, value) {
        const userId = localStorage.getItem('user_id');
        if (!userId) return false;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/privacy-settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value })
            });
            return res.ok;
        } catch (e) {
            console.error('Error updating privacy setting:', e);
            return false;
        }
    }

    async function exportUserData() {
        const userId = localStorage.getItem('user_id');
        if (!userId) return null;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/export-data`, {
                credentials: 'include'
            });
            const data = await res.json();
            return data.export;
        } catch (e) {
            console.error('Error exporting data:', e);
            return null;
        }
    }

    async function requestAccountDeletion(reason) {
        const userId = localStorage.getItem('user_id');
        if (!userId) return false;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}/delete-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reason })
            });
            return res.ok;
        } catch (e) {
            console.error('Error requesting deletion:', e);
            return false;
        }
    }

    // === UI Functions ===
    function showStatus(message, type = 'success') {
        if (!elements.statusMessage) return;

        elements.statusMessage.textContent = message;
        elements.statusMessage.className = `status-message ${type}`;
        elements.statusMessage.style.display = 'block';

        setTimeout(() => {
            elements.statusMessage.style.display = 'none';
        }, 3000);
    }

    function renderProfile(profile) {
        if (!profile) return;

        if (elements.dateOfBirth) elements.dateOfBirth.value = profile.date_of_birth || '';
        if (elements.gender) elements.gender.value = profile.gender || '';
        if (elements.phone) elements.phone.value = profile.phone || '';
        if (elements.address) elements.address.value = profile.address || '';
        if (elements.emergencyName) elements.emergencyName.value = profile.emergency_contact_name || '';
        if (elements.emergencyPhone) elements.emergencyPhone.value = profile.emergency_contact_phone || '';
    }

    function renderPrivacySettings(settings) {
        if (!settings) return;

        if (elements.chatHistoryToggle) {
            elements.chatHistoryToggle.checked = settings.allow_therapist_chat_history;
        }
        if (elements.moodJournalToggle) {
            elements.moodJournalToggle.checked = settings.allow_therapist_mood_journal;
        }
        if (elements.assignmentsToggle) {
            elements.assignmentsToggle.checked = settings.allow_therapist_assignments;
        }
        if (elements.goalsToggle) {
            elements.goalsToggle.checked = settings.allow_therapist_goals;
        }
        if (elements.memoriesToggle) {
            elements.memoriesToggle.checked = settings.allow_therapist_memories;
        }
        if (elements.notifyAccessToggle) {
            elements.notifyAccessToggle.checked = settings.notify_when_therapist_access;
        }
        if (elements.shareDays) {
            elements.shareDays.value = settings.share_history_days || 30;
        }
    }

    // === Event Handlers ===
    async function handleProfileSubmit(e) {
        e.preventDefault();

        if (elements.profileSaveBtn) {
            elements.profileSaveBtn.disabled = true;
            elements.profileSaveBtn.textContent = 'Đang lưu...';
        }

        const data = {
            date_of_birth: elements.dateOfBirth?.value || null,
            gender: elements.gender?.value || null,
            phone: elements.phone?.value || null,
            address: elements.address?.value || null,
            emergency_contact_name: elements.emergencyName?.value || null,
            emergency_contact_phone: elements.emergencyPhone?.value || null
        };

        const success = await updateProfile(data);

        if (success) {
            showStatus('Đã lưu hồ sơ thành công!', 'success');
        } else {
            showStatus('Lỗi khi lưu hồ sơ', 'error');
        }

        if (elements.profileSaveBtn) {
            elements.profileSaveBtn.disabled = false;
            elements.profileSaveBtn.textContent = 'Lưu thay đổi';
        }
    }

    async function handlePrivacyToggle(e) {
        const key = e.target.dataset.settingKey;
        const value = e.target.checked;

        const success = await updateSinglePrivacySetting(key, value);

        if (success) {
            const settingName = e.target.parentElement?.querySelector('label')?.textContent || key;
            showStatus(`Đã cập nhật: ${settingName}`, 'success');
        } else {
            e.target.checked = !value;
            showStatus('Lỗi khi cập nhật cài đặt', 'error');
        }
    }

    async function handleExportData() {
        const btn = elements.exportDataBtn;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Đang xuất...';
        }

        const data = await exportUserData();

        if (data) {
            // Create downloadable JSON
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `miru-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showStatus('Đã xuất dữ liệu thành công!', 'success');
        } else {
            showStatus('Lỗi khi xuất dữ liệu', 'error');
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Xuất dữ liệu của tôi';
        }
    }

    function handleDeleteRequest() {
        if (elements.deleteConfirmModal) {
            elements.deleteConfirmModal.classList.add('open');
        }
    }

    async function confirmDeleteAccount() {
        const reason = document.getElementById('delete-reason')?.value || '';

        const success = await requestAccountDeletion(reason);

        if (elements.deleteConfirmModal) {
            elements.deleteConfirmModal.classList.remove('open');
        }

        if (success) {
            alert('Yêu cầu xóa tài khoản đã được gửi. Dữ liệu của bạn sẽ bị xóa sau 30 ngày.');
        } else {
            showStatus('Lỗi khi gửi yêu cầu', 'error');
        }
    }

    function cancelDeleteAccount() {
        if (elements.deleteConfirmModal) {
            elements.deleteConfirmModal.classList.remove('open');
        }
    }

    // === Initialization ===
    async function init() {
        initElements();

        // Load profile
        const profile = await getProfile();
        renderProfile(profile);

        // Load privacy settings
        const privacy = await getPrivacySettings();
        renderPrivacySettings(privacy);

        // Bind events
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', handleProfileSubmit);
        }

        // Privacy toggles
        const toggles = [
            { el: elements.chatHistoryToggle, key: 'allow_therapist_chat_history' },
            { el: elements.moodJournalToggle, key: 'allow_therapist_mood_journal' },
            { el: elements.assignmentsToggle, key: 'allow_therapist_assignments' },
            { el: elements.goalsToggle, key: 'allow_therapist_goals' },
            { el: elements.memoriesToggle, key: 'allow_therapist_memories' },
            { el: elements.notifyAccessToggle, key: 'notify_when_therapist_access' }
        ];

        toggles.forEach(({ el, key }) => {
            if (el) {
                el.dataset.settingKey = key;
                el.addEventListener('change', handlePrivacyToggle);
            }
        });

        // Export button
        if (elements.exportDataBtn) {
            elements.exportDataBtn.addEventListener('click', handleExportData);
        }

        // Delete account
        if (elements.deleteAccountBtn) {
            elements.deleteAccountBtn.addEventListener('click', handleDeleteRequest);
        }

        // Modal buttons
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', confirmDeleteAccount);
        }
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', cancelDeleteAccount);
        }
    }

    // Public API
    return {
        init,
        getProfile,
        updateProfile,
        getPrivacySettings,
        updatePrivacySettings,
        exportUserData,
        requestAccountDeletion
    };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UserSettings.init);
} else {
    UserSettings.init();
}
