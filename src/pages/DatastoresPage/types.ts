import type { Datastore as DatastoreType } from '@/types';

export type ExtendedDatastore = DatastoreType & {
  agent_datastores?: Array<{ agent_id: string }>;
};

export interface DatastoreFormData extends Partial<ExtendedDatastore> {
  config: Record<string, any>;
  similarity_threshold: number;
  max_results: number;
}
