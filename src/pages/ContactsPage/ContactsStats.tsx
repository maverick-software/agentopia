import { Card, CardContent } from '@/components/ui/card';
import type { ContactStats } from './types';

interface ContactsStatsProps {
  stats: ContactStats;
}

export function ContactsStats({ stats }: ContactsStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Contacts</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.recent}</div>
            <div className="text-xs text-muted-foreground">Added Recently</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.withEmail}</div>
            <div className="text-xs text-muted-foreground">With Email</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">{stats.withPhone}</div>
            <div className="text-xs text-muted-foreground">With Phone</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
