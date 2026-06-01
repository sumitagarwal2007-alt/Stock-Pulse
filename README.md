# StockPulse 📈
**Influencer & Market Monitor**

StockPulse is a visually stunning, single-page web application designed to track stock market movements overlaid with real-time financial news and AI-driven sentiment analysis. 

Built entirely with vanilla web technologies, StockPulse requires no build step and can be hosted anywhere statically.

## Features ✨
- **Live Market Data:** Fetches real-time stock prices and daily changes using the Finnhub API.
- **Dynamic Search:** Look up and track any US stock ticker on the fly.
- **Sentiment Engine:** Analyzes financial news headlines to gauge market sentiment (Positive, Neutral, Negative).
- **Interactive Charts:** Beautiful gradient line charts powered by Chart.js, featuring glowing mention overlays and rich HTML tooltips.
- **Premium UI:** Glassmorphism design, fluid animations, and a cohesive dark mode aesthetic.
- **Auto-Fallback System:** If the API fails or hits rate limits, the app seamlessly falls back to a realistic data simulation to ensure the dashboard remains functional and beautiful.

## Running Locally 💻
Since there is no backend or build step, you can run this immediately:
1. Clone this repository.
2. Open `index.html` in your browser.
3. Or run a local server: `python3 -m http.server 8080`

## Deployment 🚀
This app is perfect for **GitHub Pages**, **Vercel**, or **Netlify**.
Simply connect your GitHub repository and set the root directory. No build command is required.

## Technologies Used
- HTML5 / CSS3 (CSS Variables, Flexbox)
- Vanilla JavaScript (ES6+ Modules)
- Chart.js (for Canvas visualizations)
- Finnhub API (for market data)
