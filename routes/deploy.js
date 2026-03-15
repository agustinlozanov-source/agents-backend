// routes/deploy.js
import express from 'express';
import { executeCommand } from '../lib/ssh.js';
import { supabase } from '../server.js';

export const deployRouter = express.Router();

// POST /api/deploy
deployRouter.post('/', async (req, res) => {
  try {
    const { proyecto_id, tarea_id } = req.body;

    if (!proyecto_id || !tarea_id) {
      return res.status(400).json({ error: 'proyecto_id y tarea_id son requeridos' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase no configurado en el servidor' });
    }

    // 1. Obtener datos del proyecto y la tarea desde Railway (tiene las keys)
    const [{ data: proyecto }, { data: tarea }] = await Promise.all([
      supabase.from('proyectos').select('carpeta_vps, repo_github, nombre').eq('id', proyecto_id).single(),
      supabase.from('agente_tareas').select('output, archivos_generados').eq('id', tarea_id).single(),
    ]);

    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    if (!proyecto.carpeta_vps) {
      return res.status(400).json({ error: 'El proyecto no tiene carpeta_vps configurada' });
    }
    if (!tarea || !tarea.output) {
      return res.status(404).json({ error: 'Tarea no encontrada o sin output' });
    }

    const projectDir = proyecto.carpeta_vps.startsWith('/')
      ? proyecto.carpeta_vps
      : `/root/agente_ia/proyectos/${proyecto.carpeta_vps}`;
    const commitMsg = `feat: código generado por agente (tarea: ${tarea_id.substring(0, 8)})`;

    // 2. Ejecutar git en el VPS (solo git, sin necesitar Supabase en el VPS)
    const gitCmd = [
      `cd "${projectDir}"`,
      `git add -A`,
      `git diff --staged --quiet && echo "NO_CHANGES" || git commit -m "${commitMsg}"`,
      `git push origin main 2>&1 || git push origin master 2>&1`,
    ].join(' && ');

    const result = await executeCommand(gitCmd);
    console.log('Deploy stdout:', result.stdout);
    console.log('Deploy stderr:', result.stderr);

    if (result.stdout.includes('NO_CHANGES')) {
      return res.json({ success: true, message: 'No hay cambios nuevos para deployar', output: result.stdout });
    }

    if (!result.success && !result.stdout.includes('main') && !result.stdout.includes('master')) {
      return res.status(500).json({
        success: false,
        error: 'Error en git push',
        details: result.stderr || result.stdout
      });
    }

    // 3. Marcar tarea como deployed en Supabase (desde Railway)
    await supabase
      .from('agente_tareas')
      .update({ metadata: { deployed: true, deployed_at: new Date().toISOString() } })
      .eq('id', tarea_id);

    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'deploy',
      mensaje: `Deploy completado para proyecto ${proyecto.nombre}`,
      metadata: { proyecto_id, tarea_id }
    });

    res.json({
      success: true,
      message: 'Deploy completado exitosamente',
      output: result.stdout
    });

  } catch (error) {
    console.error('Error en deploy:', error);
    res.status(500).json({ success: false, error: 'Error ejecutando deploy', details: error.message });
  }
});

// GET /api/deploy/status/:tarea_id
deployRouter.get('/status/:tarea_id', async (req, res) => {
  try {
    const { tarea_id } = req.params;

    if (!supabase) return res.status(500).json({ error: 'Supabase no configurado' });

    const { data: tarea } = await supabase
      .from('agente_tareas')
      .select('metadata')
      .eq('id', tarea_id)
      .single();

    res.json({
      tarea_id,
      deployed: tarea?.metadata?.deployed || false,
      deployed_at: tarea?.metadata?.deployed_at || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando status' });
  }
});
