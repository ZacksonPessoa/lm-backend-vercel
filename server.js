import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'ml-backend', timestamp: new Date() });
});

// ML API Routes
import healthHandler from './api/health.js';
import authHandler from './api/ml/auth.js';
import callbackHandler from './api/ml/callback.js';
import financeHandler from './api/ml/finance.js';
import meHandler from './api/ml/me.js';
import notificationsHandler from './api/ml/notifications.js';
import productAnalysisHandler from './api/ml/product-analysis.js';
import productsHandler from './api/ml/products.js';
import statsHandler from './api/ml/stats.js';
import tokenHandler from './api/ml/token.js';
import transactionsHandler from './api/ml/transactions.js';

// Wrapper function to adapt serverless handlers to Express
const wrapHandler = (handler) => (req, res) => handler(req, res);

// Route handlers
app.all('/api', wrapHandler(healthHandler));

// ML Authentication
app.all('/api/ml/auth', wrapHandler(authHandler));
app.all('/api/ml/callback', wrapHandler(callbackHandler));
app.all('/api/ml/token', wrapHandler(tokenHandler));

// ML Data endpoints
app.all('/api/ml/me', wrapHandler(meHandler));
app.all('/api/ml/products', wrapHandler(productsHandler));
app.all('/api/ml/product-analysis', wrapHandler(productAnalysisHandler));
app.all('/api/ml/finance', wrapHandler(financeHandler));
app.all('/api/ml/transactions', wrapHandler(transactionsHandler));
app.all('/api/ml/stats', wrapHandler(statsHandler));
app.all('/api/ml/notifications', wrapHandler(notificationsHandler));

// Health endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', status: 404 });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
