// insights.js - Data visualization and timeline

class InsightsView {
    constructor() {
        this.userId = localStorage.getItem('user_id');
        if (!this.userId) { window.location.href = '/app/auth'; return; }
        this.currentDays = 7;
        this.chart = null;

        this.init();
    }

    init() {
        // Initialize Chart
        this.initChart();

        // Load data
        this.loadEmotionData();
        this.loadTimeline();
        this.loadWeeklySummary();

        // Time selector buttons
        document.querySelectorAll('.time-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.time-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Reload data
                this.currentDays = parseInt(e.target.dataset.days);
                this.loadEmotionData();
            });
        });
    }

    initChart() {
        const ctx = document.getElementById('emotionChart');
        const isDark = document.documentElement.classList.contains('dark');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cảm xúc',
                    data: [],
                    borderColor: '#86B3F4',
                    backgroundColor: 'rgba(134, 179, 244, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#86B3F4',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        titleColor: isDark ? '#F8FAFC' : '#1E293B',
                        bodyColor: isDark ? '#94A3B8' : '#64748B',
                        borderColor: isDark ? '#374151' : '#E5E7EB',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function (context) {
                                return `Điểm cảm xúc: ${context.parsed.y}/10`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            color: isDark ? '#94A3B8' : '#64748B',
                            stepSize: 2
                        },
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: isDark ? '#94A3B8' : '#64748B'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    async loadEmotionData() {
        try {
            const response = await fetch(`${window.APP_CONFIG.getApiUrl()}/api/insights/emotions/${this.userId}?days=${this.currentDays}`);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                const labels = result.data.map(item => {
                    const date = new Date(item.timestamp);
                    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                });
                const scores = result.data.map(item => item.score);

                this.chart.data.labels = labels;
                this.chart.data.datasets[0].data = scores;
                this.chart.update();
            } else {
                // No data - show placeholder
                this.chart.data.labels = ['Chưa có dữ liệu'];
                this.chart.data.datasets[0].data = [5];
                this.chart.update();
            }
        } catch (error) {
            console.error('Error loading emotion data:', error);
        }
    }

    async loadTimeline() {
        try {
            const response = await fetch(`${window.APP_CONFIG.getApiUrl()}/api/insights/timeline/${this.userId}`);
            const result = await response.json();

            if (result.success && result.timeline) {
                const timelineContainer = document.getElementById('timeline');
                timelineContainer.innerHTML = '';

                result.timeline.forEach(item => {
                    const timelineItem = document.createElement('div');
                    timelineItem.className = 'timeline-item fade-in';
                    timelineItem.innerHTML = `
                        <div class="timeline-date">${this.formatDate(item.date)}</div>
                        <div class="timeline-title">${item.title}</div>
                        <div class="timeline-summary">${marked.parse(item.summary)}</div>
                    `;
                    timelineContainer.appendChild(timelineItem);
                });
            }
        } catch (error) {
            console.error('Error loading timeline:', error);
        }
    }

    async loadWeeklySummary() {
        try {
            const summaryElement = document.getElementById('weeklySummary');

            // For demo, show a static summary
            // In production, this would come from an AI-generated summary
            summaryElement.textContent = 'Tuần này bạn có vẻ đã ổn định hơn. Mức độ lo âu giảm nhẹ, và có sự gia tăng trong cảm xúc tích cực. Hãy tiếp tục phát huy nhé! 💙';
        } catch (error) {
            console.error('Error loading weekly summary:', error);
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Hôm nay, ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hôm qua, ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.insightsView = new InsightsView();
    });
} else {
    window.insightsView = new InsightsView();
}
