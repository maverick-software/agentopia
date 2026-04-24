import React, { useEffect, useState } from 'react';
import { Loader2, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';

interface DatastoreRow {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export function GraphSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datastores, setDatastores] = useState<DatastoreRow[]>([]);

  useEffect(() => {
    const loadPineconeDatastores = async () => {
      if (!user?.id) {
        setDatastores([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('datastores')
          .select('id, name, description, updated_at')
          .eq('user_id', user.id)
          .eq('type', 'pinecone')
          .order('updated_at', { ascending: false });

        if (fetchError) throw fetchError;
        setDatastores(data || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load datastores');
      } finally {
        setLoading(false);
      }
    };

    void loadPineconeDatastores();
  }, [user?.id]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Knowledge Settings</h2>
        <p className="text-sm text-muted-foreground">
          Vector memory uses Pinecone datastores only.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Pinecone Datastores</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : datastores.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No Pinecone datastores configured yet.</p>
            <Button asChild>
              <Link to="/datastores">Create Pinecone Datastore</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {datastores.map((datastore) => (
              <div key={datastore.id} className="rounded-lg border border-border/60 p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-blue-500" />
                  {datastore.name}
                </div>
                {datastore.description ? (
                  <p className="text-xs text-muted-foreground mt-1">{datastore.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(datastore.updated_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GraphSettingsPage;


