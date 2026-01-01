// chat.js - Main chat functionality with WebSocket and Memory Integration

class ReflectionChat {
    constructor(userId) {
        this.ws = null;
        this.userId = userId || this.getUserId();
        this.chatContainer = document.getElementById('chatContainer');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.statusText = document.getElementById('statusText');
        this.smartChips = document.getElementById('smartChips');

        this.isConnected = false;
        this.messageHistory = [];

        // Load chat history from localStorage
        this.loadChatHistory();

        this.init();
    }

    getUserId() {
        // Fallback if no userId provided (should not happen in auth mode)
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('user_id', userId);
        }
        return userId;
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem(`chat_history_${this.userId}`);
            if (saved) {
                const messages = JSON.parse(saved);
                // Restore messages to DOM
                messages.forEach(msg => {
                    this.addMessageToDOM(msg.content, msg.isUser, false); // false = don't save again
                });
                console.log(`✅ Loaded ${messages.length} messages from history`);
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem(`chat_history_${this.userId}`, JSON.stringify(this.messageHistory));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }

    init() {
        // Connect to WebSocket
        this.connectWebSocket();

        // Event listeners
        this.chatInput.addEventListener('input', () => {
            this.sendButton.disabled = !this.chatInput.value.trim();
        });

        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Smart chips
        this.smartChips.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                const message = e.target.dataset.message;
                if (message.includes('Check-in')) {
                    // Open moment check-in modal
                    if (window.momentCheckin) {
                        window.momentCheckin.open();
                    }
                } else {
                    this.chatInput.value = message;
                    this.sendMessage();
                }
            }
        });
    }

    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/chat/${this.userId}`;

        this.statusText.textContent = 'Đang kết nối...';

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.statusText.textContent = 'Đang hoạt động';
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.statusText.textContent = 'Lỗi kết nối';
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.statusText.textContent = 'Mất kết nối';

                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    this.connectWebSocket();
                }, 3000);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.statusText.textContent = 'Offline';
        }
    }

    handleMessage(data) {
        // Clear timeout
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }

        // Remove typing indicator
        this.hideTypingIndicator();

        if (data.type === 'message') {
            this.addMessage(data.content, false);
        } else if (data.type === 'error') {
            this.addMessage(`Xin lỗi: ${data.content}`, false);
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.isConnected) return;

        // Add user message to UI
        this.addMessage(message, true);

        // Clear input
        this.chatInput.value = '';
        this.sendButton.disabled = true;

        // Show typing indicator
        this.showTypingIndicator();

        // Send to server
        this.ws.send(JSON.stringify({
            message: message,
            timestamp: new Date().toISOString()
        }));

        // Set timeout to hide typing indicator if no response
        this.responseTimeout = setTimeout(() => {
            this.hideTypingIndicator();
            this.addMessage('Xin lỗi, AI đang phản hồi chậm. Vui lòng thử lại.', false);
        }, 30000); // 30 seconds timeout
    }

    addMessage(content, isUser = false) {
        this.addMessageToDOM(content, isUser, true); // true = save to history
    }

    addMessageToDOM(content, isUser = false, saveToHistory = true) {
        const messageGroup = document.createElement('div');
        messageGroup.classList.add('message-group');
        if (isUser) {
            messageGroup.classList.add('user');
        } else {
            messageGroup.classList.add('fade-in');
        }

        if (!isUser) {
            const avatar = document.createElement('div');
            avatar.classList.add('message-avatar');
            messageGroup.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');
        bubble.classList.add(isUser ? 'user' : 'ai');

        // Render Markdown for AI messages
        if (!isUser && typeof marked !== 'undefined') {
            bubble.innerHTML = marked.parse(content);
        } else {
            bubble.textContent = content;
        }

        messageGroup.appendChild(bubble);
        this.chatContainer.appendChild(messageGroup);

        // Save to history
        if (saveToHistory) {
            this.messageHistory.push({ content, isUser, timestamp: Date.now() });
            // Keep only last 50 messages to avoid localStorage bloat
            if (this.messageHistory.length > 50) {
                this.messageHistory = this.messageHistory.slice(-50);
            }
            this.saveChatHistory();
        }

        // Auto scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    showTypingIndicator() {
        const existing = document.getElementById('typingIndicator');
        if (existing) return;

        const messageGroup = document.createElement('div');
        messageGroup.className = 'message-group fade-in';
        messageGroup.id = 'typingIndicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        messageGroup.appendChild(avatar);

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble ai';
        bubble.appendChild(indicator);
        messageGroup.appendChild(bubble);

        this.chatContainer.appendChild(messageGroup);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

// Export for other modules
window.ReflectionChat = ReflectionChat;
