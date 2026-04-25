import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Plus, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getEffectiveStatus,
  getIconComponent,
  getStatusColor,
  getStatusText,
  providerNameForIntegration,
} from './integrationUtils';

export function IntegrationDetailsPanel({
  selectedIntegration,
  setSelectedIntegration,
  unifiedConnections,
  isIntegrationConnected,
  getConnectionCount,
  onAddCredentials,
}: any) {
  if (!selectedIntegration) {
    return null;
  }

  return (
    <div className="w-[400px] border-l border-border pl-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">{selectedIntegration.name}</h3>
        <button
          onClick={() => setSelectedIntegration(null)}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-muted">
            {React.createElement(getIconComponent(selectedIntegration.icon_name || 'Settings'), {
              className: 'h-8 w-8 text-primary',
            })}
          </div>
          <div>
            <Badge className={getStatusColor(getEffectiveStatus(selectedIntegration))}>
              {getStatusText(getEffectiveStatus(selectedIntegration))}
            </Badge>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">About</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {selectedIntegration.description || 'Integration description not yet available.'}
          </p>
        </div>

        {isIntegrationConnected(selectedIntegration.name) && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Connected Accounts ({getConnectionCount(selectedIntegration.name)})
            </h4>
            <div className="space-y-2">
              {unifiedConnections
                .filter(
                  (connection: any) =>
                    connection.provider_name === providerNameForIntegration(selectedIntegration.name),
                )
                .map((connection: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{connection.account_identifier || 'Account'}</span>
                    </div>
                    <Link to="/credentials">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {getEffectiveStatus(selectedIntegration) !== 'coming_soon' && (
            <>
              <Button onClick={() => onAddCredentials(selectedIntegration)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {isIntegrationConnected(selectedIntegration.name)
                  ? 'Add Another Account'
                  : 'Add Credentials'}
              </Button>

              {isIntegrationConnected(selectedIntegration.name) && (
                <Link to="/credentials" className="block">
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Credentials
                  </Button>
                </Link>
              )}
            </>
          )}

          {selectedIntegration.documentation_url && (
            <a
              href={selectedIntegration.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="ghost" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
