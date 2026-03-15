// routes/deploy.js
// API endpoint para ejecutar deploy automático

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);

export const deployRouter = express.Router();

// POST /api/deploy
deployRouter.post('/', async (req, res) => {
  try {
    const { proyecto_id, tarea_id } = req.body;

    if (!proyecto_id || !tarea_id) {
      return res.status(400).json({
        error: 'proyecto_id y tarea_id son requeridos'
      });
    }

    console.log(`🚀 Iniciando deploy automático para proyecto ${proyecto_id}`);

    const scriptPath = '/root/agente_ia/auto_deploy.sh';
    const command = `${scriptPath} ${proyecto_id} ${tarea_id}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000,
      env: {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY        SUPABASE_SERVICE_KEY: pog('Deploy output:', stdout);
    if (stderr) consol    if (stderr) consol    if er    if (stderr) consol    if (stderrrue,
      message: 'Deploy completa      message: 'Deploy completa      message: 'De } catch (error) {
    console.error('Error en deploy:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando deploy',
      details: error.message
    });
  }
});

// GET /api// GET /api// GET /api// GET /api//er// GET /api// GET /api// GET /a (req// GET /a {
  try {
    const { tarea_id } = req.params;

    const supa    const supa    const supa    const supa    const supa    const supa    const sERVICE_KEY
    );

    const { data: tarea } = await supabas    const { data: tarea } = await supabas    const { data: tar .eq('id', tarea_id)
      .single();

    const deployed = tarea?.metadata?.deployed || false;
    const deployed_at =     const deployed_at =     const deployed_at .json({ tarea_id, deployed, deployed_at });

  } catch (error) {
    console.error('Error verificando status:', error);
    res.status(500).json({ error: 'Error verificando status' });
  }
});
