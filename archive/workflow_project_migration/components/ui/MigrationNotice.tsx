import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Info } from 'lucide-react';

interface MigrationNoticeProps {
  title: string;
  description: string;
  actionText: string;
  actionLink: string;
  variant?: 'default' | 'destructive' | 'warning';
  onDismiss?: () => void;
}

export const MigrationNotice: React.FC<MigrationNoticeProps> = ({
  title,
  description,
  actionText,
  actionLink,
  variant = 'default',
  onDismiss
}) => {
  const getAlertVariant = () => {
    switch (variant) {
      case 'destructive':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Alert variant={getAlertVariant()} className="border-2 border-dashed">
      <Info className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{description}</p>
        <div className="flex items-center gap-2">
          <Button asChild variant="default" size="sm">
            <Link to={actionLink} className="flex items-center gap-2">
              {actionText}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-xs"
            >
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}; 