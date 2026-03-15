// routes/deploy.js
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

    console.log('Iniciando deploy para proyecto', proyecto_id);

    const scriptPath = '/root/agente_ia/auto_deploy.sh';
    const command = scriptPath + ' ' + proyecto_id + ' ' + tarea_id;
    const env = { ...process.env };

    const { stdout, stderr } = await execAsync(command, { timeout: 60000, env });

    console.log('Deploy output:', stdout);
    if (stderr) console.error('Deploy stderr:', stderr);

    res.json({
      success: true,
      message: 'Deploy completado exitosamente',
      output: stdout
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
