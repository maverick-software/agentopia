import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { StripeConfig, StripeProduct } from './types';

const MASK_LONG = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
const MASK_MEDIUM = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';

export function useStripeConfiguration() {
  const { user } = useAuth();
  const [config, setConfig] = useState<StripeConfig>({
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
    webhook_url: '',
    mode: 'test',
    connected: false,
    last_sync: null,
    oauth_connected: false,
    stripe_user_id: '',
    stripe_account_id: '',
    connection_method: 'oauth',
  });
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);

  useEffect(() => {
    loadStripeConfig();
  }, []);

  const loadStripeConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: { action: 'get_config' },
      });
      if (error || !data?.success || !data?.data) return;
      const configData = data.data;
      setConfig((prev) => ({
        ...prev,
        ...configData,
        secret_key: configData.has_secret_key ? MASK_LONG : '',
        webhook_secret: configData.has_webhook_secret ? MASK_MEDIUM : '',
        publishable_key: configData.has_publishable_key ? MASK_LONG : '',
      }));
    } catch (error) {
      console.error('Failed to load Stripe config:', error);
    }
  };

  const saveStripeConfig = async () => {
    try {
      setLoading(true);
      if (!config.secret_key || !config.webhook_secret) throw new Error('Secret key and webhook secret are required');
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: { action: 'save_keys', secret_key: config.secret_key, webhook_secret: config.webhook_secret, publishable_key: config.publishable_key },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to save configuration');
      setConfig((prev) => ({
        ...prev,
        connected: true,
        ...data.data.config,
        publishable_key: prev.publishable_key,
        secret_key: prev.secret_key,
        webhook_secret: prev.webhook_secret,
      }));
      toast.success('Stripe configuration saved successfully in vault');
    } catch (error: any) {
      console.error('Failed to save Stripe config:', error);
      toast.error(`Failed to save configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testStripeConnection = async () => {
    try {
      setTestingConnection(true);
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', { body: { action: 'test_connection' } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Connection test failed');
      setConfig((prev) => ({ ...prev, connected: true }));
      toast.success(`Stripe connection successful! Account: ${data.data.account_id}`);
    } catch (error: any) {
      console.error('Stripe connection test failed:', error);
      toast.error(`Connection test failed: ${error.message}`);
      setConfig((prev) => ({ ...prev, connected: false }));
    } finally {
      setTestingConnection(false);
    }
  };

  const syncStripeProducts = async () => {
    try {
      setSyncingProducts(true);
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', { body: { action: 'sync_products' } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Product sync failed');
      setProducts(data.data.products || []);
      setConfig((prev) => ({ ...prev, last_sync: new Date().toISOString() }));
      toast.success(`Synced ${data.data.count || 0} products from Stripe`);
    } catch (error: any) {
      console.error('Product sync failed:', error);
      toast.error(`Product sync failed: ${error.message}`);
    } finally {
      setSyncingProducts(false);
    }
  };

  const initiateStripeOAuth = () => {
    try {
      const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID || process.env.REACT_APP_STRIPE_CLIENT_ID;
      if (!clientId || clientId === 'ca_YOUR_CLIENT_ID') {
        toast.error('Stripe Client ID not configured. Please set VITE_STRIPE_CLIENT_ID in environment variables.');
        return;
      }
      if (!user?.id) return toast.error('User not authenticated');
      const redirectUri = `${window.location.origin}/admin/billing/stripe-callback`;
      const state = btoa(JSON.stringify({ user_id: user.id, timestamp: Date.now() }));
      const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('client_id', clientId);
      oauthUrl.searchParams.set('scope', 'read_write');
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('state', state);
      window.location.href = oauthUrl.toString();
    } catch (error: any) {
      toast.error(`Failed to initiate Stripe connection: ${error.message}`);
    }
  };

  const disconnectStripeOAuth = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: { action: 'disconnect_oauth', stripe_user_id: config.stripe_user_id },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Failed to disconnect');
      setConfig((prev) => ({ ...prev, oauth_connected: false, stripe_user_id: '', stripe_account_id: '', connected: false, publishable_key: '', secret_key: '' }));
      toast.success('Stripe account disconnected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const importProductToBillingPlans = async (product: StripeProduct) => {
    try {
      const { error } = await supabase.from('billing_plans').upsert({
        plan_name: product.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: product.name,
        description: product.description || '',
        stripe_price_id: product.default_price.id,
        amount: product.default_price.unit_amount || 0,
        currency: product.default_price.currency,
        billing_interval: product.default_price.recurring?.interval || 'month',
        features: [],
        limits: {},
        is_active: product.active,
      });
      if (error) throw error;
      toast.success(`Imported ${product.name} to billing plans`);
    } catch (error) {
      console.error('Failed to import product:', error);
      toast.error('Failed to import product');
    }
  };

  return {
    config,
    setConfig,
    products,
    loading,
    testingConnection,
    syncingProducts,
    saveStripeConfig,
    testStripeConnection,
    syncStripeProducts,
    initiateStripeOAuth,
    disconnectStripeOAuth,
    importProductToBillingPlans,
  };
}
