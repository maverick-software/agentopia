import Dockerode from 'dockerode';
import * as streamModule from 'stream'; // Needed for stream manipulation, aliased to avoid conflict

// Initialize Dockerode
// By default, it connects to the Docker socket at /var/run/docker.sock
// Ensure the DTMA process has permissions to access the Docker socket.
const docker = new Dockerode();

/**
 * Pulls a Docker image from a registry.
 * @param imageName - The name of the image to pull (e.g., 'ubuntu:latest', 'org/tool:1.0').
 * @returns Promise<void>
 * @throws {Error} If pulling fails.
 */
export async function pullImage(imageName: string): Promise<void> {
  console.log(`Attempting to pull image: ${imageName}...`);
  
  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err: Error, streamInstance: streamModule.Readable) => {
      if (err) {
        console.error(`Error pulling image ${imageName}:`, err);
        return reject(err);
      }
      
      // Optional: Pipe the pull progress stream to the console
      // streamInstance.pipe(process.stdout);
      
      docker.modem.followProgress(streamInstance, (err: Error | null, output: any[]) => { // `output` type might be more specific
        if (err) {
          console.error(`Error during image pull progress for ${imageName}:`, err);
          return reject(err);
        }
        // `output` contains the final progress messages. 
        // We can check the last message for success/failure indication if needed.
        console.log(`Image pull finished for ${imageName}. Final status:`, output?.[output.length - 1]?.status);
        // Assuming pull succeeds if followProgress completes without error
        resolve();
      });

      streamInstance.on('error', (streamErr: Error) => {
          console.error(`Error in image pull stream for ${imageName}:`, streamErr);
          reject(streamErr);
      });
      
      // Pipe to null stream to consume data if not piping to stdout
      if (!process.stdout.isTTY) { // Simple check if we're piping progress
         streamInstance.pipe(new streamModule.Writable({ write: (chunk, encoding, next) => next() }));
      }
    });
  });
}

/**
 * Creates and starts a Docker container.
 * @param imageName - The image to use.
 * @param containerName - A unique name for the container.
 * @param options - Dockerode create options (e.g., Env, HostConfig.PortBindings).
 * @returns Promise<Dockerode.Container>
 * @throws {Error} If creation or start fails.
 */
export async function createAndStartContainer(
  imageName: string,
  containerName: string,
  options: Dockerode.ContainerCreateOptions
): Promise<Dockerode.Container> {
  console.log(`Creating container "${containerName}" from image "${imageName}"...`);
  try {
    // Ensure options has a Name property
    const createOptions: Dockerode.ContainerCreateOptions = {
      ...options,
      name: containerName,
      Image: imageName, // Ensure Image is set
    };

    const container = await docker.createContainer(createOptions);
    console.log(`Container "${containerName}" (ID: ${container.id}) created. Starting...`);
    await container.start();
    console.log(`Container "${containerName}" started.`);
    return container;
  } catch (error) {
    console.error(`Error creating or starting container "${containerName}":`, error);
    throw error;
  }
}

/**
 * Stops a running Docker container.
 * @param containerIdOrName - The ID or name of the container to stop.
 * @returns Promise<void>
 * @throws {Error} If stopping fails.
 */
export async function stopContainer(containerIdOrName: string): Promise<void> {
  console.log(`Attempting to stop container "${containerIdOrName}"...`);
  try {
    const container = docker.getContainer(containerIdOrName);
    await container.stop();
    console.log(`Container "${containerIdOrName}" stopped.`);
  } catch (error) {
    // Handle "container not found" specifically? Dockerode might throw 404 error.
    console.error(`Error stopping container "${containerIdOrName}":`, error);
    throw error;
  }
}

/**
 * Removes a Docker container.
 * @param containerIdOrName - The ID or name of the container to remove.
 * @param force - Whether to force remove a running container (default: false).
 * @returns Promise<void>
 * @throws {Error} If removal fails.
 */
export async function removeContainer(containerIdOrName: string, force: boolean = false): Promise<void> {
  console.log(`Attempting to remove container "${containerIdOrName}"...`);
  try {
    const container = docker.getContainer(containerIdOrName);
    await container.remove({ force });
    console.log(`Container "${containerIdOrName}" removed.`);
  } catch (error) {
    // Handle "container not found" specifically?
    console.error(`Error removing container "${containerIdOrName}":`, error);
    throw error;
  }
}

/**
 * Gets information about a specific container.
 * @param containerIdOrName - The ID or name of the container.
 * @returns Promise<Dockerode.ContainerInspectInfo>
 * @throws {Error} If inspection fails (e.g., container not found).
 */
export async function inspectContainer(containerIdOrName: string): Promise<Dockerode.ContainerInspectInfo> {
    console.log(`Inspecting container "${containerIdOrName}"...`);
    try {
        const container = docker.getContainer(containerIdOrName);
        const inspectInfo = await container.inspect();
        return inspectInfo;
    } catch (error) {
        console.error(`Error inspecting container "${containerIdOrName}":`, error);
        throw error;
    }
}

/**
 * Lists containers, optionally filtering.
 * @param all - Show all containers (default: false, only running).
 * @param filters - Optional filters (e.g., { name: [containerName] }).
 * @returns Promise<Dockerode.ContainerInfo[]>
 */
export async function listContainers(all: boolean = false, filters?: object): Promise<Dockerode.ContainerInfo[]> {
  console.log(`Listing containers (all=${all}, filters=${JSON.stringify(filters)})...`);
  try {
    const containers = await docker.listContainers({ all, filters });
    return containers;
  } catch (error) {
    console.error('Error listing containers:', error);
    throw error;
  }
}

/**
 * Executes a command in a running Docker container.
 * @param containerIdOrName - The ID or name of the container.
 * @param command - The command and its arguments (e.g., ['echo', 'hello world']).
 * @param envVars - Optional environment variables for this specific execution (e.g., ['VAR_NAME=value']).
 * @returns Promise<string> - The output stream from the command execution.
 * @throws {Error} If execution fails.
 */
export async function executeInContainer(
  containerIdOrName: string,
  command: string[],
  envVars?: string[]
): Promise<string> {
  console.log(`Executing command in container "${containerIdOrName}": ${command.join(' ')}`);
  try {
    const container = docker.getContainer(containerIdOrName);
    const execOptions: Dockerode.ExecCreateOptions = {
      Cmd: command,
      Env: envVars,
      AttachStdout: true,
      AttachStderr: true,
    };

    const exec = await container.exec(execOptions);

    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err: Error | null, stream: NodeJS.ReadWriteStream | undefined) => {
        if (err) {
          console.error(`Error starting exec in container "${containerIdOrName}":`, err);
          return reject(err);
        }

        if (!stream) {
            console.error('No stream returned from exec.start');
            return reject(new Error('No stream returned from exec.start for container ' + containerIdOrName));
        }

        let output = '';
        let errorOutput = '';

        // Demultiplex the stream (Docker sends stdout and stderr multiplexed)
        const stdout = new streamModule.PassThrough();
        const stderr = new streamModule.PassThrough();
        container.modem.demuxStream(stream, stdout, stderr);

        stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf8');
        });

        stderr.on('data', (chunk: Buffer) => {
          errorOutput += chunk.toString('utf8');
        });

        stream.on('end', async () => {
          try {
            const inspectResult = await exec.inspect();
            if (inspectResult.ExitCode !== 0) {
              console.error(
                `Command in container "${containerIdOrName}" exited with code ${inspectResult.ExitCode}: ${errorOutput || output}`
              );
              return reject(
                new Error(
                  `Command exited with code ${inspectResult.ExitCode}: ${errorOutput || output}`
                )
              );
            }
            resolve(output);
          } catch (inspectError) {
            console.error('Error inspecting exec results:', inspectError);
            reject(inspectError);
          }
        });

        stream.on('error', (streamErr: Error) => {
            console.error(`Error during command execution stream for "${containerIdOrName}":`, streamErr);
            reject(streamErr);
        });
      });
    });
  } catch (error) {
    console.error(`Error executing command in container "${containerIdOrName}":`, error);
    throw error;
  }
} 