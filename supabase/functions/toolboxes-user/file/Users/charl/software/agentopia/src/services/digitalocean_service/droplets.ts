import { getDOClient } from './client.ts';
import { callWithRetry } from './utils.ts';
import { DigitalOceanServiceError } from './errors.ts';
/**
 * Creates a new DigitalOcean Droplet.
 * @param options - Configuration options for the new droplet.
 * @returns {Promise<Droplet>} The created droplet object from DigitalOcean.
 * @throws {Error} If droplet creation fails.
 */ export async function createDigitalOceanDroplet(options) {
  const createRequest = {
    names: [
      options.name
    ],
    region: options.region,
    size: options.size,
    image: options.image,
    ssh_keys: options.ssh_keys,
    backups: options.backups,
    ipv6: options.ipv6,
    user_data: options.user_data,
    monitoring: options.monitoring,
    tags: options.tags,
    vpc_uuid: options.vpc_uuid,
    with_droplet_agent: options.with_droplet_agent
  };
  // Wrap the API call with retry logic
  const response = await callWithRetry(async ()=>{
    const doClient = await getDOClient();
    // Using createDroplets which expects names as an array
    return doClient.droplet.createDroplets(createRequest);
  });
  // Updated response parsing logic - createDroplets returns array of droplets
  if (Array.isArray(response.droplets) && response.droplets.length > 0) {
    return response.droplets[0];
  }
  if (response.droplet) {
    return response.droplet;
  }
  console.error("Unexpected response structure from createDroplets:", response);
  // Throw specific error if parsing fails after successful call
  throw new DigitalOceanServiceError('Failed to parse create droplet response: Unexpected API response format.');
}
/**
 * Retrieves details for a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to retrieve.
 * @returns {Promise<Droplet>} The droplet object.
 * @throws {Error} If retrieval fails.
 */ export async function getDigitalOceanDroplet(dropletId) {
  const response = await callWithRetry(async ()=>{
    const doClient = await getDOClient();
    return doClient.droplet.getDroplet({
      droplet_id: dropletId
    });
  });
  if (response?.droplet) {
    return response.droplet;
  }
  throw new DigitalOceanServiceError('Failed to parse get droplet response: Unexpected API response format.');
}
/**
 * Deletes a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to delete.
 * @returns {Promise<void>} A promise that resolves when deletion is initiated.
 * @throws {Error} If deletion fails.
 */ export async function deleteDigitalOceanDroplet(dropletId) {
  // deleteDroplet might return void or an Action object depending on API/wrapper.
  // callWithRetry handles errors. If it completes successfully, assume initiated.
  await callWithRetry(async ()=>{
    const doClient = await getDOClient();
    // If deleteDroplet returns something (like an action), it will be ignored here.
    // Consider logging the response if needed.
    await doClient.droplet.deleteDroplet({
      droplet_id: dropletId
    });
  });
  console.info(`Deletion initiated via API for DigitalOcean droplet ID '${dropletId}'.`);
}
/**
 * Lists DigitalOcean Droplets by a specific tag.
 * @param tagName - The tag to filter droplets by.
 * @returns {Promise<Droplet[]>} An array of droplet objects.
 * @throws {Error} If listing fails.
 */ export async function listDigitalOceanDropletsByTag(tagName) {
  const response = await callWithRetry(async ()=>{
    const doClient = await getDOClient();
    return doClient.droplet.listDroplets({
      tag_name: tagName
    });
  });
  if (response?.droplets) {
    return response.droplets;
  }
  throw new DigitalOceanServiceError('Failed to parse list droplets response: Unexpected API response format.');
}
/**
 * Resizes a DigitalOcean Droplet.
 * This action initiates a resize. For non-SSD droplets, this involves a power-cycle.
 * For SSD droplets, this is usually a live resize for CPU/RAM, but disk resizes require a power-cycle.
 * This function will initiate the action. Monitoring the action's completion would be separate.
 * @param dropletId - The ID of the droplet to resize.
 * @param newSizeSlug - The new size slug for the droplet.
 * @returns {Promise<Action>} The action object from DigitalOcean.
 * @throws {Error} If initiating the resize action fails.
 */ export async function resizeDigitalOceanDroplet(dropletId, newSizeSlug) {
  const response = await callWithRetry(async ()=>{
    const doClient = await getDOClient();
    // Assuming the method is directly on droplet and it returns an object with an action property
    return doClient.droplet.resizeDroplet({
      droplet_id: dropletId,
      size: newSizeSlug
    });
  });
  if (response?.action) {
    return response.action;
  }
  // Fallback if the response itself is the Action object (less common for this wrapper based on other calls)
  if (response && typeof response.id === 'number' && typeof response.status === 'string') {
    return response;
  }
  throw new DigitalOceanServiceError('Failed to parse resize droplet response: Unexpected API response format.');
}
