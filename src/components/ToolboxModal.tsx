import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { listDORegions, listDOSizes, DORegionOption, DOSizeOption } from '@/lib/api/toolboxes';

// Temporary placeholder types - these will be replaced with actual Toolbox/Service/Toolbelt types
interface McpConfigurationCreate { name?: string; driver_type?: string; endpoint_url?: string; vault_api_key_id?: string | null; is_active?: boolean; priority?: number; timeout_ms?: number; max_retries?: number; retry_backoff_ms?: number; }
interface McpConfigurationUpdate extends McpConfigurationCreate { id: number; }
interface McpConfiguration { id: number; name: string; driver_type?: string; endpoint_url?: string; vault_api_key_id?: string | null; is_active?: boolean; priority?: number; timeout_ms?: number; max_retries?: number; retry_backoff_ms?: number; capabilities?: MCPServerCapabilities; config_id?: number; }
interface McpDriverInfo { id: string; name: string; description: string; }

// Define the payload for provisioning a new toolbox
export interface ProvisionToolboxPayload {
  name: string;
  description?: string;
  regionSlug: string;
  sizeSlug: string;
  // imageSlug could be added if we allow selection, backend defaults if not provided
}

interface ToolboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProvision: (data: ProvisionToolboxPayload) => Promise<void>;
}

const ToolboxModal: React.FC<ToolboxModalProps> = ({ 
  isOpen, 
  onClose, 
  onProvision,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [size, setSize] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [regions, setRegions] = useState<DORegionOption[]>([]);
  const [sizes, setSizes] = useState<DOSizeOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form fields
      setName('');
      setDescription('');
      setRegion('');
      setSize('');
      setIsSaving(false);
      setFormError(null);
      setOptionsError(null);

      // Fetch options
      const fetchOptions = async () => {
        setIsLoadingOptions(true);
        try {
          const [fetchedRegions, fetchedSizes] = await Promise.all([
            listDORegions(),
            listDOSizes(),
          ]);
          setRegions(fetchedRegions.filter((r: DORegionOption) => r.available)); // Only show available regions
          setSizes(fetchedSizes.filter((s: DOSizeOption) => s.available));     // Only show available sizes
        } catch (err: any) {
          console.error("Failed to fetch DO options:", err);
          setOptionsError(err.message || 'Could not load provisioning options.');
        }
        setIsLoadingOptions(false);
      };
      fetchOptions();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setFormError(null);
    if (!name || !region || !size) {
      setFormError('Name, Region, and Size are required.');
      return;
    }
    setIsSaving(true);
    try {
      await onProvision({ name, description, regionSlug: region, sizeSlug: size });
      // Parent handles closing on success
    } catch (apiError: any) {
      setFormError(apiError.message || 'Failed to provision toolbox. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Provision New Toolbox</DialogTitle>
          <DialogDescription>
            Configure and launch a new DigitalOcean Droplet to serve as your Toolbox.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Name Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name<span className="text-red-500">*</span></Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., My Development Toolbox" />
          </div>
          {/* Description Textarea */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="Optional details about this toolbox" />
          </div>
          
          {/* Options Loading/Error State */}
          {isLoadingOptions && (
            <div className="col-span-4 flex items-center justify-center p-4 bg-muted/50 rounded-md">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading regions and sizes...</span>
            </div>
          )}
          {optionsError && !isLoadingOptions && (
            <div className="col-span-4 bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md text-sm">
              {optionsError}
            </div>
          )}

          {/* Region Select */}
          {!isLoadingOptions && !optionsError && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">Region<span className="text-red-500">*</span></Label>
              <Select value={region} onValueChange={setRegion} disabled={regions.length === 0}>
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={regions.length > 0 ? "Select a region" : "No regions available"} />
                  </SelectTrigger>
                  <SelectContent>
                      {regions.map(r => (
                          <SelectItem key={r.slug} value={r.slug}>{r.name} ({r.slug})</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
          )}

          {/* Size Select */}
          {!isLoadingOptions && !optionsError && (
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="size" className="text-right">Size<span className="text-red-500">*</span></Label>
              <Select value={size} onValueChange={setSize} disabled={sizes.length === 0 || !region}> 
                  {/* Sizes might depend on selected region, for now show all available based on API response */}
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={sizes.length > 0 ? "Select a size" : "No sizes available"} />
                  </SelectTrigger>
                  <SelectContent>
                      {sizes
                        .filter((s: DOSizeOption) => region ? s.regions.includes(region) : true) // Filter sizes by selected region, typed `s`
                        .map((s: DOSizeOption) => ( // Typed `s` here too
                          <SelectItem key={s.slug} value={s.slug}>{s.description} - Monthly: ${s.price_monthly.toFixed(2)}</SelectItem>
                      ))}
                      {region && sizes.filter((s: DOSizeOption) => s.regions.includes(region)).length === 0 && ( // Typed `s` here too
                        <p className='text-sm text-muted-foreground p-2'>No sizes available for selected region.</p>
                      )}
                  </SelectContent>
              </Select>
            </div>
          )}

          {formError && (
            <div className="col-span-4 bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md text-sm">
              {formError}
            </div>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoadingOptions || !name || !region || !size}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Provisioning...' : 'Provision Toolbox'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ToolboxModal; 