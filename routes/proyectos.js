import express from 'express';
import { supabase } from '../server.js';
import { executeCommand } from '../lib/ssh.js';

export const proyectosRouter = express.Router();

// Get all projects
proyectosRouter.get('/', async (req, res, next) => {
  try {
    const { status, tipo, limit = 50 } = req.query;

    let query = supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) query = query.eq('status', status);
    if (tipo) query = query.eq('tipo', tipo);

    const { data: proyectos, error } = await query;

    if (error) throw error;

    res.json({ proyectos });
  } catch (error) {
    next(error);
  }
});

// Get single project
proyectosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .select(`
        *,
        tareas:agente_tareas(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!proyecto) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ proyecto });
  } catch (error) {
    next(error);
  }
});

// Create project
proyectosRouter.post('/', async (req, res, next) => {
  try {
    const { nombre, cliente, tipo, carpeta_vps, repo_github } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .insert({
        nombre,
        cliente,
        tipo,
        carpeta_vps,
        repo_github,
        status: 'idea'
      })
      .select()
      .single();

    if (error) throw error;

    // Create folder on VPS if specified
    if (carpeta_vps) {
      await executeCommand(
        `mkdir -p /root/agente_ia/proyectos/${carpeta_vps}`
      );
    }

    // Log
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `Project created: ${nombre}`,
      metadata: { proyecto_id: proyecto.id }
    });

    res.status(201).json({ proyecto });
  } catch (error) {
    next(error);
  }
});

// Update project
proyectosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `Project updated: ${id}`,
      metadata: { updates }
    });

    res.json({ proyecto });
  } catch (error) {
    next(error);
  }
});

// Delete project
proyectosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log
    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'railway',
      mensaje: `Project deleted: ${id}`
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get project tasks
proyectosRouter.get('/:id/tareas', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: tareas, error } = await supabase
      .from('agente_tareas')
      .select('*')
      .eq('proyecto_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ tareas });
  } catch (error) {
    next(error);
  }
});
