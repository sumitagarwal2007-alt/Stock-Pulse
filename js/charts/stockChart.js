/* ============================================
   StockPulse — Chart.js Stock Chart
   Renders price history and mention overlays
   ============================================ */

class StockChart {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.chart = null;
    this.currentStock = null;
    this.mentions = [];
    
    // Theme colors
    this.colors = {
      primary: '#4F8EF7',
      primaryGlow: 'rgba(79, 142, 247, 0.2)',
      grid: 'rgba(255, 255, 255, 0.05)',
      text: '#8B95AD',
      positive: '#00E676',
      negative: '#FF5252',
      neutral: '#FFB74D',
    };
  }

  /**
   * Initialize or update the chart with stock data
   * @param {Object} stock - The stock object with prices array
   * @param {Array} mentions - Array of mention objects for this stock
   */
  render(stock, mentions = []) {
    this.currentStock = stock;
    this.mentions = mentions;
    
    const ctx = document.getElementById(this.canvasId).getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, this.colors.primaryGlow);
    gradient.addColorStop(1, 'rgba(79, 142, 247, 0)');

    const labels = stock.prices.map(p => window.Formatters.formatDate(p.date, true));
    const data = stock.prices.map(p => p.close);

    if (this.chart) {
      this.chart.destroy();
    }

    // Chart.js configuration
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: stock.ticker,
          data: data,
          borderColor: this.colors.primary,
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: this.colors.primary,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.4 // Smooth curves
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false, // We will use a custom external tooltip
            external: this.customTooltip.bind(this)
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              color: this.colors.text,
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            position: 'right',
            grid: {
              color: this.colors.grid,
              drawBorder: false,
              borderDash: [5, 5]
            },
            ticks: {
              color: this.colors.text,
              font: {
                family: "'JetBrains Mono', monospace",
                size: 11
              },
              callback: function(value) {
                return '$' + value;
              }
            }
          }
        }
      },
      plugins: [this.createMentionPlugin()]
    });
  }

  /**
   * Custom Chart.js Plugin to draw mention markers on the X axis
   */
  createMentionPlugin() {
    return {
      id: 'mentionMarkers',
      afterDraw: (chart) => {
        const { ctx, chartArea, scales } = chart;
        const xAxis = scales.x;
        const yAxis = scales.y;
        
        if (!this.mentions || this.mentions.length === 0) return;

        this.mentions.forEach(mention => {
          // Find the index of the mention date in the stock prices
          const mentionDate = mention.date;
          const index = this.currentStock.prices.findIndex(p => p.date === mentionDate);
          
          if (index !== -1) {
            const x = xAxis.getPixelForTick(index);
            // Draw marker on the price line
            const y = yAxis.getPixelForValue(this.currentStock.prices[index].close);
            
            // Draw pulse glow
            let color = this.colors.neutral;
            if (mention.sentiment === 'positive') color = this.colors.positive;
            if (mention.sentiment === 'negative') color = this.colors.negative;

            ctx.save();
            
            // Glow effect
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba'); 
            if (color.startsWith('#')) {
              // Convert hex to rgba for glow
              const r = parseInt(color.slice(1, 3), 16);
              const g = parseInt(color.slice(3, 5), 16);
              const b = parseInt(color.slice(5, 7), 16);
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
            }
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#06080f'; // background color
            ctx.stroke();
            
            ctx.restore();
          }
        });
      }
    };
  }

  /**
   * Custom HTML Tooltip logic
   */
  customTooltip(context) {
    let tooltipEl = document.getElementById('chartjs-tooltip');

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chartjs-tooltip';
      tooltipEl.classList.add('custom-tooltip');
      tooltipEl.innerHTML = '<div class="tooltip-content"></div>';
      document.body.appendChild(tooltipEl);
    }

    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) {
      tooltipEl.style.opacity = 0;
      return;
    }

    // Set Text
    if (tooltipModel.body) {
      const dataIndex = tooltipModel.dataPoints[0].dataIndex;
      const priceData = this.currentStock.prices[dataIndex];
      const dateStr = window.Formatters.formatDate(priceData.date);
      const priceStr = window.Formatters.formatCurrency(priceData.close);
      
      // Check if there's a mention on this date
      const daysMentions = this.mentions.filter(m => m.date === priceData.date);
      let mentionsHtml = '';
      
      if (daysMentions.length > 0) {
        mentionsHtml = daysMentions.map(mention => {
          const influencer = window.InfluencerData.getInfluencerById(mention.influencerId);
          let colorClass = `sentiment-dot--${mention.sentiment}`;
          
          return `
            <div class="custom-tooltip__mention">
              <div class="custom-tooltip__mention-avatar">${influencer.avatar}</div>
              <div>
                <div class="custom-tooltip__mention-name">${influencer.name}</div>
                <div class="custom-tooltip__mention-text">"${mention.quote}"</div>
                <div class="sentiment-badge sentiment-badge--${mention.sentiment}" style="margin-top: 4px;">
                  <div class="sentiment-dot ${colorClass}"></div>
                  ${mention.sentiment}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      const innerHtml = `
        <div class="custom-tooltip__header">
          <div class="custom-tooltip__date">${dateStr}</div>
          <div class="custom-tooltip__price">${priceStr}</div>
        </div>
        ${mentionsHtml}
      `;

      tooltipEl.querySelector('.tooltip-content').innerHTML = innerHtml;
    }

    const position = context.chart.canvas.getBoundingClientRect();

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.position = 'absolute';
    
    // Determine positioning to avoid falling off edge
    let left = position.left + window.pageXOffset + tooltipModel.caretX;
    let top = position.top + window.pageYOffset + tooltipModel.caretY;
    
    // Adjust if too close to right edge
    if (left + 250 > window.innerWidth) {
      left -= 260; // shift left
    } else {
      left += 20; // add slight offset
    }

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.transition = 'all 0.15s ease';
  }
}

// Export
if (typeof window !== 'undefined') {
  window.StockChart = StockChart;
}
