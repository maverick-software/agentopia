import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Database, MessageSquare, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  activeAgents: number;
  totalAgents: number;
  datastores: number;
  discordChannels: number;
  interactions: number;
  loading: boolean;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeAgents: 0,
    totalAgents: 0,
    datastores: 0,
    discordChannels: 0,
    interactions: 0,
    loading: true
  });
  const [error, setError] = useState<string | null>(null);
  const totalFetchAttempts = useRef(0);
  const MAX_TOTAL_FETCH_ATTEMPTS = 5;

  const fetchStats = useCallback(async (isInitialCall = true) => {
    if (!user) return;

    let currentAttempt = totalFetchAttempts.current + 1;
    if (isInitialCall) { currentAttempt = 1; totalFetchAttempts.current = 0; }
    totalFetchAttempts.current = currentAttempt;

    if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_TOTAL_FETCH_ATTEMPTS}) reached for dashboard stats. Aborting.`);
      setError(`Failed to load dashboard stats after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }
    console.log(`Fetching dashboard stats... Attempt ${currentAttempt}`);

    try {
      setError(null);
      setStats(prev => ({ ...prev, loading: true }));

      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id, active')
        .eq('user_id', user.id);

      if (agentsError) throw agentsError;

      const { count: datastoresCount, error: datastoresError } = await supabase
        .from('datastores')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (datastoresError) throw datastoresError;

      const activeAgentsCount = agents?.filter(agent => agent.active).length ?? 0;
      const totalAgentsCount = agents?.length ?? 0;
      const discordChannelsCount = 0; // Temporarily set to 0 until Discord integration is fixed

      setStats({
        activeAgents: activeAgentsCount,
        totalAgents: totalAgentsCount,
        datastores: datastoresCount ?? 0,
        discordChannels: discordChannelsCount,
        interactions: 0,
        loading: false
      });
      if (isInitialCall) totalFetchAttempts.current = 0;

    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
        const delay = 2000;
        setTimeout(() => fetchStats(false), delay);
        setError(`Failed to load stats. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS})`);
      } else {
        let errorMessage = `Failed to load dashboard statistics after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts. `;
        if (err instanceof Error) {
          if (err.message.includes('Failed to fetch')) {
            errorMessage += 'Unable to connect to the database. Please check your internet connection and try again.';
          } else if (err.message.includes('Database connection failed')) {
            errorMessage += err.message;
          } else {
            errorMessage += `Error: ${err.message}`;
          }
          console.error('Error stack:', err.stack);
        }
        setError(errorMessage);
        setStats(prev => ({ ...prev, loading: false }));
        console.error('Max fetch attempts reached for dashboard stats after error.');
      }
    }
  }, [user]);

  useEffect(() => {
    totalFetchAttempts.current = 0;
    fetchStats(true);
  }, [user, fetchStats]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Please sign in to view the dashboard.</div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Active Agents',
      value: stats.loading ? '-' : `${stats.activeAgents}/${stats.totalAgents}`,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Currently active / Total agents'
    },
    {
      label: 'Datastores',
      value: stats.loading ? '-' : stats.datastores.toString(),
      icon: Database,
      color: 'bg-green-500',
      description: 'Connected vector and knowledge datastores'
    },
    {
      label: 'Discord Channels',
      value: stats.loading ? '-' : stats.discordChannels.toString(),
      icon: MessageSquare,
      color: 'bg-purple-500',
      description: 'Active Discord integrations'
    },
    {
      label: 'Daily Interactions',
      value: stats.loading ? '-' : stats.interactions.toString(),
      icon: Activity,
      color: 'bg-red-500',
      description: '24-hour interaction count'
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(({ label, value, icon: Icon, color, description }) => (
          <div
            key={label}
            className="bg-dashboard-card border border-dashboard-card-border rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-start space-x-4">
              <div className={`${color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">{label}</h2>
                <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                <p className="text-sm text-muted-foreground mt-2">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dashboard-card border border-dashboard-card-border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database Connection</span>
              <span className="flex items-center text-dashboard-stat-positive">
                <span className="w-2 h-2 bg-dashboard-stat-positive rounded-full mr-2"></span>
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vector Search</span>
              <span className="flex items-center text-dashboard-stat-positive">
                <span className="w-2 h-2 bg-dashboard-stat-positive rounded-full mr-2"></span>
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Discord Integration</span>
              <span className="flex items-center text-warning">
                <span className="w-2 h-2 bg-warning rounded-full mr-2"></span>
                Partial
              </span>
            </div>
          </div>
        </div>

        <div className="bg-dashboard-card border border-dashboard-card-border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
          {stats.loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="w-12 h-12 bg-muted rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}