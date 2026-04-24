import { Filter, RefreshCw, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { getIconComponent, getEffectiveStatus } from './integrationUtils';

export function IntegrationsListPanel({
  isMobile,
  clearingCache,
  onClearCache,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  integrations,
  filteredIntegrations,
  pipedreamLoading,
  selectedIntegration,
  onSelectIntegration,
}: any) {
  return (
    <>
      {isMobile && (
        <MobileHeader
          title="Integrations"
          showMenu={true}
          actions={
            <button
              onClick={onClearCache}
              disabled={clearingCache}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              title="Clear cache"
            >
              <RefreshCw
                className={`w-5 h-5 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`}
              />
            </button>
          }
        />
      )}

      <div className="flex flex-col space-y-6 max-w-2xl w-full">
        {!isMobile && (
          <div className="flex flex-col space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
            <p className="text-muted-foreground text-sm">
              Connect your favorite tools and services to power your AI agents with external
              capabilities.
            </p>
          </div>
        )}

        <div className="flex gap-3 px-12">
          <div className="relative w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({filteredIntegrations.length})</SelectItem>
              {categories.map((category: any) => {
                const CategoryIcon = getIconComponent(category.icon_name);
                return (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center">
                      <CategoryIcon className="h-4 w-4 mr-2" />
                      {category.name}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 overflow-auto flex-1 px-12">
          {filteredIntegrations.map((integration: any) => {
            const IconComponent = getIconComponent(integration.icon_name || 'Settings');
            const effectiveStatus = getEffectiveStatus(integration);
            const isComingSoon = effectiveStatus === 'coming_soon';
            const isSelected = selectedIntegration?.id === integration.id;

            return (
              <div
                key={integration.id}
                onClick={() => onSelectIntegration(integration)}
                className={`flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors bg-muted/30 ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <div
                  className={`p-1.5 rounded-md mr-3 ${
                    isComingSoon ? 'bg-muted/50' : 'bg-primary/10'
                  }`}
                >
                  <IconComponent
                    className={`h-4 w-4 ${isComingSoon ? 'text-muted-foreground' : 'text-primary'}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-foreground">{integration.name}</h3>
                    {integration.is_pipedream_app && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Pipedream
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {pipedreamLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Loading Pipedream catalog...
            </div>
          )}

          {filteredIntegrations.length === 0 && (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No integrations found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
