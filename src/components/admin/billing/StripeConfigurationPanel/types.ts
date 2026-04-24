export interface StripeConfig {
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
  webhook_url: string;
  mode: 'test' | 'live';
  connected: boolean;
  last_sync: string | null;
  oauth_connected: boolean;
  stripe_user_id?: string;
  stripe_account_id?: string;
  connection_method: 'oauth' | 'manual';
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  active: boolean;
  default_price: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring?: { interval: string };
  };
}

export const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];
