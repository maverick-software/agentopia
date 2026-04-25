import { Brain, Database, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CredentialSelector } from '@/integrations/_shared';
import type { DatastoreFormData, ExtendedDatastore } from '../types';

interface DatastoreFormProps {
  datastore?: ExtendedDatastore | null;
  onSubmit: (data: Partial<ExtendedDatastore>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Name and description' },
  { id: 2, title: 'Type Selection', description: 'Choose your platform' },
  { id: 3, title: 'Configuration', description: 'API keys and settings' },
  { id: 4, title: 'Review', description: 'Confirm and create' },
];

export function DatastoreForm({ datastore, onSubmit, onCancel, isSaving }: DatastoreFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<DatastoreFormData>({
    name: datastore?.name || '',
    description: datastore?.description || '',
    type: datastore?.type || 'pinecone',
    config: datastore?.config || {},
    similarity_threshold: (datastore as any)?.similarity_threshold ?? 0.5,
    max_results: (datastore as any)?.max_results ?? 5,
  });

  const isEditing = Boolean(datastore);
  const totalSteps = STEPS.length;

  const canProceedToStep = useMemo(() => {
    return (step: number) => {
      if (step === 2) return Boolean(formData.name?.trim());
      if (step === 3) return Boolean(formData.type);
      if (step !== 4) return true;
      if (formData.type === 'pinecone') {
        return Boolean(
          formData.config?.connectionId &&
            formData.config?.region &&
            formData.config?.host &&
            formData.config?.indexName &&
            formData.config?.dimensions,
        );
      }
      if (formData.type === 'getzep') {
        return Boolean(formData.config?.connectionId && formData.config?.projectId && formData.config?.collectionName);
      }
      return false;
    };
  }, [formData]);

  const setConfig = (patch: Record<string, any>) => {
    setFormData((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setFormError(null);
      await onSubmit(formData);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save datastore. Please try again.');
    }
  };

  return (
    <div className="bg-background/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-2xl w-full overflow-hidden">
      <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b border-border/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">{isEditing ? 'Edit Datastore' : 'Create New Datastore'}</h2>
            <p className="text-muted-foreground text-xs">
              Step {currentStep} of {totalSteps}: {STEPS[currentStep - 1].description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-all duration-200 p-1.5 rounded-full hover:bg-background/50"
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between relative">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-medium text-xs transition-all duration-300 ${
                    currentStep > step.id
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : currentStep === step.id
                        ? 'border-primary text-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                        : 'border-border text-muted-foreground bg-background'
                  }`}
                >
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-1.5 text-center">
                  <div className={`text-xs font-medium transition-colors ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors duration-300 ${currentStep > step.id ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 min-h-[300px]">
        {formError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
            </div>
            <div>
              <p className="font-medium text-xs">Configuration Error</p>
              <p className="text-xs opacity-90 mt-0.5">{formError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <div className="space-y-4 max-w-sm mx-auto">
              <div>
                <label className="text-xs font-medium text-foreground">Datastore Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full mt-2 px-3 py-2.5 bg-background/50 border border-border/50 rounded-lg text-sm"
                  placeholder="My Company Knowledge Base"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="w-full mt-2 px-3 py-2.5 bg-background/50 border border-border/50 rounded-lg resize-none text-sm"
                  placeholder="Brief description of what this datastore contains..."
                  rows={3}
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'pinecone', config: {} })}
                disabled={isSaving}
                className={`p-4 rounded-xl border-2 text-left ${formData.type === 'pinecone' ? 'border-blue-500 bg-blue-50/50' : 'border-border/50'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <h4 className="font-bold text-sm">Pinecone</h4>
                </div>
                <p className="text-xs text-muted-foreground">Vector database for semantic search and embeddings.</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'getzep', config: {} })}
                disabled={isSaving}
                className={`p-4 rounded-xl border-2 text-left ${formData.type === 'getzep' ? 'border-purple-500 bg-purple-50/50' : 'border-border/50'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <h4 className="font-bold text-sm">GetZep</h4>
                </div>
                <p className="text-xs text-muted-foreground">Knowledge graph for entities, relationships, and context.</p>
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="max-w-lg mx-auto space-y-4">
              {formData.type === 'pinecone' && (
                <>
                  <CredentialSelector
                    providerName="pinecone"
                    value={formData.config?.connectionId || ''}
                    onChange={(id) => setConfig({ connectionId: id })}
                    disabled={isSaving}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      value={formData.config?.region || ''}
                      onChange={(event) => setConfig({ region: event.target.value })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Region (e.g. us-west-2)"
                      disabled={isSaving}
                    />
                    <input
                      type="text"
                      required
                      value={formData.config?.host || ''}
                      onChange={(event) => setConfig({ host: event.target.value })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Host URL"
                      disabled={isSaving}
                    />
                    <input
                      type="text"
                      required
                      value={formData.config?.indexName || ''}
                      onChange={(event) => setConfig({ indexName: event.target.value })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Index Name"
                      disabled={isSaving}
                    />
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.config?.dimensions || ''}
                      onChange={(event) => setConfig({ dimensions: parseInt(event.target.value, 10) })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Dimensions"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.similarity_threshold}
                      onChange={(event) => setFormData({ ...formData, similarity_threshold: parseFloat(event.target.value) })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Similarity Threshold"
                      disabled={isSaving}
                    />
                    <input
                      type="number"
                      min="1"
                      value={formData.max_results}
                      onChange={(event) => setFormData({ ...formData, max_results: parseInt(event.target.value, 10) })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Max Results"
                      disabled={isSaving}
                    />
                  </div>
                </>
              )}

              {formData.type === 'getzep' && (
                <>
                  <CredentialSelector
                    providerName="getzep"
                    value={formData.config?.connectionId || ''}
                    onChange={(id) => setConfig({ connectionId: id })}
                    disabled={isSaving}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      value={formData.config?.projectId || ''}
                      onChange={(event) => setConfig({ projectId: event.target.value })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Project ID"
                      disabled={isSaving}
                    />
                    <input
                      type="text"
                      required
                      value={formData.config?.collectionName || ''}
                      onChange={(event) => setConfig({ collectionName: event.target.value })}
                      className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-sm"
                      placeholder="Collection Name"
                      disabled={isSaving}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="max-w-md mx-auto bg-gradient-to-br from-primary/5 to-primary/10 border border-border/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/20">
                <span className="text-xs text-muted-foreground">Datastore Name</span>
                <span className="text-sm font-medium">{formData.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/20">
                <span className="text-xs text-muted-foreground">Type</span>
                <span className="text-sm font-medium capitalize">{formData.type}</span>
              </div>
              {formData.type === 'pinecone' && (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-border/20">
                    <span className="text-xs text-muted-foreground">Region</span>
                    <span className="text-xs font-mono">{formData.config?.region}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/20">
                    <span className="text-xs text-muted-foreground">Index Name</span>
                    <span className="text-xs font-mono">{formData.config?.indexName}</span>
                  </div>
                </>
              )}
              {formData.type === 'getzep' && (
                <div className="flex items-center justify-between py-2 border-b border-border/20">
                  <span className="text-xs text-muted-foreground">Collection</span>
                  <span className="text-xs font-mono">{formData.config?.collectionName}</span>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      <div className="border-t border-border/20 bg-gradient-to-r from-muted/20 to-muted/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 font-medium text-xs disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSaving}
                className="px-4 py-2 border border-border text-foreground rounded-lg transition-all duration-200 font-medium text-xs disabled:opacity-50"
              >
                Previous
              </button>
            )}
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={isSaving || !canProceedToStep(currentStep + 1)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-all duration-200 font-medium text-xs disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSaving || !canProceedToStep(currentStep)}
                className="px-5 py-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg transition-all duration-200 font-medium text-xs disabled:opacity-50 flex items-center gap-1 min-w-[120px] justify-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditing ? 'Update Datastore' : 'Create Datastore'}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
