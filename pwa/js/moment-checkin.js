// moment-checkin.js - Moment Check-in Modal Component

class MomentCheckin {
    constructor() {
        this.isOpen = false;
        this.emotionScore = 5;
        this.selectedTags = new Set();
        this.note = '';

        this.availableTags = [
            '#Công_việc', '#Gia_đình', '#Sức_khỏe',
            '#Tình_yêu', '#Bạn_bè', '#Tài_chính',
            '#Học_tập', '#Sở_thích', '#Tâm_trạng'
        ];

        this.init();
    }

    init() {
        // Create modal structure if not exists
        if (!document.getElementById('momentModal')) {
            this.createModal();
        }
    }

    createModal() {
        const modalHTML = `
            <div class="modal-overlay" id="momentModalOverlay">
                <div class="moment-modal">
                    <div class="modal-header">
                        <h2>Khoảnh khắc</h2>
                        <button class="close-button" id="closeMomentModal">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Emotion Slider -->
                        <div class="emotion-section">
                            <label class="section-label">Bạn cảm thấy thế nào?</label>
                            <div class="emotion-display">
                                <span class="emotion-emoji" id="emotionEmoji">😐</span>
                                <span class="emotion-score" id="emotionScoreDisplay">5</span>/10
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value="5" 
                                class="emotion-slider" 
                                id="emotionSlider"
                            >
                            <div class="emotion-labels">
                                <span>😢 Rất tệ</span>
                                <span>😊 Tuyệt vời</span>
                            </div>
                        </div>
                        
                        <!-- Context Tags -->
                        <div class="tags-section">
                            <label class="section-label">Ngữ cảnh</label>
                            <div class="tags-container" id="tagsContainer">
                                ${this.availableTags.map(tag => `
                                    <button class="tag-button" data-tag="${tag}">${tag}</button>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Quick Note -->
                        <div class="note-section">
                            <label class="section-label">Ghi chú nhanh (tùy chọn)</label>
                            <textarea 
                                class="note-input" 
                                id="momentNote" 
                                placeholder="Bạn muốn ghi nhớ điều gì không?"
                                rows="3"
                            ></textarea>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelMoment">Hủy</button>
                        <button class="btn" id="saveMoment">Lưu lại</button>
                    </div>
                </div>
            </div>
        `;

        const container = document.getElementById('momentModal');
        container.innerHTML = modalHTML;

        // Add event listeners
        this.attachEventListeners();

        // Add styles
        this.addStyles();
    }

    attachEventListeners() {
        const overlay = document.getElementById('momentModalOverlay');
        const closeBtn = document.getElementById('closeMomentModal');
        const cancelBtn = document.getElementById('cancelMoment');
        const saveBtn = document.getElementById('saveMoment');
        const slider = document.getElementById('emotionSlider');
        const tagsContainer = document.getElementById('tagsContainer');
        const noteInput = document.getElementById('momentNote');

        // Close handlers
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
        closeBtn.addEventListener('click', () => this.close());
        cancelBtn.addEventListener('click', () => this.close());

        // Save handler
        saveBtn.addEventListener('click', () => this.save());

        // Emotion slider
        slider.addEventListener('input', (e) => {
            this.emotionScore = parseInt(e.target.value);
            this.updateEmotionDisplay();
        });

        // Tags
        tagsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-button')) {
                const tag = e.target.dataset.tag;
                if (this.selectedTags.has(tag)) {
                    this.selectedTags.delete(tag);
                    e.target.classList.remove('active');
                } else {
                    this.selectedTags.add(tag);
                    e.target.classList.add('active');
                }
            }
        });

        // Note
        noteInput.addEventListener('input', (e) => {
            this.note = e.target.value;
        });
    }

    updateEmotionDisplay() {
        const emoji = document.getElementById('emotionEmoji');
        const scoreDisplay = document.getElementById('emotionScoreDisplay');

        scoreDisplay.textContent = this.emotionScore;

        // Update emoji based on score
        const emojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];
        emoji.textContent = emojis[this.emotionScore - 1];
    }

    open() {
        const modal = document.getElementById('momentModal');
        modal.classList.remove('hidden');
        this.isOpen = true;

        // Reset state
        this.emotionScore = 5;
        this.selectedTags.clear();
        this.note = '';

        document.getElementById('emotionSlider').value = 5;
        document.getElementById('momentNote').value = '';
        document.querySelectorAll('.tag-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.updateEmotionDisplay();
    }

    close() {
        const modal = document.getElementById('momentModal');
        modal.classList.add('hidden');
        this.isOpen = false;
    }

    async save() {
        try {
            const userId = localStorage.getItem('user_id');

            const data = {
                user_id: userId,
                emotion_score: this.emotionScore,
                context_tags: Array.from(this.selectedTags),
                note: this.note || null
            };

            const response = await fetch('/api/moment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Show success message in chat
                if (window.reflectionChat) {
                    window.reflectionChat.addMessage('✨ Đã lưu khoảnh khắc của bạn!', 'ai');
                }
                this.close();
            } else {
                alert('Có lỗi xảy ra khi lưu. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error saving moment:', error);
            alert('Không thể kết nối. Vui lòng kiểm tra kết nối internet.');
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                z-index: 1000;
                animation: fadeIn 0.2s ease;
            }
            
            .moment-modal {
                background-color: var(--surface-color);
                border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                width: 100%;
                max-width: 428px;
                max-height: 80vh;
                overflow-y: auto;
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--spacing-lg);
                border-bottom: 1px solid var(--surface-secondary-light);
            }
            
            .dark .modal-header {
                border-bottom-color: var(--surface-secondary-dark);
            }
            
            .modal-header h2 {
                margin: 0;
                font-size: 1.25rem;
            }
            
            .close-button {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-muted);
                padding: var(--spacing-sm);
            }
            
            .modal-body {
                padding: var(--spacing-lg);
            }
            
            .emotion-section,
            .tags-section,
            .note-section {
                margin-bottom: var(--spacing-xl);
            }
            
            .section-label {
                display: block;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
                color: var(--text-color);
            }
            
            .emotion-display {
                text-align: center;
                margin-bottom: var(--spacing-md);
            }
            
            .emotion-emoji {
                font-size: 3rem;
                display: block;
                margin-bottom: var(--spacing-sm);
            }
            
            .emotion-score {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--primary-light);
            }
            
            .emotion-slider {
                width: 100%;
                height: 8px;
                border-radius: var(--radius-full);
                outline: none;
                background: linear-gradient(to right, #EF4444, #F59E0B, #10B981);
                -webkit-appearance: none;
            }
            
            .emotion-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: white;
                border: 3px solid var(--primary-light);
                cursor: pointer;
                box-shadow: var(--shadow-md);
            }
            
            .emotion-slider::-moz-range-thumb {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: white;
                border: 3px solid var(--primary-light);
                cursor: pointer;
                box-shadow: var(--shadow-md);
            }
            
            .emotion-labels {
                display: flex;
                justify-content: space-between;
                margin-top: var(--spacing-sm);
                font-size: 0.875rem;
                color: var(--text-muted);
            }
            
            .tags-container {
                display: flex;
                flex-wrap: wrap;
                gap: var(--spacing-sm);
            }
            
            .tag-button {
                padding: var(--spacing-sm) var(--spacing-md);
                background-color: var(--surface-secondary-light);
                color: var(--text-color);
                border: 2px solid transparent;
                border-radius: var(--radius-full);
                font-size: 0.875rem;
                cursor: pointer;
                transition: all var(--transition-fast);
            }
            
            .dark .tag-button {
                background-color: var(--surface-secondary-dark);
            }
            
            .tag-button.active {
                background-color: var(--primary-light);
                color: white;
                border-color: var(--primary-dark);
            }
            
            .tag-button:hover {
                transform: translateY(-2px);
            }
            
            .note-input {
                width: 100%;
                padding: var(--spacing-md);
                background-color: var(--surface-secondary-light);
                color: var(--text-color);
                border: 2px solid transparent;
                border-radius: var(--radius-md);
                font-family: inherit;
                font-size: 1rem;
                resize: vertical;
                outline: none;
                transition: all var(--transition-base);
            }
            
            .dark .note-input {
                background-color: var(--surface-secondary-dark);
            }
            
            .note-input:focus {
                border-color: var(--primary-light);
                box-shadow: 0 0 0 3px rgba(134, 179, 244, 0.2);
            }
            
            .modal-footer {
                display: flex;
                gap: var(--spacing-md);
                padding: var(--spacing-lg);
                border-top: 1px solid var(--surface-secondary-light);
            }
            
            .dark .modal-footer {
                border-top-color: var(--surface-secondary-dark);
            }
            
            .modal-footer .btn {
                flex: 1;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.momentCheckin = new MomentCheckin();
    });
} else {
    window.momentCheckin = new MomentCheckin();
}

window.MomentCheckin = MomentCheckin;
