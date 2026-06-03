/* ============================================
   MarketOracle — Macro Sector Heatmap
   Renders a dynamically pulsing CSS Grid of sector sentiment
   ============================================ */

class SectorHeatmap {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(stocks, mentions, rankings = {}) {
    if (!this.container) return;

    // Group stocks by sector
    const sectors = {};
    
    stocks.forEach(stock => {
      if (!sectors[stock.sector]) {
        sectors[stock.sector] = {
          name: stock.sector,
          stocks: [],
          totalMentions: 0,
          totalScore: 0
        };
      }
      
      const sentiment = window.MentionData.getAggregateSentiment(stock.ticker);
      
      // Calculate a normalized score from 0-100
      let computedScore = 50;
      if (sentiment.totalMentions > 0) {
        computedScore = 50 + (sentiment.positive / 2) - (sentiment.negative / 2);
      }
      
      sectors[stock.sector].stocks.push({
        ...stock,
        sentiment,
        computedScore
      });
      
      sectors[stock.sector].totalMentions += sentiment.totalMentions;
      sectors[stock.sector].totalScore += computedScore;
    });

    let html = '';
    
    // Sort sectors by total mentions
    const sortedSectors = Object.values(sectors).sort((a, b) => b.totalMentions - a.totalMentions);
    
    sortedSectors.forEach(sector => {
      // Calculate average sentiment for the sector
      let avgScore = 50; // Neutral default
      if (sector.totalMentions > 0) {
        avgScore = sector.totalScore / sector.stocks.length; // rough approximation
      }
      
      // Determine color intensity based on score (0-100)
      // > 60 is Green, < 40 is Red, Middle is Gray/Neutral
      let bgColor = 'rgba(255, 255, 255, 0.05)';
      let glowClass = '';
      let statusText = 'Neutral';
      
      if (avgScore > 60) {
        // Bullish
        const intensity = Math.min((avgScore - 50) / 50, 1);
        bgColor = `rgba(0, 230, 118, ${0.1 + (intensity * 0.4)})`;
        glowClass = 'flash-green';
        statusText = 'Bullish';
      } else if (avgScore < 40) {
        // Bearish
        const intensity = Math.min((50 - avgScore) / 50, 1);
        bgColor = `rgba(255, 82, 82, ${0.1 + (intensity * 0.4)})`;
        glowClass = 'flash-red';
        statusText = 'Bearish';
      }
      
      // Sort constituents within sector by hit count, then by computed score
      sector.stocks.sort((a, b) => {
        const aHits = rankings[a.ticker] ? rankings[a.ticker].length : 0;
        const bHits = rankings[b.ticker] ? rankings[b.ticker].length : 0;
        if (bHits !== aHits) return bHits - aHits;
        return b.computedScore - a.computedScore;
      });

      const stockListHtml = sector.stocks.map(s => {
        const upIcon = s.computedScore > 55 ? '↑' : (s.computedScore < 45 ? '↓' : '–');
        const color = s.computedScore > 55 ? 'var(--semantic-success)' : (s.computedScore < 45 ? 'var(--semantic-danger)' : 'var(--text-tertiary)');
        const hits = rankings[s.ticker] ? rankings[s.ticker].length : 0;
        const hitIcon = hits > 0 ? `<span style="font-size: 10px; margin-left: 4px;" title="${hits} AI Catalyst Hits">🔥${hits}</span>` : '';
        
        return `
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px; color: var(--text-secondary);">
            <span>${s.ticker} ${hitIcon}</span>
            <span style="color: ${color}; font-weight: bold;">${upIcon} ${Math.round(s.computedScore)}</span>
          </div>
        `;
      }).join('');

      html += `
        <div class="glass-card ${glowClass}" style="background: ${bgColor}; padding: var(--space-4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">${sector.name}</h3>
            <div style="font-size: 12px; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-weight: bold;">${statusText}</div>
          </div>
          <div style="margin-bottom: 12px; font-size: 24px; font-weight: bold; font-family: var(--font-mono);">
            ${Math.round(avgScore)}<span style="font-size: 12px; color: var(--text-tertiary); margin-left: 4px;">Avg AI Score</span>
          </div>
          <div style="font-size: 12px; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.5px; margin-bottom: 8px;">Constituents</div>
          ${stockListHtml}
        </div>
      `;
    });
    
    this.container.innerHTML = html;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.SectorHeatmap = SectorHeatmap;
}
