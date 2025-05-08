import { getDOClient } from './client';
import {
  // DigitalOceanDroplet, // Using Droplet type from dots-wrapper directly
  CreateDropletServiceOptions,
  // CreateDropletServiceResponse, // We might return the raw Droplet object from dots-wrapper directly
} from './types';
// Attempt to import types directly from 'dots-wrapper'
import { Droplet, CreateDropletsRequest } from 'dots-wrapper'; 

/**
 * Creates a new DigitalOcean Droplet.
 * @param options - Configuration options for the new droplet.
 * @returns {Promise<Droplet>} The created droplet object from DigitalOcean.
 * @throws {Error} If droplet creation fails.
 */
export async function createDigitalOceanDroplet(
  options: CreateDropletServiceOptions
): Promise<Droplet> {
  const doClient = await getDOClient();

  // Map CreateDropletServiceOptions to dots-wrapper's CreateDropletsRequest type
  // Note: dots-wrapper might expect a single object for creating one droplet, or an array.
  // Assuming `createDroplets` takes a request object that can define one or more droplets.
  // If it's `createDroplet` for a single one, adjust accordingly.
  // The dots-wrapper type for creating multiple droplets is CreateDropletsRequest.
  // For a single droplet, it is often part of the same structure or a singular version.
  // Let's assume options match the fields needed for a single droplet within a potential plural request.

  const createRequest: CreateDropletsRequest = {
    name: options.name, // dots-wrapper might expect `names: [options.name]` if creating multiple
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
    with_droplet_agent: options.with_droplet_agent,
    // Ensure all required fields by dots-wrapper are covered
  };

  try {
    // The `dots-wrapper` might have a method like `dots.droplet.create()` or `dots.droplet.createDroplets()`
    // Assuming `createDroplets` can create a single droplet if `name` is singular and `names` is not used, 
    // or it might expect `names: [options.name]` for creating a single one as well.
    // Referencing docs for `dots-wrapper` is key here.
    // If `createDroplets` returns an array, we take the first element.
    const response = await doClient.droplet.createDroplets(createRequest);
    
    // The response structure for `createDroplets` might be an object containing a `droplets` array or a single `droplet` object.
    // Adjust based on actual `dots-wrapper` behavior.
    // If it returns an array of droplets (even for a single creation): 
    if (Array.isArray(response.droplets) && response.droplets.length > 0) {
      return response.droplets[0] as Droplet; // Cast to Droplet, assuming our type matches
    }
    // If it returns a single droplet object directly under a `droplet` key:
    if (response.droplet) {
        return response.droplet as Droplet;
    }
    // Fallback or error if the structure is unexpected
    console.error("Unexpected response structure from createDroplets:", response);
    throw new Error('Failed to create droplet: Unexpected API response format.');

  } catch (error: any) {
    console.error(`Error creating DigitalOcean droplet '${options.name}':`, error.message);
    // Enhance error logging with more details from error object if available
    throw new Error(`Failed to create DigitalOcean droplet: ${error.message}`);
  }
}

/**
 * Retrieves details for a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to retrieve.
 * @returns {Promise<Droplet>} The droplet object.
 * @throws {Error} If retrieval fails.
 */
export async function getDigitalOceanDroplet(dropletId: number): Promise<Droplet> {
  const doClient = await getDOClient();
  try {
    const response = await doClient.droplet.getDroplet({ droplet_id: dropletId });
    return response.droplet as Droplet;
  } catch (error: any) {
    console.error(`Error retrieving DigitalOcean droplet ID '${dropletId}':`, error.message);
    throw new Error(`Failed to retrieve DigitalOcean droplet: ${error.message}`);
  }
}

/**
 * Deletes a specific DigitalOcean Droplet.
 * @param dropletId - The ID of the droplet to delete.
 * @returns {Promise<void>} A promise that resolves when deletion is initiated.
 * @throws {Error} If deletion fails.
 */
export async function deleteDigitalOceanDroplet(dropletId: number): Promise<void> {
  const doClient = await getDOClient();
  try {
    await doClient.droplet.deleteDroplet({ droplet_id: dropletId });
    console.info(`Deletion initiated for DigitalOcean droplet ID '${dropletId}'.`);
  } catch (error: any) {
    console.error(`Error deleting DigitalOcean droplet ID '${dropletId}':`, error.message);
    throw new Error(`Failed to delete DigitalOcean droplet: ${error.message}`);
  }
}

/**
 * Lists DigitalOcean Droplets by a specific tag.
 * @param tagName - The tag to filter droplets by.
 * @returns {Promise<Droplet[]>} An array of droplet objects.
 * @throws {Error} If listing fails.
 */
export async function listDigitalOceanDropletsByTag(tagName: string): Promise<Droplet[]> {
  const doClient = await getDOClient();
  try {
    const response = await doClient.droplet.listDroplets({ tag_name: tagName });
    return response.droplets as Droplet[]; // Assuming dots-wrapper directly returns Droplet[] typed correctly
  } catch (error: any) {
    console.error(`Error listing DigitalOcean droplets by tag '${tagName}':`, error.message);
    throw new Error(`Failed to list DigitalOcean droplets by tag: ${error.message}`);
  }
} 