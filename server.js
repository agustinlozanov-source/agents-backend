import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { vpsRouter } from './routes/vps.js';
import { agentesRouter } from './routes/agentes.js';
import { proyectosRouter } from './routes/proyectos.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key en backend, no anon
);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de requests
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint - NO dependencies
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasVpsHost: !!process.env.VPS_HOST,
      port: process.env.PORT
    }
  });
});

// Routes
app.use('/api/vps', vpsRouter);
app.use('/api/agentes', agentesRouter);
app.use('/api/proyectos', proyectosRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Log error to Supabase
  supabase.from('logs').insert({
    nivel: 'error',
    fuente: 'railway',
    mensaje: err.message,
    metadata: { stack: err.stack }
  }).then();

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log startup to Supabase
  supabase.from('logs').insert({
    nivel: 'info',
    fuente: 'railway',
    mensaje: 'Backend server started',
    metadata: { port: PORT }
  }).then();
});
