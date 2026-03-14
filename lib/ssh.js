import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
let isConnected = false;
let connectionPromise = null;

export async function connectVPS() {
  // Si ya está conectado, retornar
  if (isConnected) return ssh;
  
  // Si hay una conexión en progreso, esperar
  if (connectionPromise) return connectionPromise;

  // Crear nueva conexión
  connectionPromise = (async () => {
    try {
      await ssh.connect({
        host: process.env.VPS_HOST,
        username: process.env.VPS_USER,
        password: process.env.VPS_PASSWORD,
        privateKey: process.env.VPS_SSH_KEY ? process.env.VPS_SSH_KEY.replace(/\\n/g, '\n') : undefined,
        port: process.env.VPS_PORT ? parseInt(process.env.VPS_PORT, 10) : 22,
        readyTimeout: 60000, // 60 segundos
        keepaliveInterval: 10000,
        keepaliveCountMax: 10,
        debug: (msg) => console.log('SSH DEBUG:', msg)
      });

      isConnected = true;
      console.log('✅ Connected to VPS');
      return ssh;
    } catch (error) {
      console.error('❌ VPS connection failed:', error.message);
      connectionPromise = null; // Reset para retry
      throw new Error('Failed to connect to VPS: ' + error.message);
    }
  })();

  return connectionPromise;
}

export async function executeCommand(command) {
  try {
    const connection = await connectVPS();
    
    const result = await connection.execCommand(command, {
      cwd: '/root/agente_ia'
    });

    return {
      success: result.code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    };
  } catch (error) {
    console.error('Command execution error:', error);
    throw error;
  }
}

export async function readFile(path) {
  try {
    const connection = await connectVPS();
    const result = await connection.execCommand(`cat ${path}`);
    
    if (result.code === 0) {
      return result.stdout;
    } else {
      throw new Error(`File not found: ${path}`);
    }
  } catch (error) {
    throw error;
  }
}

export async function listDirectory(path) {
  try {
    const connection = await connectVPS();
    const result = await connection.execCommand(`ls -la ${path}`);
    
    if (result.code === 0) {
      return result.stdout;
    } else {
      throw new Error(`Directory not found: ${path}`);
    }
  } catch (error) {
    throw error;
  }
}

export async function checkConnection() {
  try {
    await connectVPS();
    return true;
  } catch {
    return false;
  }
}

process.on('SIGINT', () => {
  if (isConnected) {
    ssh.dispose();
  }
  process.exit(0);
});
