import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MCPServerCategory } from '@/lib/mcp/ui-types';
import type { AdminMCPTemplate } from '../types';

interface AddTemplateFormProps {
  onSubmit: (templateData: Partial<AdminMCPTemplate>) => void | Promise<void>;
  onCancel: () => void;
}

export function AddTemplateForm({ onSubmit, onCancel }: AddTemplateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    category: 'other' as MCPServerCategory,
    dockerImage: '',
    documentation: '',
    sourceCode: '',
    tags: '',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const templateData: Partial<AdminMCPTemplate> = {
      ...formData,
      category: formData.category,
      tags: formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    void onSubmit(templateData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g., GitHub Tools"
            required
          />
        </div>
        <div>
          <Label htmlFor="version">Version *</Label>
          <Input
            id="version"
            value={formData.version}
            onChange={(event) => setFormData((prev) => ({ ...prev, version: event.target.value }))}
            placeholder="e.g., 1.0.0"
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Brief description of what this MCP server does"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="author">Author *</Label>
          <Input
            id="author"
            value={formData.author}
            onChange={(event) => setFormData((prev) => ({ ...prev, author: event.target.value }))}
            placeholder="e.g., GitHub Inc."
            required
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as MCPServerCategory }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="productivity">Productivity</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="data-analysis">Data Analysis</SelectItem>
              <SelectItem value="ai-tools">AI Tools</SelectItem>
              <SelectItem value="integrations">Integrations</SelectItem>
              <SelectItem value="utilities">Utilities</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="dockerImage">Docker Image *</Label>
        <Input
          id="dockerImage"
          value={formData.dockerImage}
          onChange={(event) => setFormData((prev) => ({ ...prev, dockerImage: event.target.value }))}
          placeholder="e.g., mcp-servers/github-tools:latest"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="documentation">Documentation URL</Label>
          <Input
            id="documentation"
            value={formData.documentation}
            onChange={(event) => setFormData((prev) => ({ ...prev, documentation: event.target.value }))}
            placeholder="https://docs.example.com"
          />
        </div>
        <div>
          <Label htmlFor="sourceCode">Source Code URL</Label>
          <Input
            id="sourceCode"
            value={formData.sourceCode}
            onChange={(event) => setFormData((prev) => ({ ...prev, sourceCode: event.target.value }))}
            placeholder="https://github.com/example/repo"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(event) => setFormData((prev) => ({ ...prev, tags: event.target.value }))}
          placeholder="e.g., github, git, development"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add Template</Button>
      </div>
    </form>
  );
}
