import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { MCPServerConfig, MCPServerCapabilities } from '../lib/mcp/types';

// Copied from useAgentMcp - Can potentially be shared/imported
interface TestConnectionResult {
    success: boolean;
    message: string;
    capabilities?: MCPServerCapabilities | null;
}

// Copied from useAgentMcp - Can potentially be shared/imported
const DEFAULT_NEW_SERVER_CONFIG: Partial<MCPServerConfig> = {
  name: '',
  endpoint_url: '',
  vault_api_key_id: null,
  timeout_ms: 5000,
  max_retries: 3,
  retry_backoff_ms: 1000,
  priority: 0,
  is_active: true,
};

interface McpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: Partial<MCPServerConfig>) => Promise<void>;
  onTestConnection: (serverConfig: Partial<MCPServerConfig>) => Promise<TestConnectionResult | null>;
  initialData: Partial<MCPServerConfig> | null; // Use Partial for initial data flexibility
}

export function McpServerModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onTestConnection,
  initialData 
}: McpServerModalProps) {

  const [mcpFormData, setMcpFormData] = useState<Partial<MCPServerConfig>>(DEFAULT_NEW_SERVER_CONFIG);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<TestConnectionResult | null>(null);
  const [discoveredCapabilities, setDiscoveredCapabilities] = useState<MCPServerCapabilities | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Effect to load initial data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setMcpFormData(initialData ? { ...initialData } : { ...DEFAULT_NEW_SERVER_CONFIG });
      // Reset test results when modal opens/data changes
      setTestConnectionResult(null);
      setDiscoveredCapabilities(null);
      setIsTestingConnection(false);
      setIsSaving(false);
    } else {
      // Optionally reset form when closed, although useEffect below does it
      // setMcpFormData(DEFAULT_NEW_SERVER_CONFIG);
    }
  }, [isOpen, initialData]);

  const handleMcpFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number | boolean | null = value;

    if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      parsedValue = value === '' ? '' : Number(value); // Allow empty string for number inputs temporarily
    } else if (name === 'vault_api_key_id' && value === '') {
      parsedValue = null; // Allow unsetting vault key
    }

    setMcpFormData(prev => ({ ...prev, [name]: parsedValue }));
  };
  
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestConnectionResult(null); // Clear previous result
    setDiscoveredCapabilities(null);
    try {
      const result = await onTestConnection(mcpFormData);
      setTestConnectionResult(result);
      if (result?.success && result?.capabilities) {
        setDiscoveredCapabilities(result.capabilities);
        // Optionally auto-fill parts of the form based on capabilities?
      }
    } catch (err) {
        // Error handling might be done within onTestConnection, 
        // but catch here for safety
        console.error("Modal: Error during test connection:", err);
        setTestConnectionResult({ success: false, message: "An unexpected error occurred during testing." });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
       // Simple validation placeholder
       if (!mcpFormData.name || !mcpFormData.endpoint_url) {
           alert("Server Name and Endpoint URL are required.");
           setIsSaving(false);
           return;
       }
       await onSave(mcpFormData);
       // onClose(); // Let the parent handle closing after successful save (already done in AgentMcpSection)
    } catch (err) {
        console.error("Modal: Error during save:", err);
        // Display error to user?
        alert("Failed to save server configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Calculate modal title
  const modalTitle = initialData?.id ? 'Edit MCP Server' : 'Add MCP Server';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white disabled:opacity-50"
            disabled={isSaving || isTestingConnection}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Server Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={mcpFormData.name || ''}
              onChange={handleMcpFormChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="My Custom Logic Server"
              required
            />
          </div>
          
          {/* Endpoint URL */}
          <div>
            <label htmlFor="endpoint_url" className="block text-sm font-medium text-gray-300 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              id="endpoint_url"
              name="endpoint_url"
              value={mcpFormData.endpoint_url || ''}
              onChange={handleMcpFormChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://your-mcp-server.example.com/mcp"
              required
            />
          </div>

          {/* API Key Vault ID - Consider making this a dropdown/selector if Vault integration exists */}
          <div>
            <label htmlFor="vault_api_key_id" className="block text-sm font-medium text-gray-300 mb-1">
              API Key (Vault Secret ID)
            </label>
            <input
              type="text" 
              id="vault_api_key_id"
              name="vault_api_key_id"
              value={mcpFormData.vault_api_key_id || ''}
              onChange={handleMcpFormChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="(Optional) UUID of the API key secret in Vault"
            />
          </div>
          
          {/* Row for Timeout, Retries, Backoff */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeout_ms" className="block text-sm font-medium text-gray-300 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                id="timeout_ms"
                name="timeout_ms"
                value={mcpFormData.timeout_ms ?? ''} // Use ?? to handle potential null/undefined
                onChange={handleMcpFormChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="max_retries" className="block text-sm font-medium text-gray-300 mb-1">
                Max Retries
              </label>
              <input
                type="number"
                id="max_retries"
                name="max_retries"
                value={mcpFormData.max_retries ?? ''}
                onChange={handleMcpFormChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="0"
                step="1"
              />
            </div>
             <div>
              <label htmlFor="retry_backoff_ms" className="block text-sm font-medium text-gray-300 mb-1">
                Retry Backoff (ms)
              </label>
              <input
                type="number"
                id="retry_backoff_ms"
                name="retry_backoff_ms"
                value={mcpFormData.retry_backoff_ms ?? ''}
                onChange={handleMcpFormChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="0"
              />
            </div>
          </div>

          {/* Row for Priority and Active */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">
                Priority
              </label>
              <input
                type="number"
                id="priority"
                name="priority"
                value={mcpFormData.priority ?? ''}
                onChange={handleMcpFormChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                step="1"
                title="Lower numbers run first (e.g., 0 runs before 1)"
              />
            </div>
             <div className="md:col-span-2 flex items-center pt-6">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={mcpFormData.is_active ?? true} // Default to true if undefined
                onChange={handleMcpFormChange}
                className="h-4 w-4 text-indigo-600 border-gray-500 rounded focus:ring-indigo-500"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-300">
                Active (Use this server for requests)
              </label>
            </div>
          </div>

          {/* Test Connection Section */}
          <div className="pt-4 border-t border-gray-700">
            <button 
              type="button"
              onClick={handleTestConnection}
              className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
              disabled={isTestingConnection || isSaving}
            >
              {isTestingConnection ? (
                <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Testing...</>
              ) : (
                'Test Connection'
              )}
            </button>
            {testConnectionResult && (
              <div className={`mt-3 p-3 rounded-md flex items-start space-x-3 ${testConnectionResult.success ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
                {testConnectionResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                )}
                <p className={`text-sm ${testConnectionResult.success ? 'text-green-300' : 'text-red-300'}`}>
                  {testConnectionResult.message}
                </p>
              </div>
            )}
            {/* Optionally display discovered capabilities */}
             {discoveredCapabilities && (
              <div className="mt-3 p-3 rounded-md bg-gray-700 border border-gray-600">
                <p className="text-sm font-medium text-gray-300 mb-2">Discovered Capabilities:</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap bg-gray-900 p-2 rounded"><code>{JSON.stringify(discoveredCapabilities, null, 2)}</code></pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSaving || isTestingConnection}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSaving || isTestingConnection}
          >
            {isSaving ? (
                <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Saving...</>
              ) : (
                 initialData?.id ? 'Save Changes' : 'Add Server'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 