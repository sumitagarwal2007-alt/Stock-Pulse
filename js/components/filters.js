/* ============================================
   StockPulse — Filter Component
   Handles filter UI and state
   ============================================ */

class Filters {
  constructor(onFilterChange) {
    this.onFilterChange = onFilterChange;
    this.state = {
      category: 'all', // all, leader, ceo, celebrity, finance
      sentiment: 'all', // all, positive, negative
    };
  }

  /**
   * Render filter bars into containers
   */
  render() {
    const container = document.getElementById('filters-container');
    if (!container) return;

    container.innerHTML = `
      <div class="filter-bar">
        <button class="filter-pill ${this.state.category === 'all' ? 'filter-pill--active' : ''}" data-type="category" data-val="all">All Profiles</button>
        <button class="filter-pill ${this.state.category === 'leader' ? 'filter-pill--active' : ''}" data-type="category" data-val="leader">🏛️ Leaders</button>
        <button class="filter-pill ${this.state.category === 'ceo' ? 'filter-pill--active' : ''}" data-type="category" data-val="ceo">💼 CEOs</button>
        <button class="filter-pill ${this.state.category === 'celebrity' ? 'filter-pill--active' : ''}" data-type="category" data-val="celebrity">🎬 Celebrities</button>
        <button class="filter-pill ${this.state.category === 'finance' ? 'filter-pill--active' : ''}" data-type="category" data-val="finance">📊 Finance</button>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    const pills = container.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-type');
        const val = e.target.getAttribute('data-val');
        
        if (this.state[type] !== val) {
          this.state[type] = val;
          this.render(); // Re-render to update active state
          if (this.onFilterChange) {
            this.onFilterChange(this.state);
          }
        }
      });
    });
  }
}

// Export
if (typeof window !== 'undefined') {
  window.Filters = Filters;
}
