// src/lib/services/intelligentDropletSelector.ts
// Intelligent droplet selection service for optimal MCP server deployment

import { supabase } from '../supabase';

export interface ResourceRequirements {
  cpu: 'light' | 'medium' | 'heavy';
  memory: 'light' | 'medium' | 'heavy';
  network: 'low' | 'medium' | 'high';
  storage: 'minimal' | 'standard' | 'large';
  expectedLoad: 'development' | 'production' | 'enterprise';
}

export interface DropletScore {
  dropletId: string;
  score: number;
  reasoning: string;
  currentLoad: number;
  availableResources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  costEfficiency: number;
  geographicOptimization: number;
}

export interface AutoProvisionRecommendation {
  shouldAutoProvision: boolean;
  recommendedSize: string;
  recommendedRegion: string;
  estimatedCost: number;
  reasoning: string;
}

export interface DropletSelectionResult {
  selectedDropletId?: string;
  autoProvisionRecommendation?: AutoProvisionRecommendation;
  allScores: DropletScore[];
  selectionReasoning: string;
}

export class IntelligentDropletSelector {
  constructor() {
    // No external dependencies needed - we use Supabase for all data
  }

  /**
   * Select optimal droplet for MCP deployment with intelligent scoring
   */
  async selectOptimalDroplet(
    userId: string, 
    requirements: ResourceRequirements
  ): Promise<DropletSelectionResult> {
    try {
      // 1. Get user's active droplets
      const userDroplets = await this.getUserActiveDroplets(userId);
      
      if (userDroplets.length === 0) {
        return {
          autoProvisionRecommendation: await this.generateAutoProvisionRecommendation(requirements),
          allScores: [],
          selectionReasoning: 'No existing droplets found - auto-provisioning recommended'
        };
      }

      // 2. Calculate scores for each droplet
      const dropletScores = await Promise.all(
        userDroplets.map(droplet => this.calculateDropletScore(droplet, requirements))
      );

      // 3. Sort by score (highest first)
      dropletScores.sort((a, b) => b.score - a.score);

      // 4. Determine if we should auto-provision instead
      const bestScore = dropletScores[0]?.score || 0;
      const shouldAutoProvision = bestScore < 0.6; // Below 60% optimal

      if (shouldAutoProvision) {
        return {
          autoProvisionRecommendation: await this.generateAutoProvisionRecommendation(requirements),
          allScores: dropletScores,
          selectionReasoning: `Best existing droplet scored ${(bestScore * 100).toFixed(0)}% - auto-provisioning recommended for optimal performance`
        };
      }

      return {
        selectedDropletId: dropletScores[0].dropletId,
        allScores: dropletScores,
        selectionReasoning: `Selected droplet with ${(bestScore * 100).toFixed(0)}% optimization score`
      };

    } catch (error) {
      console.error('Error in intelligent droplet selection:', error);
      throw new Error(`Failed to select optimal droplet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate optimization score for a droplet
   * Scoring factors: Resource availability (40%), Current load (25%), Geographic optimization (20%), Cost efficiency (15%)
   */
  private async calculateDropletScore(
    droplet: any, 
    requirements: ResourceRequirements
  ): Promise<DropletScore> {
    try {
      // Get current resource utilization
      const currentLoad = await this.getCurrentResourceLoad(droplet);
      
      // Calculate individual factor scores
      const resourceScore = this.calculateResourceAvailabilityScore(droplet, requirements, currentLoad);
      const loadScore = this.calculateCurrentLoadScore(currentLoad);
      const geoScore = await this.calculateGeographicScore(droplet);
      const costScore = this.calculateCostEfficiencyScore(droplet, requirements);

      // Weighted final score
      const finalScore = (
        resourceScore * 0.40 +
        loadScore * 0.25 +
        geoScore * 0.20 +
        costScore * 0.15
      );

      return {
        dropletId: droplet.id,
        score: Math.max(0, Math.min(1, finalScore)), // Clamp between 0-1
        reasoning: this.generateScoreReasoning(resourceScore, loadScore, geoScore, costScore),
        currentLoad: currentLoad.overall,
        availableResources: {
          cpu: Math.max(0, 100 - currentLoad.cpu),
          memory: Math.max(0, 100 - currentLoad.memory),
          storage: Math.max(0, 100 - currentLoad.storage)
        },
        costEfficiency: costScore,
        geographicOptimization: geoScore
      };

    } catch (error) {
      console.error(`Error calculating score for droplet ${droplet.id}:`, error);
      return {
        dropletId: droplet.id,
        score: 0,
        reasoning: 'Error calculating score - excluded from selection',
        currentLoad: 100,
        availableResources: { cpu: 0, memory: 0, storage: 0 },
        costEfficiency: 0,
        geographicOptimization: 0
      };
    }
  }

  /**
   * Get user's active droplets with resource information
   */
  private async getUserActiveDroplets(userId: string) {
    const { data: environments, error } = await supabase
      .from('account_tool_environments')
      .select(`
        id,
        environment_name,
        public_ip_address,
        region_slug,
        size_slug,
        status_on_toolbox,
        created_at,
        do_droplet_id
      `)
      .eq('user_id', userId)
      .eq('status_on_toolbox', 'active')
      .not('do_droplet_id', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch user droplets: ${error.message}`);
    }

    return environments || [];
  }

  /**
   * Get current resource utilization for a droplet
   */
  private async getCurrentResourceLoad(droplet: any) {
    try {
      // Get running tool instances on this droplet
      const { data: instances, error } = await supabase
        .from('account_tool_instances')
        .select('instance_name_on_toolbox, base_config_override_json')
        .eq('account_tool_environment_id', droplet.id)
        .eq('status_on_toolbox', 'active');

      if (error) {
        console.warn(`Failed to get instances for droplet ${droplet.id}:`, error);
        return { overall: 0, cpu: 0, memory: 0, storage: 0, instances: 0 };
      }

      const instanceCount = instances?.length || 0;
      
      // Estimate resource usage based on instance count and droplet size
      const sizeMultiplier = this.getSizeMultiplier(droplet.size_slug);
      const estimatedLoad = Math.min(95, (instanceCount / sizeMultiplier) * 100);

      return {
        overall: estimatedLoad,
        cpu: estimatedLoad,
        memory: estimatedLoad * 0.8, // Memory typically lower than CPU
        storage: estimatedLoad * 0.6, // Storage typically lower
        instances: instanceCount
      };

    } catch (error) {
      console.warn(`Error getting resource load for droplet ${droplet.id}:`, error);
      return { overall: 50, cpu: 50, memory: 50, storage: 50, instances: 0 }; // Conservative estimate
    }
  }

  /**
   * Calculate resource availability score (0-1)
   */
  private calculateResourceAvailabilityScore(
    droplet: any, 
    requirements: ResourceRequirements, 
    currentLoad: any
  ): number {
    const sizeMultiplier = this.getSizeMultiplier(droplet.size_slug);
    const requirementMultiplier = this.getRequirementMultiplier(requirements);
    
    // Check if droplet can handle the requirement
    const canHandle = sizeMultiplier >= requirementMultiplier;
    if (!canHandle) return 0;
    
    // Calculate available capacity
    const availableCapacity = Math.max(0, 100 - currentLoad.overall);
    const requiredCapacity = requirementMultiplier * 20; // Base 20% per requirement level
    
    if (availableCapacity < requiredCapacity) return 0.2; // Can handle but tight
    
    // Score based on excess capacity
    const excessCapacity = availableCapacity - requiredCapacity;
    return Math.min(1, 0.6 + (excessCapacity / 100) * 0.4);
  }

  /**
   * Calculate current load score (lower load = higher score)
   */
  private calculateCurrentLoadScore(currentLoad: any): number {
    return Math.max(0, (100 - currentLoad.overall) / 100);
  }

  /**
   * Calculate geographic optimization score
   */
  private async calculateGeographicScore(droplet: any): Promise<number> {
    // Prioritize popular regions for better connectivity
    const regionPriority: { [key: string]: number } = {
      'nyc1': 0.9, 'nyc3': 0.9, 'sfo3': 0.85, 'tor1': 0.8,
      'lon1': 0.8, 'fra1': 0.8, 'sgp1': 0.75, 'blr1': 0.7
    };
    
    return regionPriority[droplet.region_slug] || 0.6;
  }

  /**
   * Calculate cost efficiency score
   */
  private calculateCostEfficiencyScore(droplet: any, requirements: ResourceRequirements): number {
    // Score based on size appropriateness for requirements
    const sizeMultiplier = this.getSizeMultiplier(droplet.size_slug);
    const requirementMultiplier = this.getRequirementMultiplier(requirements);
    
    if (sizeMultiplier < requirementMultiplier) return 0; // Undersized
    if (sizeMultiplier > requirementMultiplier * 2) return 0.5; // Oversized
    
    return 1 - Math.abs(sizeMultiplier - requirementMultiplier) / requirementMultiplier;
  }

  /**
   * Generate auto-provision recommendation
   */
  private async generateAutoProvisionRecommendation(
    requirements: ResourceRequirements
  ): Promise<AutoProvisionRecommendation> {
    const sizeRecommendation = this.getRecommendedSize(requirements);
    const regionRecommendation = 'nyc3'; // Default to NYC3 for now
    
    return {
      shouldAutoProvision: true,
      recommendedSize: sizeRecommendation,
      recommendedRegion: regionRecommendation,
      estimatedCost: this.estimateMonthlyCost(sizeRecommendation),
      reasoning: `Optimized for ${requirements.expectedLoad} workload with ${requirements.cpu} CPU and ${requirements.memory} memory requirements`
    };
  }

  /**
   * Helper methods for size and requirement calculations
   */
  private getSizeMultiplier(sizeSlug: string): number {
    const sizeMap: { [key: string]: number } = {
      's-1vcpu-1gb': 1,
      's-1vcpu-2gb': 1.5,
      's-2vcpu-2gb': 2,
      's-2vcpu-4gb': 3,
      's-4vcpu-8gb': 4,
      's-8vcpu-16gb': 6
    };
    return sizeMap[sizeSlug] || 1;
  }

  private getRequirementMultiplier(requirements: ResourceRequirements): number {
    const cpuWeight = { light: 1, medium: 2, heavy: 4 };
    const memoryWeight = { light: 1, medium: 2, heavy: 4 };
    const loadWeight = { development: 1, production: 2, enterprise: 3 };
    
    return Math.max(
      cpuWeight[requirements.cpu],
      memoryWeight[requirements.memory]
    ) * loadWeight[requirements.expectedLoad];
  }

  private getRecommendedSize(requirements: ResourceRequirements): string {
    const multiplier = this.getRequirementMultiplier(requirements);
    
    if (multiplier <= 1) return 's-1vcpu-1gb';
    if (multiplier <= 2) return 's-1vcpu-2gb';
    if (multiplier <= 3) return 's-2vcpu-4gb';
    if (multiplier <= 6) return 's-4vcpu-8gb';
    return 's-8vcpu-16gb';
  }

  private estimateMonthlyCost(sizeSlug: string): number {
    const costMap: { [key: string]: number } = {
      's-1vcpu-1gb': 6,
      's-1vcpu-2gb': 12,
      's-2vcpu-2gb': 18,
      's-2vcpu-4gb': 24,
      's-4vcpu-8gb': 48,
      's-8vcpu-16gb': 96
    };
    return costMap[sizeSlug] || 24;
  }

  private generateScoreReasoning(
    resourceScore: number,
    loadScore: number,
    geoScore: number,
    costScore: number
  ): string {
    const reasons = [];
    if (resourceScore > 0.8) reasons.push('excellent resource match');
    else if (resourceScore > 0.6) reasons.push('good resource availability');
    else reasons.push('limited resources');

    if (loadScore > 0.8) reasons.push('low current load');
    else if (loadScore > 0.6) reasons.push('moderate load');
    else reasons.push('high current load');

    if (geoScore > 0.8) reasons.push('optimal region');
    if (costScore > 0.8) reasons.push('cost-efficient');

    return reasons.join(', ');
  }
} 