// routes/deploy.js
import express from 'express';
import { executeCommand } from '../lib/ssh.js';
import { supabase } from '../server.js';

export const deployRouter = express.Router();

/**
 * Parse code blocks from Claude's output.
 * Detects filename from the first line of each block:
 *   // src/index.html
 *   /* styles.css *\/
 *   <!-- index.html -->
 */
function parseFilesFromOutput(output) {
  const files = [];
  const blockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = blockRegex.exec(output)) !== null) {
    const code = match[1];
    const lines = code.split('\n');
    const firstLine = lines[0].trim();

    const filenamePatterns = [
      /^\/\/ (.+\.\w+)$/,         // // filename.js
      /^\/\* (.+\.\w+) \*\/$/,    // /* filename.css */
      /^<!-- (.+\.\w+) -->$/,     // <!-- filename.html -->
      /^# (.+\.\w+)$/,            // # filename.md
    ];

    let filename = null;
    for (const pattern of filenamePatterns) {
      const m = firstLine.match(pattern);
      if (m && !m[1].includes(' ')) {
        filename = m[1].trim();
        break;
      }
    }

    if (filename) {
      // Remove the filename comment line from content
      const content = lines.slice(1).join('\n').trimEnd();
      files.push({ filename, content });
    }
  }

  return files;
}

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

    // 1. Leer proyecto y tarea desde Supabase
    const [{ data: proyecto }, { data: tarea }] = await Promise.all([
      supabase.from('proyectos').select('carpeta_vps, repo_github, nombre').eq('id', proyecto_id).single(),
      supabase.from('agente_tareas').select('output').eq('id', tarea_id).single(),
    ]);

    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!proyecto.carpeta_vps) return res.status(400).json({ error: 'El proyecto no tiene carpeta_vps configurada' });
    if (!tarea?.output) return res.status(404).json({ error: 'Tarea no encontrada o sin output' });

    const projectDir = proyecto.carpeta_vps.startsWith('/')
      ? proyecto.carpeta_vps
      : `/root/agente_ia/proyectos/${proyecto.carpeta_vps}`;

    // 2. Parsear archivos del output del agente
    const files = parseFilesFromOutput(tarea.output);
    console.log(`Deploy: encontrados ${files.length} archivos en el output`);

    // 3. Escribir cada archivo en el VPS via SSH usando base64
    //    (base64 es seguro con cualquier contenido — sin problemas de caracteres especiales)
    for (const file of files) {
      const b64 = Buffer.from(file.content).toString('base64');
      const filePath = `${projectDir}/${file.filename}`;
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));

      const writeCmd = `mkdir -p "${dir}" && printf '%s' '${b64}' | base64 -d > "${filePath}"`;
      const writeResult = await executeCommand(writeCmd);

      if (!writeResult.success) {
        console.error(`Error escribiendo ${file.filename}:`, writeResult.stderr);
      } else {
        console.log(`✅ Escrito: ${file.filename}`);
      }
    }

    // 4. Si no se encontraron archivos, guardar el output completo como output.md
    if (files.length === 0) {
      console.log('No se encontraron bloques de código con nombre — guardando output.md');
      const b64 = Buffer.from(tarea.output).toString('base64');
      await executeCommand(`mkdir -p "${projectDir}" && printf '%s' '${b64}' | base64 -d > "${projectDir}/output.md"`);
    }

    // 5. Git add + commit + push
    const commitMsg = `feat: agente (tarea ${tarea_id.substring(0, 8)}) - ${files.length} archivo(s)`;
    const gitCmd = [
      `cd "${projectDir}"`,
      `git add -A`,
      `git diff --staged --quiet && echo "NO_CHANGES" || git commit -m "${commitMsg}"`,
      `git push origin main 2>&1 || git push origin master 2>&1`,
    ].join(' && ');

    const result = await executeCommand(gitCmd);
    console.log('Git stdout:', result.stdout);
    if (result.stderr) console.log('Git stderr:', result.stderr);

    if (result.stdout.includes('NO_CHANGES')) {
      return res.json({ success: true, message: 'No hay cambios nuevos para deployar' });
    }

    // 6. Marcar como deployed en Supabase
    await supabase
      .from('agente_tareas')
      .update({ metadata: { deployed: true, deployed_at: new Date().toISOString(), files_deployed: files.length } })
      .eq('id', tarea_id);

    await supabase.from('logs').insert({
      nivel: 'info',
      fuente: 'deploy',
      mensaje: `Deploy completado: ${files.length} archivo(s) en ${proyecto.nombre}`,
      metadata: { proyecto_id, tarea_id, files: files.map(f => f.filename) }
    });

    res.json({
      success: true,
      message: `Deploy completado: ${files.length} archivo(s) pusheados a GitHub`,
      files: files.map(f => f.filename),
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
      deployed_at: tarea?.metadata?.deployed_at || null,
      files_deployed: tarea?.metadata?.files_deployed || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando status' });
  }
});
