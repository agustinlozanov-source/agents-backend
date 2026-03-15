// routes/deploy.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { executeCommand } from '../lib/ssh.js';

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

    console.log('Iniciando deploy para proyecto', proyecto_id);

    // Ejecutar auto_deploy.sh en el VPS via SSH
    const result = await executeCommand(
      `bash /root/agente_ia/auto_deploy.sh "${proyecto_id}" "${tarea_id}" 2>&1`
    );

    console.log('Deploy output:', result.stdout);
    if (result.stderr) console.error('Deploy stderr:', result.stderr);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Error ejecutando deploy en VPS',
        details: result.stderr || result.stdout
      });
    }

    res.json({
      success: true,
      message: 'Deploy completado exitosamente',
      output: result.stdout
    });

  } catch (error) {
    console.error('Error en deploy:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando deploy',
      details: error.message
    });
  }
});

// GET /api/deploy/status/:tarea_id
deployRouter.get('/status/:tarea_id', async (req, res) => {
  try {
    const { tarea_id } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: tarea } = await supabase
      .from('agente_tareas')
      .select('metadata')
      .eq('id', tarea_id)
      .single();

    const deployed = tarea?.metadata?.deployed || false;
    const deployed_at = tarea?.metadata?.deployed_at || null;

    res.json({ tarea_id, deployed, deployed_at });

  } catch (error) {
    console.error('Error verificando status:', error);
    res.status(500).json({ error: 'Error verificando status' });
  }
});
