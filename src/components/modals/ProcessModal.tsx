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

  const { memory_operations, context_operations, tool_operations, reasoning_chain, chat_history, performance, reasoning, discovered_tools } = processingDetails;
  const reasoningGraph = processingDetails?.reasoning_graph as { states?: string[] } | undefined;

  const [showStepModal, setShowStepModal] = React.useState(false);
  const [selectedStep, setSelectedStep] = React.useState<any | null>(null);

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
          {/* Reasoning Summary Header */}
          {reasoning && (
            <div className="mb-4 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              <div className="text-sm text-yellow-900">
                <span className="font-medium">Reasoning:</span> {reasoning.type || 'none'}
                <span className="ml-3 font-medium">Score:</span> {((reasoning.score || 0) * 100).toFixed(1)}%
              </div>
              {reasoning.reason && (
                <div className="text-xs text-yellow-800">{reasoning.reason}</div>
              )}
            </div>
          )}
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
              
              {/* Discovered tools section */}
              <div className="mb-3 text-sm">
                <div className="font-medium text-purple-900">Discovered Tools</div>
                <div className="mt-1">
                  {(discovered_tools && discovered_tools.length > 0) ? (
                    discovered_tools.map((t: any, idx: number) => (
                      <span key={idx} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-2 mb-1">
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">No tools discovered for this request</span>
                  )}
                </div>
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
                <div className="text-sm text-gray-500">Tools were not requested or inferred in this request</div>
              )}
            </div>

            {/* Reasoning Chain */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Reasoning Chain</h3>
              </div>
              {/* Markov state path */}
              {reasoningGraph?.states?.length ? (
                <div className="mb-3 text-xs text-yellow-800">
                  <span className="font-medium">Markov Path:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reasoningGraph.states.map((s, i) => (
                      <span key={`${s}-${i}`} className="px-2 py-0.5 bg-yellow-100 border border-yellow-200 rounded">
                        {i + 1}. {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              
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
                          <button
                            className="ml-auto text-xs px-2 py-0.5 rounded border border-yellow-300 text-yellow-900 hover:bg-yellow-100"
                            onClick={() => { setSelectedStep(step); setShowStepModal(true); }}
                          >
                            View
                          </button>
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
      {/* Step Details Modal */}
      {showStepModal && selectedStep && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowStepModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold text-gray-900">Reasoning Step #{selectedStep.step} • {selectedStep.state || selectedStep.type}</div>
              <button onClick={() => setShowStepModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-800">
              {selectedStep.question && (
                <div>
                  <div className="font-medium text-gray-900">Question</div>
                  <div className="mt-1 whitespace-pre-wrap text-gray-700">{selectedStep.question}</div>
                </div>
              )}
              {selectedStep.hypothesis && (
                <div>
                  <div className="font-medium text-gray-900">Hypothesis</div>
                  <div className="mt-1 whitespace-pre-wrap text-gray-700">{selectedStep.hypothesis}</div>
                </div>
              )}
              {(selectedStep.action || selectedStep.observation) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="font-medium text-gray-900">Action</div>
                    <pre className="mt-1 bg-gray-50 border rounded p-2 text-xs overflow-auto">{JSON.stringify(selectedStep.action, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Observation</div>
                    <pre className="mt-1 bg-gray-50 border rounded p-2 text-xs overflow-auto">{JSON.stringify(selectedStep.observation, null, 2)}</pre>
                  </div>
                </div>
              )}
              {Array.isArray(selectedStep.facts_considered) && selectedStep.facts_considered.length > 0 && (
                <div>
                  <div className="font-medium text-gray-900">Facts Considered</div>
                  <ul className="mt-1 list-disc pl-5 space-y-1 text-gray-700">
                    {selectedStep.facts_considered.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex justify-end">
              <button onClick={() => setShowStepModal(false)} className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
