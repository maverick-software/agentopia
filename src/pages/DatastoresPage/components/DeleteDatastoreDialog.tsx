interface DeleteDatastoreDialogProps {
  datastoreId: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

export function DeleteDatastoreDialog({ datastoreId, isDeleting, onCancel, onConfirm }: DeleteDatastoreDialogProps) {
  if (!datastoreId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Delete Datastore</h2>
        <p className="text-foreground mb-6">Are you sure you want to delete this datastore? This action cannot be undone.</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(datastoreId)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
