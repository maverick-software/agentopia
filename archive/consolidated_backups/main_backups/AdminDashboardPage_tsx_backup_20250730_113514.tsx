import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Import supabase client
import { AlertCircle, Users, Bot } from 'lucide-react'; // Import icons

interface DashboardStats {
  totalUsers: number;
  activeAgents: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          'admin-get-dashboard-stats',
          {
            // No body needed for this GET request (implicitly)
          }
        );

        if (functionError) {
          console.error('Supabase function error:', functionError);
          throw new Error(functionError.message || 'Failed to fetch dashboard stats');
        }

        setStats(data as DashboardStats);
      } catch (err: any) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message || 'An unknown error occurred');
        setStats(null); // Clear stats on error
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>Error loading dashboard stats: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Stat Card */}
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-500 p-3 rounded-lg">
                <Users className="w-6 h-6 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-gray-400">Total Users</h2>
                {loading ? (
                    <div className="h-8 w-16 bg-gray-700 rounded animate-pulse mt-1"></div>
                ) : (
                    <p className="text-3xl font-bold text-white mt-1">{stats?.totalUsers ?? 'N/A'}</p>
                )}
            </div>
          </div>
        </div>

        {/* Active Agent Stat Card */}
        <div className="bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center space-x-4">
                <div className="bg-green-500 p-3 rounded-lg">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-400">Active Agents</h2>
                    {loading ? (
                        <div className="h-8 w-16 bg-gray-700 rounded animate-pulse mt-1"></div>
                    ) : (
                        <p className="text-3xl font-bold text-white mt-1">{stats?.activeAgents ?? 'N/A'}</p>
                    )}
                </div>
            </div>
        </div>

        {/* System Health Placeholder Card (update later in WBS 3.6) */}
        <div className="bg-gray-800 p-6 rounded-lg shadow">
             <div className="flex items-center space-x-4">
                 <div className="bg-yellow-500 p-3 rounded-lg">
                     <AlertCircle className="w-6 h-6 text-white" /> 
                 </div>
                 <div>
                     <h2 className="text-lg font-semibold text-gray-400">System Health</h2>
                     <p className="text-gray-500 mt-1 italic">Metrics coming soon...</p>
                 </div>
             </div>
        </div>
      </div>
      {/* Add more dashboard sections later */}
    </div>
  );
} 