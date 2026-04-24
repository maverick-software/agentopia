import { Eye, Play, Shield, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminMCPTemplate } from '../types';

interface TemplatesTabProps {
  loading: boolean;
  searchTerm: string;
  categoryFilter: string;
  categories: string[];
  filteredTemplates: AdminMCPTemplate[];
  onSearchTermChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onViewDetails: (template: AdminMCPTemplate) => void;
  onToggleVerification: (templateId: string, isVerified: boolean) => void;
  onDeleteTemplate: (templateId: string) => void;
  onOneClickDeploy: (template: AdminMCPTemplate) => void;
  onManualDeploy: (template: AdminMCPTemplate) => void;
}

export function TemplatesTab({
  loading,
  searchTerm,
  categoryFilter,
  categories,
  filteredTemplates,
  onSearchTermChange,
  onCategoryFilterChange,
  onViewDetails,
  onToggleVerification,
  onDeleteTemplate,
  onOneClickDeploy,
  onManualDeploy,
}: TemplatesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCP Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.isVerified && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <Shield className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      <Badge variant="secondary">{template.category}</Badge>
                      <Badge variant="outline">v{template.version}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Deployments: {template.totalDeployments}</span>
                      <span>Active: {template.activeDeployments}</span>
                      <span>
                        Rating: {template.rating.average.toFixed(1)}/5 ({template.rating.count})
                      </span>
                      <span>Author: {template.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onViewDetails(template)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onToggleVerification(template.id, template.isVerified)}>
                      <Shield className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDeleteTemplate(template.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onOneClickDeploy(template)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Zap className="w-4 h-4 mr-1" />
                      One-Click Deploy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onManualDeploy(template)}>
                      <Play className="w-4 h-4 mr-1" />
                      Manual Deploy
                    </Button>
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No templates found matching your criteria</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
