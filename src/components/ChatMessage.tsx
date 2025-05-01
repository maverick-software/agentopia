import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check } from 'lucide-react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message & {
    agentName?: string | null;
  };
}

export const ChatMessage = React.memo(function ChatMessage({ message }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <div
      className={`flex ${
        message.role === 'user' ? 'justify-end mr-4' : 'justify-start'
      }`}
    >
      <div
        className={`relative group max-w-2xl rounded-lg p-3 text-sm prose prose-sm prose-invert break-words ${
          message.role === 'user'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-600 text-gray-200'
        }`}
      >
        {message.role === 'assistant' && message.agentName && (
            <p className="text-xs font-medium text-gray-400 mb-1">{message.agentName}</p>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
            em: ({ node, ...props }) => <em className="italic" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline ? (
                <pre className="bg-gray-800/50 p-2 rounded overflow-x-auto mb-2"><code className={className} {...props}>{children}</code></pre>
              ) : (
                <code className="bg-gray-800/50 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
              );
            },
            a: ({ node, ...props }) => <a className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          }}
        >
          {message.content}
        </ReactMarkdown>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs opacity-70">
            {message.timestamp.toLocaleTimeString()}
          </p>
          {message.role === 'assistant' && (
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
              title="Copy response"
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Clipboard className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});