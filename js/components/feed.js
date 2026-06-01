/* ============================================
   StockPulse — Feed Component
   Renders the influencer mention feed
   ============================================ */

class Feed {
  /**
   * Render a list of mentions into the feed container
   * @param {Array} mentions - Array of mention objects
   * @param {HTMLElement} container - The DOM element to render into
   */
  static renderList(mentions, container) {
    if (!mentions || mentions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📭</div>
          <div class="empty-state__text">No recent mentions found</div>
        </div>
      `;
      return;
    }

    const html = mentions.map(mention => this.renderItem(mention)).join('');
    container.innerHTML = html;
  }

  /**
   * Render a single feed item
   * @param {Object} mention - The mention object
   * @returns {string} HTML string
   */
  static renderItem(mention) {
    const influencer = window.InfluencerData.getInfluencerById(mention.influencerId);
    if (!influencer) return '';

    const timeAgo = window.Formatters.formatTimeRelative(mention.timestamp);
    
    let categoryClass = '';
    switch(influencer.category) {
      case 'leader': categoryClass = 'category-badge--leader'; break;
      case 'ceo': categoryClass = 'category-badge--ceo'; break;
      case 'celebrity': categoryClass = 'category-badge--celebrity'; break;
      case 'finance': categoryClass = 'category-badge--finance'; break;
    }

    let sentimentClass = `sentiment-badge--${mention.sentiment}`;
    let dotClass = `sentiment-dot--${mention.sentiment}`;

    return `
      <div class="feed-item" data-id="${mention.id}" onclick="window.app.focusMention('${mention.id}')">
        <div class="feed-item__avatar">
          ${influencer.avatar}
          <div class="feed-item__avatar-badge ${categoryClass}"></div>
        </div>
        <div class="feed-item__content">
          <div class="feed-item__header">
            <span class="feed-item__name">${influencer.name}</span>
            <span class="feed-item__title">${influencer.title}</span>
          </div>
          <div class="feed-item__quote">"${mention.quote}"</div>
          <div class="feed-item__meta">
            <span class="feed-item__stock">${mention.ticker}</span>
            <div class="sentiment-badge ${sentimentClass}">
              <div class="sentiment-dot ${dotClass}"></div>
              ${mention.sentiment}
            </div>
            <span class="feed-item__source">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              ${mention.source}
            </span>
            <span class="feed-item__time" style="margin-left: auto;">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.Feed = Feed;
}
