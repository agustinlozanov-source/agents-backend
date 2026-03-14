import express from 'express';
import { executeCommand } from '../lib/ssh.js';
import { supabase } from '../server.js';

export const agentesRouter = express.Router();

// Execute agent task
agentesRouter.post('/execute', async (req, res, next) => {
  try {
    const { agente_tipo, input, proyecto_id } = req.body;

    if (!agente_tipo || !input) {
      return res.status(400).json({ 
        error: 'agente_tipo and input are required' 
      });
    }

    // Validate agent type
    const validTypes = ['investigacion', 'programacion', 'automatizacion', 'auditor'];
    if (!validTypes.includes(agente_tipo)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }

    // Create task in Supabase
    const { data: tarea, error: tareaError } = await supabase
      .from('agente_tareas')
      .insert({
        proyecto_id,
        agente_tipo,
        input,
        status: 'procesando'
      })
      .select()
      .single();

    if (tareaError) throw tareaError;

    // Execute agent on VPS via Telegram bot
    // Format command based on agent type
    const commands = {
      investigacion: `/investigar ${input}`,
      programacion: `/desarrollar ${input}`,
      automatizacion: `/automatizar ${input}`,
      auditor: `/auditar`
    };

    const command = commands[agente_tipo];

    // Send command to bot (this is a simplified version)
    // In production, you'd use Telegram API directly
    const result = await executeCommand(
      `echo "${command}" | nc localhost 3000` // Placeholder
    );

    // Update task status
    await supabase
      .from('agente_tareas')
      .update({ 
        status: 'completado',
        output: result.stdout 
      })
      .eq('id', tarea.id);

    // Log
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `Agent executed: ${agente_tipo}`,
      metadata: { tarea_id: tarea.id, input }
    });

    res.json({
      success: true,
      tarea_id: tarea.id,
      agente_tipo,
      status: 'processing'
    });

  } catch (error) {
    next(error);
  }
});

// Get agent status
agentesRouter.get('/status', async (req, res, next) => {
  try {
    // Get recent tasks by agent type
    const { data: tareas } = await supabase
      .from('agente_tareas')
      .select('agente_tipo, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Aggregate status by agent type
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

    // Log
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
