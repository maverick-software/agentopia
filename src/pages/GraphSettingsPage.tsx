import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AccountGraphRow {
  id: string;
  user_id: string;
  provider: string;
  status: 'active' | 'disabled' | 'error';
  settings: any;
  created_at: string;
  updated_at: string;
}

export function GraphSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<AccountGraphRow | null>(null);
  const [metrics, setMetrics] = useState<{
    nodes: string | number;
    edges: string | number;
    contradictions: string | number;
    avg_confidence: string | number;
    queue_depth: string | number;
    last_sync: string | number;
  }>({ nodes: '-', edges: '-', contradictions: '-', avg_confidence: '-', queue_depth: '-', last_sync: '-' });

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const { data, error } = await supabase
          .from('account_graphs')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        let g = data || null;
        // Auto-initialize account graph if user has an active GetZep connection
        if (!g && user?.id) {
          const { data: conns } = await supabase
            .from('user_integration_credentials')
            .select('id, connection_metadata, connection_status, service_providers:oauth_provider_id ( name )')
            .eq('user_id', user.id);
          const getzep = (conns || []).find((c: any) => (c?.service_providers?.name || '').toLowerCase() === 'getzep' && c.connection_status === 'active');
          if (getzep) {
            const settings: any = {};
            if (getzep.connection_metadata?.project_id) settings.project_id = getzep.connection_metadata.project_id;
            if (getzep.connection_metadata?.account_id) settings.account_id = getzep.connection_metadata.account_id;
            const { data: created } = await supabase
              .from('account_graphs')
              .insert({ user_id: user.id, provider: 'getzep', connection_id: getzep.id, settings, status: 'active' })
              .select('*')
              .single();
            g = created || null;
          }
        }
        setGraph(g);
        if (data?.id) {
          // Fetch metrics in parallel
          const [nodesRes, edgesRes, contradictRes, avgConfRes, queueRes, lastSyncRes] = await Promise.all([
            supabase.from('graph_nodes').select('id', { count: 'exact', head: true }).eq('account_graph_id', data.id),
            supabase.from('graph_edges').select('id', { count: 'exact', head: true }).eq('account_graph_id', data.id),
            supabase.from('graph_edges').select('id', { count: 'exact', head: true }).eq('account_graph_id', data.id).eq('kind', 'contradicts'),
            supabase.from('graph_nodes').select('confidence').eq('account_graph_id', data.id),
            supabase.from('graph_ingestion_queue').select('id', { count: 'exact', head: true }).eq('account_graph_id', data.id).eq('status', 'queued'),
            supabase.from('graph_nodes').select('updated_at').eq('account_graph_id', data.id).order('updated_at', { ascending: false }).limit(1)
          ]);

          const nodeCount = (nodesRes as any)?.count ?? '-';
          const edgeCount = (edgesRes as any)?.count ?? '-';
          const contradictCount = (contradictRes as any)?.count ?? '-';
          const queueCount = (queueRes as any)?.count ?? '-';
          const avgConfidence = Array.isArray(avgConfRes.data) && avgConfRes.data.length > 0
            ? (avgConfRes.data.reduce((acc: number, r: any) => acc + (Number(r.confidence) || 0), 0) / avgConfRes.data.length).toFixed(2)
            : '-';
          const lastSync = Array.isArray(lastSyncRes.data) && lastSyncRes.data.length > 0
            ? new Date(lastSyncRes.data[0].updated_at).toLocaleString()
            : '-';

          setMetrics({
            nodes: nodeCount,
            edges: edgeCount,
            contradictions: contradictCount,
            avg_confidence: avgConfidence,
            queue_depth: queueCount,
            last_sync: lastSync,
          });
        } else {
          setMetrics({ nodes: '-', edges: '-', contradictions: '-', avg_confidence: '-', queue_depth: '-', last_sync: '-' });
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load graph');
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Knowledge Graph</h2>
        <p className="text-sm text-muted-foreground">Account-wide knowledge graph for concepts, conclusions, entities, and relationships.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Status</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : graph ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Provider</div>
              <div className="font-medium">{graph.provider}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div className={graph.status === 'active' ? 'text-green-600 dark:text-green-400 font-medium' : graph.status === 'error' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-foreground font-medium'}>
                {graph.status}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Created</div>
              <div className="font-medium">{new Date(graph.created_at).toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No knowledge graph configured yet. Connect GetZep in Integrations.</div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Metrics (preview)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Metric label="Nodes" value={metrics.nodes} />
          <Metric label="Edges" value={metrics.edges} />
          <Metric label="Contradictions" value={metrics.contradictions} />
          <Metric label="Avg. Confidence" value={metrics.avg_confidence} />
          <Metric label="Queue Depth" value={metrics.queue_depth} />
          <Metric label="Last Sync" value={metrics.last_sync} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Visualization</h3>
        <p className="text-sm text-muted-foreground mb-3">A lightweight graph preview can be added here (lazy-loaded) with filters for type and confidence.</p>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-60" disabled>
          Preview Graph (coming soon)
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default GraphSettingsPage;


