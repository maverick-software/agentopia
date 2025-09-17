/**
 * Admin Stripe Configuration Page
 * Wrapper page for the Stripe Configuration Panel component
 * Accessible at /admin/billing/stripe-config
 */

import React from 'react';
import { StripeConfigurationPanel } from '@/components/admin/billing/StripeConfigurationPanel';

export default function AdminStripeConfigPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Stripe Configuration</h1>
        <p className="text-muted-foreground">
          Configure your Stripe account settings, API keys, and manage payment processing integration.
        </p>
      </div>
      
      <StripeConfigurationPanel />
    </div>
  );
}
