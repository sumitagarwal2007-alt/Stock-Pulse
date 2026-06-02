/* ============================================
   StockPulse — Chart.js Sentiment Gauge
   Visualizes the aggregate sentiment distribution
   ============================================ */

class SentimentGauge {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.chart = null;
    
    this.colors = {
      positive: '#00E676',
      negative: '#FF5252',
      neutral: '#FFB74D',
      background: 'rgba(255, 255, 255, 0.05)'
    };
  }

  /**
   * Render the doughnut gauge
   * @param {Object} sentimentData - The aggregate sentiment object
   */
  render(sentimentData) {
    const ctx = document.getElementById(this.canvasId).getContext('2d');
    
    if (this.chart) {
      this.chart.destroy();
    }

    // If no data
    if (!sentimentData || sentimentData.totalMentions === 0) {
      this.renderEmpty(ctx);
      return;
    }

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
          data: [sentimentData.positive, sentimentData.neutral, sentimentData.negative],
          backgroundColor: [
            this.colors.positive,
            this.colors.neutral,
            this.colors.negative
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%', // Makes it thin
        plugins: {
          legend: {
            display: false // We use custom HTML legend
          },
          tooltip: {
            backgroundColor: 'rgba(12, 16, 33, 0.9)',
            titleColor: '#E8ECF4',
            bodyColor: '#8B95AD',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return ` ${context.label}: ${context.raw}%`;
              }
            }
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });

    this.updateCenterLabel(sentimentData);
  }

  renderEmpty(ctx) {
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['No Data'],
        datasets: [{
          data: [100],
          backgroundColor: [this.colors.background],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
    
    const container = document.getElementById(this.canvasId).closest('.sentiment-gauge-wrap');
    if (container) {
      let labelEl = container.querySelector('.sentiment-gauge__label');
      if (labelEl) {
        labelEl.innerHTML = `
          <div class="sentiment-gauge__score" style="color: #8B95AD">-</div>
          <div class="sentiment-gauge__text" style="color: #8B95AD">NO DATA</div>
        `;
      }
    }
  }

  updateCenterLabel(sentimentData) {
    const container = document.getElementById(this.canvasId).closest('.sentiment-gauge-wrap');
    if (!container) return;

    let labelEl = container.querySelector('.sentiment-gauge__label');
    if (!labelEl) return;

    // Find the mathematically dominant sentiment
    const highestScore = Math.max(sentimentData.positive, sentimentData.neutral, sentimentData.negative);
    
    let dominantType = 'neutral';
    if (highestScore === sentimentData.positive) dominantType = 'positive';
    else if (highestScore === sentimentData.negative) dominantType = 'negative';

    let color = this.colors[dominantType];

    labelEl.innerHTML = `
      <div class="sentiment-gauge__score" style="color: ${color}">${highestScore}%</div>
      <div class="sentiment-gauge__text" style="color: ${color}; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; font-weight: 600;">${dominantType}</div>
    `;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SentimentGauge = SentimentGauge;
}
