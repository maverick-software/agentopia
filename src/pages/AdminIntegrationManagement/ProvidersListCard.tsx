import { Edit2, Shield, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statusBadgeConfig } from './constants';
import type { OAuthProvider } from './types';

interface ProvidersListCardProps {
  providers: OAuthProvider[];
  onEdit: (provider: OAuthProvider) => void;
  onDelete: (provider: OAuthProvider) => void;
}

export function ProvidersListCard({ providers, onEdit, onDelete }: ProvidersListCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-foreground">OAuth Providers ({providers.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {providers.map((provider) => {
            const badgeConfig = provider.is_enabled
              ? statusBadgeConfig.enabled
              : statusBadgeConfig.disabled;

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-muted/50 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{provider.display_name}</h3>
                      <Badge className={badgeConfig.className}>
                        <badgeConfig.Icon className="h-3 w-3 mr-1" />
                        {badgeConfig.label}
                      </Badge>
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                        {provider.pkce_required ? 'PKCE' : 'No PKCE'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Provider: {provider.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scopes: {provider.scopes_supported.length} • Credentials:{' '}
                      {provider.client_credentials_location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(provider)}
                    className="hover:bg-muted text-primary hover:text-primary/80"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(provider)}
                    className="hover:bg-destructive/10 text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {providers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No OAuth providers found matching your criteria.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
