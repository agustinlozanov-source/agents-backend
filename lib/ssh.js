import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

let isConnected = false;

export async function connectVPS() {
  console.log('⚠️ SSH disabled for testing');
  return null;
}

export async function executeCommand(command) {
  const connection = await connectVPS();
  
  try {
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
  const connection = await connectVPS();
  
  try {
    const result = await connection.execCommand(`cat ${path}`);
    
    if (result.code === 0) {
      return result.stdout;
    } else {
      throw new Error(`File not found or inaccessible: ${path}`);
    }
  } catch (error) {
    console.error('Read file error:', error);
    throw error;
  }
}

export async function listDirectory(path) {
  const connection = await connectVPS();
  
  try {
    const result = await connection.execCommand(`ls -la ${path}`);
    
    if (result.code === 0) {
      return result.stdout;
    } else {
      throw new Error(`Directory not found: ${path}`);
    }
  } catch (error) {
    console.error('List directory error:', error);
    throw error;
  }
}

export async function checkConnection() {
  try {
    await connectVPS();
    const result = await executeCommand('echo "connection test"');
    return result.success;
  } catch {
    return false;
  }
}

// Cleanup on process exit
process.on('SIGINT', () => {
  if (isConnected) {
    ssh.dispose();
    console.log('SSH connection closed');
  }
  process.exit(0);
});
