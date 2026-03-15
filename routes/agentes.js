import express from 'express';
import { executeCommand } from '../lib/ssh.js';
import { supabase } from '../server.js';

export const agentesRouter = express.Router();

// Execute agent task
agentesRouter.post('/execute', async (req, res, next) => {
  try {
    const { agente_tipo, input, proyecto_id } = req.body;

    if (!agente_tipo || !input) {
      return res.status(400).json({ error: 'agente_tipo and input are required' });
    }

    const validTypes = ['investigacion', 'programacion', 'automatizacion', 'auditor'];
    if (!validTypes.includes(agente_tipo)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }

    // Create task in Supabase (status: procesando)
    const { data: tarea, error: tareaError } = await supabase
      .from('agente_tareas')
      .insert({
        proyecto_id: proyecto_id || null,
        agente_tipo,
        input,
        status: 'procesando'
      })
      .select()
      .single();

    if (tareaError) throw tareaError;

    // Respond immediately — agent runs async on VPS
    res.json({ success: true, tarea_id: tarea.id, agente_tipo, status: 'procesando' });

    // Sanitize input to avoid shell injection
    const safeInput = input
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`');

    const proyectoArg = proyecto_id ? `--proyecto_id "${proyecto_id}"` : '';

    // Run agent on VPS in background via SSH (nohup so it outlives the SSH session)
    const cmd = `cd /root/agente_ia && nohup node run_agent.js --tipo ${agente_tipo} --input "${safeInput}" --tarea_id ${tarea.id} ${proyectoArg} > /tmp/agente_${tarea.id}.log 2>&1 &`;

    executeCommand(cmd).catch((err) => {
      console.error('SSH execute error:', err.message);
      supabase
        .from('agente_tareas')
        .update({ status: 'error', output: 'Error al conectar con el VPS: ' + err.message })
        .eq('id', tarea.id)
        .then();
    });

  } catch (error) {
    next(error);
  }
});

// Get agent status
agentesRouter.get('/status', async (req, res, next) => {
  try {
    const { data: tareas } = await supabase
      .from('agente_tareas')
      .select('agente_tipo, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const status = {
      investigacion: { activo: false, ultimaTarea: null },
      programacion: { activo: false, ultimaTarea: null },
      automatizacion: { activo: false, ultimaTarea: null },
      auditor: { activo: false, ultimaTarea: null }
    };

    tareas?.forEach(tarea => {
      if (!status[tarea.agente_tipo].ultimaTarea) {
        status[tarea.agente_tipo].ultimaTarea = tarea.created_at;
        status[tarea.agente_tipo].activo = tarea.status === 'procesando';
      }
    });

    res.json({ status });
  } catch (error) {
    next(error);
  }
});

// Get agent skills/prompts
agentesRouter.get('/skills', async (req, res, next) => {
  try {
    const { agente_tipo } = req.query;

    let query = supabase.from('agente_skills').select('*');

    if (agente_tipo) {
      query = query.eq('agente_tipo', agente_tipo);
    }

    query = query.eq('activo', true);

    const { data: skills, error } = await query;

    if (error) throw error;

    res.json({ skills });
  } catch (error) {
    next(error);
  }
});

// Update agent skill/prompt
agentesRouter.put('/skills/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prompt, activo } = req.body;

    const updates = {};
    if (prompt !== undefined) updates.prompt = prompt;
    if (activo !== undefined) updates.activo = activo;

    const { data, error } = await supabase
      .from('agente_skills')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: 'Agent skill updated',
      metadata: { skill_id: id, updates }
    });

    res.json({ skill: data });
  } catch (error) {
    next(error);
  }
});
