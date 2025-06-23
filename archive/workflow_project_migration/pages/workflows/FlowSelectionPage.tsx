import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Building2, 
  Search, 
  Clock, 
  Users, 
  Filter,
  Eye,
  Play,
  Star,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectFlowService } from '@/services/projectFlowService';
import type { ProjectFlow } from '@/types/project-flows';

interface Client {
  id: string;
  name: string | null;
  business_name: string | null;
  industry: string | null;
  logo_url: string | null;
}

interface FlowCardData {
  flow: ProjectFlow;
  stepCount: number;
  estimatedDuration: string;
  isPopular: boolean;
  isRecommended: boolean;
}

interface FlowFilter {
  type: 'all' | 'active' | 'popular';
  label: string;
}

const FLOW_FILTERS: FlowFilter[] = [
  { type: 'all', label: 'All Flows' },
  { type: 'active', label: 'Active' },
  { type: 'popular', label: 'Popular' }
];

export const FlowSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const clientId = searchParams.get('clientId');
  
  const [client, setClient] = useState<Client | null>(null);
  const [flows, setFlows] = useState<FlowCardData[]>([]);
  const [filteredFlows, setFilteredFlows] = useState<FlowCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FlowFilter['type']>('active');

  // Load client and flows data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // If no clientId, redirect to projects page
        if (!clientId) {
          navigate('/projects');
          return;
        }

        // Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, business_name, industry, logo_url')
          .eq('id', clientId)
          .single();

        if (clientError) {
          throw new Error('Client not found');
        }

        // Fetch project flows
        const flowsData = await projectFlowService.getProjectFlows();
        
        // Transform flows into card data format
        const flowCards: FlowCardData[] = flowsData.map(flow => ({
          flow,
          stepCount: 0, // TODO: Calculate from flow steps when loaded
          estimatedDuration: flow.estimated_duration_minutes 
            ? `~${flow.estimated_duration_minutes} min`
            : '~30 min',
          isPopular: false, // TODO: Calculate based on usage analytics
          isRecommended: false // TODO: Implement recommendation logic
        }));

        setClient(clientData);
        setFlows(flowCards);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId, navigate]);

  // Filter flows based on search and active filter
  useEffect(() => {
    let filtered = flows;

    // Apply status filter
    if (activeFilter === 'active') {
      filtered = filtered.filter(card => card.flow.is_active);
    } else if (activeFilter === 'popular') {
      filtered = filtered.filter(card => card.isPopular);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card => 
        card.flow.name.toLowerCase().includes(query) ||
        (card.flow.description && card.flow.description.toLowerCase().includes(query))
      );
    }

    setFilteredFlows(filtered);
  }, [flows, searchQuery, activeFilter]);

  const handleFlowSelect = (flow: ProjectFlow) => {
    // Navigate to flow execution
    navigate(`/flow-execution/${flow.id}?clientId=${clientId}`);
  };

  const handleFlowPreview = (flow: ProjectFlow) => {
    // TODO: Implement flow preview modal
    console.log('Preview flow:', flow);
  };

  const getFlowIcon = (flow: ProjectFlow) => {
    // Map flow icons to Lucide icons
    switch (flow.icon) {
      case 'globe':
        return '🌐';
      case 'smartphone':
        return '📱';
      case 'briefcase':
        return '💼';
      default:
        return '📋';
    }
  };

  // Render flow card
  const FlowCard: React.FC<{ card: FlowCardData }> = ({ card }) => (
    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="text-2xl p-2 rounded-lg"
              style={{ backgroundColor: card.flow.color + '20' }}
            >
              {getFlowIcon(card.flow)}
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {card.flow.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {card.stepCount} steps
                </Badge>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {card.estimatedDuration}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {card.isPopular && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Star className="h-3 w-3" />
                Popular
              </Badge>
            )}
            {card.isRecommended && (
              <Badge variant="default" className="text-xs flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Recommended
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {card.flow.description || 'No description available'}
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleFlowPreview(card.flow);
            }}
            className="flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={() => handleFlowSelect(card.flow)}
            className="flex items-center gap-1 flex-1"
          >
            <Play className="h-3 w-3" />
            Start Flow
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Create Project</h1>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/clients/${client?.id}?tab=projects`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </div>
          
          {client && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {client.logo_url ? (
                  <img 
                    src={client.logo_url} 
                    alt={`${client.business_name || client.name} logo`}
                    className="h-12 w-12 rounded-full object-contain bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Choose a Project Flow</h1>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span>for {client.business_name || client.name}</span>
                    {client.industry && (
                      <Badge variant="outline" className="text-xs">
                        {client.industry}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search flows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {FLOW_FILTERS.map((filter) => (
              <Button
                key={filter.type}
                variant={activeFilter === filter.type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(filter.type)}
                className="flex items-center gap-1"
              >
                {filter.type === 'popular' && <Star className="h-3 w-3" />}
                {filter.type === 'active' && <Filter className="h-3 w-3" />}
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Flows Grid */}
        {filteredFlows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFlows.map((card) => (
              <FlowCard key={card.flow.id} card={card} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No flows found</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery ? 
                  `No flows match "${searchQuery}". Try adjusting your search or filters.` :
                  'No active flows are available. Contact your administrator to set up project flows.'
                }
              </p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}; 