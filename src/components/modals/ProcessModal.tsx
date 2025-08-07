import React from 'react';
import { X, Clock, Brain, Database, Zap, MessageSquare, BarChart3, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingDetails: any;
}

export const ProcessModal: React.FC<ProcessModalProps> = ({
  isOpen,
  onClose,
  processingDetails,
}) => {
  if (!isOpen || !processingDetails) return null;

  const { memory_operations, context_operations, tool_operations, reasoning_chain, chat_history, performance } = processingDetails;

  const formatTime = (ms: number) => `${ms}ms`;
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Processing Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Memory Operations */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Memory Operations</h3>
              </div>
              
              {/* Episodic Memory */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${memory_operations?.episodic_search?.searched ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="font-medium text-sm">Episodic Memory</span>
                </div>
                {memory_operations?.episodic_search ? (
                  <div className="ml-4 text-sm text-gray-600 space-y-1">
                    <div>Status: {memory_operations.episodic_search.searched ? 'Searched' : 'Not searched'}</div>
                    <div>Results: {memory_operations.episodic_search.results_count}</div>
                    <div>Search Time: {formatTime(memory_operations.episodic_search.search_time_ms)}</div>
                    {memory_operations.episodic_search.relevance_scores.length > 0 && (
                      <div>Avg Relevance: {formatPercent(memory_operations.episodic_search.relevance_scores.reduce((a, b) => a + b, 0) / memory_operations.episodic_search.relevance_scores.length)}</div>
                    )}
                  </div>
                ) : (
                  <div className="ml-4 text-sm text-gray-500">No episodic memory search performed</div>
                )}
              </div>

              {/* Semantic Memory */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${memory_operations?.semantic_search?.searched ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="font-medium text-sm">Semantic Memory</span>
                </div>
                {memory_operations?.semantic_search ? (
                  <div className="ml-4 text-sm text-gray-600 space-y-1">
                    <div>Status: {memory_operations.semantic_search.searched ? 'Searched' : 'Not searched'}</div>
                    <div>Results: {memory_operations.semantic_search.results_count}</div>
                    <div>Search Time: {formatTime(memory_operations.semantic_search.search_time_ms)}</div>
                    {memory_operations.semantic_search.concepts_retrieved.length > 0 && (
                      <div>Concepts: {memory_operations.semantic_search.concepts_retrieved.join(', ')}</div>
                    )}
                  </div>
                ) : (
                  <div className="ml-4 text-sm text-gray-500">No semantic memory search performed</div>
                )}
              </div>
            </div>

            {/* Context Operations */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Context Operations</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Sources Used:</span>
                  <div className="ml-2 mt-1">
                    {context_operations?.retrieval_sources?.map((source: string, idx: number) => (
                      <span key={idx} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-2 mb-1">
                        {source}
                      </span>
                    )) || 'None'}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {context_operations?.optimization_applied ? 
                      <CheckCircle className="h-4 w-4 text-green-600" /> : 
                      <XCircle className="h-4 w-4 text-gray-400" />
                    }
                    <span>Optimization Applied</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {context_operations?.compression_applied ? 
                      <CheckCircle className="h-4 w-4 text-green-600" /> : 
                      <XCircle className="h-4 w-4 text-gray-400" />
                    }
                    <span>Compression Applied</span>
                  </div>
                </div>
                
                <div>
                  <span className="font-medium">Quality Score:</span>
                  <span className="ml-2">{formatPercent(context_operations?.quality_score || 0)}</span>
                </div>
              </div>
            </div>

            {/* Tool Operations */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Tool Operations</h3>
              </div>
              
              {tool_operations && tool_operations.length > 0 ? (
                <div className="space-y-3">
                  {tool_operations.map((tool: any, idx: number) => (
                    <div key={idx} className="border border-purple-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {tool.success ? 
                          <CheckCircle className="h-4 w-4 text-green-600" /> : 
                          <XCircle className="h-4 w-4 text-red-600" />
                        }
                        <span className="font-medium text-sm">{tool.name}</span>
                        <span className="text-xs text-gray-500">({formatTime(tool.execution_time_ms)})</span>
                      </div>
                      {tool.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {tool.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No tools were used in this request</div>
              )}
            </div>

            {/* Reasoning Chain */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Reasoning Chain</h3>
              </div>
              
              {reasoning_chain && reasoning_chain.length > 0 ? (
                <div className="space-y-3">
                  {reasoning_chain.map((step: any, idx: number) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center text-xs font-medium text-yellow-800">
                        {step.step}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-yellow-800 uppercase">{step.type}</span>
                          <span className="text-xs text-gray-500">({formatTime(step.time_ms)})</span>
                          <span className="text-xs text-gray-500">Confidence: {formatPercent(step.confidence)}</span>
                        </div>
                        <div className="text-sm text-gray-700">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No reasoning chain captured</div>
              )}
            </div>

            {/* Chat History */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">Chat History Context</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Messages Considered:</span>
                  <span className="ml-2">{chat_history?.messages_considered || 0}</span>
                </div>
                <div>
                  <span className="font-medium">Context Window Used:</span>
                  <span className="ml-2">{chat_history?.context_window_used || 0} tokens</span>
                </div>
                <div className="flex items-center gap-1">
                  {chat_history?.relevance_filtering ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-gray-400" />
                  }
                  <span>Relevance Filtering Applied</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Performance Metrics</h3>
              </div>
              
              <div className="space-y-3">
                {/* Stage Timings */}
                <div>
                  <span className="font-medium text-sm mb-2 block">Stage Timings:</span>
                  <div className="space-y-1">
                    {performance?.stage_timings && Object.entries(performance.stage_timings).map(([stage, time]: [string, any]) => (
                      <div key={stage} className="flex justify-between text-xs">
                        <span className="capitalize">{stage.replace('_', ' ')}:</span>
                        <span>{formatTime(time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Cache Performance */}
                <div className="flex justify-between text-sm">
                  <span>Cache Hits:</span>
                  <span className="text-green-600">{performance?.cache_hits || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cache Misses:</span>
                  <span className="text-red-600">{performance?.cache_misses || 0}</span>
                </div>
                
                {/* Bottlenecks */}
                {performance?.bottlenecks && performance.bottlenecks.length > 0 && (
                  <div>
                    <span className="font-medium text-sm mb-2 block">Bottlenecks:</span>
                    {performance.bottlenecks.map((bottleneck: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 text-xs">
                        <AlertCircle className="h-3 w-3 text-yellow-600" />
                        <span>{bottleneck}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
