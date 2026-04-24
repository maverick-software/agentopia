export interface DTMAStatus {
  status: string;
  timestamp: string;
  version: string;
  service: string;
  environment: {
    hasAuthToken: boolean;
    hasApiKey: boolean;
    hasApiBaseUrl: boolean;
    port: string;
  };
  tool_instances?: Array<{
    account_tool_instance_id: string | null;
    instance_name_on_toolbox: string;
    container_id: string;
    status: string;
    image: string;
    ports: Array<{
      ip?: string;
      private_port: number;
      public_port?: number;
      type: string;
    }>;
    created: number;
  }>;
}

export interface SystemMetrics {
  cpu_load_percent: number;
  memory: {
    total_bytes: number;
    active_bytes: number;
    free_bytes: number;
    used_bytes: number;
  };
  disk: {
    mount: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
  };
}
