/* ============================================
   StockPulse — Mock Influencers Data
   Profiles for leaders, CEOs, celebrities, and finance gurus
   ============================================ */

const INFLUENCERS = [
  // ── World Leaders ──
  {
    id: 'inf_1',
    name: 'President Smith',
    title: 'US President',
    category: 'leader',
    avatar: 'S',
    influenceScore: 98,
  },
  {
    id: 'inf_2',
    name: 'Prime Minister Davis',
    title: 'UK Prime Minister',
    category: 'leader',
    avatar: 'D',
    influenceScore: 92,
  },
  {
    id: 'inf_3',
    name: 'Chancellor Müller',
    title: 'German Chancellor',
    category: 'leader',
    avatar: 'M',
    influenceScore: 89,
  },
  
  // ── Forbes CEOs ──
  {
    id: 'inf_4',
    name: 'Elon Musk',
    title: 'CEO, Tesla & X',
    category: 'ceo',
    avatar: 'E',
    influenceScore: 99,
  },
  {
    id: 'inf_5',
    name: 'Tim Cook',
    title: 'CEO, Apple',
    category: 'ceo',
    avatar: 'T',
    influenceScore: 95,
  },
  {
    id: 'inf_6',
    name: 'Jensen Huang',
    title: 'CEO, NVIDIA',
    category: 'ceo',
    avatar: 'J',
    influenceScore: 96,
  },
  {
    id: 'inf_7',
    name: 'Satya Nadella',
    title: 'CEO, Microsoft',
    category: 'ceo',
    avatar: 'S',
    influenceScore: 94,
  },
  {
    id: 'inf_8',
    name: 'Mark Zuckerberg',
    title: 'CEO, Meta',
    category: 'ceo',
    avatar: 'M',
    influenceScore: 93,
  },
  {
    id: 'inf_15',
    name: 'Alex Karp',
    title: 'CEO, Palantir',
    category: 'ceo',
    avatar: 'A',
    influenceScore: 88,
  },
  {
    id: 'inf_16',
    name: 'Lisa Su',
    title: 'CEO, AMD',
    category: 'ceo',
    avatar: 'L',
    influenceScore: 92,
  },
  
  // ── Celebrities ──
  {
    id: 'inf_9',
    name: 'Mark Cuban',
    title: 'Entrepreneur / Shark',
    category: 'celebrity',
    avatar: 'M',
    influenceScore: 85,
  },
  {
    id: 'inf_10',
    name: 'Chamath P.',
    title: 'Venture Capitalist',
    category: 'celebrity',
    avatar: 'C',
    influenceScore: 82,
  },
  {
    id: 'inf_17',
    name: 'Roaring Kitty',
    title: 'Retail Investor Icon',
    category: 'celebrity',
    avatar: 'R',
    influenceScore: 97,
  },
  
  // ── Finance Gurus ──
  {
    id: 'inf_11',
    name: 'Warren Buffett',
    title: 'CEO, Berkshire Hathaway',
    category: 'finance',
    avatar: 'W',
    influenceScore: 99,
  },
  {
    id: 'inf_12',
    name: 'Cathie Wood',
    title: 'CEO, ARK Invest',
    category: 'finance',
    avatar: 'C',
    influenceScore: 90,
  },
  {
    id: 'inf_13',
    name: 'Jim Cramer',
    title: 'Host, Mad Money',
    category: 'finance',
    avatar: 'J',
    influenceScore: 85,
  },
  {
    id: 'inf_14',
    name: 'Ray Dalio',
    title: 'Founder, Bridgewater',
    category: 'finance',
    avatar: 'R',
    influenceScore: 88,
  },
];

/**
 * Get all influencers
 * @returns {Array} Array of influencer objects
 */
function getAllInfluencers() {
  return INFLUENCERS;
}

/**
 * Get an influencer by ID
 * @param {string} id - Influencer ID
 * @returns {Object|undefined} Influencer object
 */
function getInfluencerById(id) {
  return INFLUENCERS.find(inf => inf.id === id);
}

/**
 * Get influencers by category
 * @param {string} category - Category string (leader, ceo, celebrity, finance)
 * @returns {Array} Array of matching influencers
 */
function getInfluencersByCategory(category) {
  return INFLUENCERS.filter(inf => inf.category === category);
}

// Export for module usage
if (typeof window !== 'undefined') {
  window.InfluencerData = { INFLUENCERS, getAllInfluencers, getInfluencerById, getInfluencersByCategory };
}
