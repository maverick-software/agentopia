import { Database, Plus, RefreshCw } from 'lucide-react';
import { DatastoreCard } from './components/DatastoreCard';
import { DatastoreForm } from './components/DatastoreForm';
import { DeleteDatastoreDialog } from './components/DeleteDatastoreDialog';
import { useDatastores } from './hooks/useDatastores';

export function DatastoresPage() {
  const {
    user,
    datastores,
    loading,
    error,
    showDeleteConfirm,
    isDeleting,
    showCreateModal,
    editingDatastore,
    isSaving,
    setShowCreateModal,
    setEditingDatastore,
    setShowDeleteConfirm,
    fetchDatastores,
    handleDelete,
    handleCreateOrUpdate,
  } = useDatastores();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to manage datastores.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Datastores</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Datastore
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => void fetchDatastores(true)}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-md transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading && error.includes('Retrying') ? 'animate-spin' : ''}`} />
            {loading && error.includes('Retrying') ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                  <div className="space-x-2 flex">
                    <div className="w-8 h-8 bg-muted rounded"></div>
                    <div className="w-8 h-8 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : datastores.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-lg p-8 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No datastores found. Create your first datastore to get started!</p>
          </div>
        ) : (
          datastores.map((datastore) => (
            <DatastoreCard
              key={datastore.id}
              datastore={datastore}
              onEdit={setEditingDatastore}
              onDelete={(id) => setShowDeleteConfirm(id)}
            />
          ))
        )}
      </div>

      <DeleteDatastoreDialog
        datastoreId={showDeleteConfirm}
        isDeleting={isDeleting}
        onCancel={() => setShowDeleteConfirm(null)}
        onConfirm={(id) => void handleDelete(id)}
      />

      {(showCreateModal || editingDatastore) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 z-50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DatastoreForm
              datastore={editingDatastore}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setShowCreateModal(false);
                setEditingDatastore(null);
              }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
