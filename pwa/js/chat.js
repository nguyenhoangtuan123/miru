// chat.js - Main chat functionality with WebSocket and Memory Integration

class ReflectionChat {
    constructor(userId) {
        this.ws = null;
        this.userId = userId || this.getUserId();
        
        // Check authentication
        const getAuthToken = () => {
            const match = document.cookie.match(new RegExp('(^| )access_token=([^;]+)'));
            return match ? match[2] : null;
        };
        
        if (!this.userId || !getAuthToken()) {
            console.log('[Auth] Not authenticated, redirecting...');
            window.location.href = '/app/auth';
            return;
        }
        
        this.chatContainer = document.getElementById('chatContainer');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.statusText = document.getElementById('statusText');
        this.smartChips = document.getElementById('smartChips');

        this.isConnected = false;
        this.messageHistory = [];

        // Proactive message tracking
        this.lastActivityTime = Date.now();
        this.proactiveTimer = null;
        this.proactiveShown = false;
        this.INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

        this.sessionId = this.getSessionIdFromUrl();
        this.msgLimit = 50;

        // Load chat history from Server (Source of Truth)
        if (this.sessionId) {
            this.loadHistoryFromServer();
        } else {
            console.log('ℹ️ No session ID found in URL');
        }

        this.init();
    }

    getSessionIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('session_id');
    }

    async loadHistoryFromServer() {
        try {
            console.log(`🔄 Fetching history for session ${this.sessionId}...`);
            console.log(`[DEBUG] Request URL: ${window.APP_CONFIG.getApiUrl()}/api/chat/sessions/${this.sessionId}/messages?user_id=${this.userId}&limit=${this.msgLimit}`);

            const response = await fetch(`${window.APP_CONFIG.getApiUrl()}/api/chat/sessions/${this.sessionId}/messages?user_id=${this.userId}&limit=${this.msgLimit}`);
            console.log(`[DEBUG] Response status: ${response.status}`);

            const data = await response.json();
            console.log(`[DEBUG] Response data:`, data);

            if (data.success && data.messages) {
                console.log(`[DEBUG] Received ${data.messages.length} messages from server`);

                // Clear existing messages? Maybe not if we want to keep welcome msg
                // this.chatContainer.innerHTML = '';

                data.messages.forEach((msg, index) => {
                    console.log(`[DEBUG] Processing message ${index}: role=${msg.role}, content_length=${msg.content?.length}`);
                    const isUser = msg.role === 'user';
                    // Don't save to history array again, just render
                    this.addMessageToDOM(msg.content, isUser, false);
                });
                console.log(`✅ Loaded ${data.messages.length} messages from server`);

                // Scroll to bottom
                this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
            } else {
                console.warn(`[DEBUG] No messages loaded. success=${data.success}, messages=${data.messages}`);
                if (data.error) {
                    console.error(`[DEBUG] Server error: ${data.error}`);
                }
            }
        } catch (e) {
            console.error('❌ Error loading server history:', e);
        }
    }

    // Deprecated: loadChatHistory (Local Storage)
    loadChatHistory() {
        // No-op or migration logic if needed
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

        // Start proactive message timer
        this.startProactiveTimer();
    }

    // ========== Proactive Message Methods ==========

    startProactiveTimer() {
        // Clear any existing timer
        if (this.proactiveTimer) {
            clearTimeout(this.proactiveTimer);
        }

        // Set new timer for 5 minutes
        this.proactiveTimer = setTimeout(() => {
            this.checkAndShowProactiveMessage();
        }, this.INACTIVITY_THRESHOLD);

        console.log('🕐 Proactive timer started (5 minutes) - will trigger at:', new Date(Date.now() + this.INACTIVITY_THRESHOLD).toLocaleTimeString());
    }

    resetProactiveTimer() {
        this.lastActivityTime = Date.now();
        this.proactiveShown = false;
        this.startProactiveTimer();
    }

    async checkAndShowProactiveMessage() {
        // Don't show if already shown or no connection
        if (this.proactiveShown || !this.isConnected) {
            console.log('⏭️ Skipping proactive message - already shown or not connected');
            return;
        }

        console.log('🔍 Checking for proactive message...');

        try {
            const response = await fetch(`${window.APP_CONFIG.getApiUrl()}/api/proactive/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    last_active: new Date(this.lastActivityTime).toISOString(),
                    include_daily_message: true
                })
            });

            console.log('📡 API response status:', response.status);

            if (!response.ok) throw new Error('Failed to fetch proactive message');

            const data = await response.json();
            console.log('📨 API response data:', data);

            if (data.success && data.notifications && data.notifications.length > 0) {
                // Show the first notification
                const notification = data.notifications[0];
                console.log('✅ Showing proactive message:', notification.message);
                this.showProactiveMessage(notification);
                this.proactiveShown = true;
            } else {
                console.log('ℹ️ No proactive messages to show');
            }
        } catch (error) {
            console.error('❌ Error fetching proactive message:', error);
        }
    }

    showProactiveMessage(notification) {
        // Create proactive message element
        const messageGroup = document.createElement('div');
        messageGroup.className = 'message-group fade-in proactive-message';
        messageGroup.id = 'proactiveMessage';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        messageGroup.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble ai proactive';

        // Message content
        const content = document.createElement('div');
        content.className = 'proactive-content';
        content.innerHTML = `<p>${notification.message}</p>`;
        bubble.appendChild(content);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'proactive-actions';
        actions.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;';

        // Reply button
        const replyBtn = document.createElement('button');
        replyBtn.className = 'btn-proactive-reply';
        replyBtn.textContent = '💭 Trả lờ';
        replyBtn.style.cssText = 'padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(127, 13, 242, 0.5); background: rgba(127, 13, 242, 0.2); color: white; cursor: pointer; font-size: 13px;';
        replyBtn.onclick = () => {
            this.dismissProactiveMessage();
            this.chatInput.focus();
        };
        actions.appendChild(replyBtn);

        // Check-in button
        const checkinBtn = document.createElement('button');
        checkinBtn.className = 'btn-proactive-checkin';
        checkinBtn.textContent = '✅ Check-in';
        checkinBtn.style.cssText = 'padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.5); background: rgba(16, 185, 129, 0.2); color: white; cursor: pointer; font-size: 13px;';
        checkinBtn.onclick = () => {
            this.dismissProactiveMessage();
            if (window.momentCheckin) {
                window.momentCheckin.open();
            }
        };
        actions.appendChild(checkinBtn);

        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'btn-proactive-dismiss';
        dismissBtn.textContent = '✕';
        dismissBtn.style.cssText = 'padding: 6px 10px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.1); color: white; cursor: pointer; font-size: 13px;';
        dismissBtn.onclick = () => this.dismissProactiveMessage();
        actions.appendChild(dismissBtn);

        bubble.appendChild(actions);
        messageGroup.appendChild(bubble);

        this.chatContainer.appendChild(messageGroup);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

        console.log('🤖 Proactive message shown:', notification.message);
    }

    dismissProactiveMessage() {
        const proactiveMsg = document.getElementById('proactiveMessage');
        if (proactiveMsg) {
            proactiveMsg.remove();
        }
        // Restart timer
        this.resetProactiveTimer();
    }

    connectWebSocket() {
        // Get auth token from cookie
        const getAuthToken = () => {
            const match = document.cookie.match(new RegExp('(^| )access_token=([^;]+)'));
            return match ? match[2] : null;
        };
        
        const token = getAuthToken();
        const wsUrl = token 
            ? `${window.APP_CONFIG.getWsUrl()}/ws/chat/${this.userId}?token=${token}`
            : `${window.APP_CONFIG.getWsUrl()}/ws/chat/${this.userId}`;

        console.log('[WS] Connecting to:', wsUrl);
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
            // Reset proactive timer on AI response
            this.resetProactiveTimer();
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
            session_id: this.sessionId, // Critical for backend saving
            timestamp: new Date().toISOString()
        }));

        // Set timeout to hide typing indicator if no response
        this.responseTimeout = setTimeout(() => {
            this.hideTypingIndicator();
            this.addMessage('Xin lỗi, AI đang phản hồi chậm. Vui lòng thử lại.', false);
        }, 30000); // 30 seconds timeout

        // Reset proactive timer on user message
        this.resetProactiveTimer();

        // Dismiss any existing proactive message
        this.dismissProactiveMessage();
    }

    addMessage(content, isUser = false, isProactive = false) {
        this.addMessageToDOM(content, isUser, true, isProactive); // true = save to history
    }

    addMessageToDOM(content, isUser = false, saveToHistory = true, isProactive = false) {
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

        // Add proactive styling
        if (isProactive) {
            bubble.classList.add('proactive');
            bubble.style.borderLeft = '3px solid #7f0df2';
        }

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
