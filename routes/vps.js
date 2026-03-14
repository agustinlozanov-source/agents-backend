import express from 'express';
import { executeCommand, readFile, listDirectory, checkConnection } from '../lib/ssh.js';
import { supabase } from '../server.js';

export const vpsRouter = express.Router();

// Check VPS connection status
vpsRouter.get('/status', async (req, res, next) => {
  try {
    const isConnected = await checkConnection();
    
    res.json({
      connected: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Execute command on VPS
vpsRouter.post('/command', async (req, res, next) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Security: whitelist allowed commands
    const allowedCommands = ['pm2 status', 'pm2 logs', 'ls', 'cat', 'pwd'];
    const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));

    if (!isAllowed) {
      return res.status(403).json({ error: 'Command not allowed' });
    }

    const result = await executeCommand(command);

    // Log to Supabase
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `VPS command executed: ${command}`,
      metadata: { result }
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List directory contents
vpsRouter.get('/directory', async (req, res, next) => {
  try {
    const { path = '/root/agente_ia' } = req.query;
    
    const listing = await listDirectory(path);
    
    res.json({
      path,
      listing
    });
  } catch (error) {
    next(error);
  }
});

// Read file from VPS
vpsRouter.get('/file', async (req, res, next) => {
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const content = await readFile(path);
    
    res.json({
      path,
      content
    });
  } catch (error) {
    next(error);
  }
});

// Get PM2 process status
vpsRouter.get('/pm2/status', async (req, res, next) => {
  try {
    const result = await executeCommand('pm2 jlist');
    
    if (result.success) {
      const processes = JSON.parse(result.stdout);
      res.json({ processes });
    } else {
      res.status(500).json({ error: 'Failed to get PM2 status' });
    }
  } catch (error) {
    next(error);
  }
});

// Restart PM2 process
vpsRouter.post('/pm2/restart', async (req, res, next) => {
  try {
    const { processName = 'agente-telegram' } = req.body;
    
    const result = await executeCommand(`pm2 restart ${processName}`);
    
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `PM2 process restarted: ${processName}`,
      metadata: { result }
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
