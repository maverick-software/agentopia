import { AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigurationTab } from './ConfigurationTab';
import { ProductsTab } from './ProductsTab';
import { WebhooksTab } from './WebhooksTab';
import { useStripeConfiguration } from './useStripeConfiguration';

export function StripeConfigurationPanel() {
  const {
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
  } = useStripeConfiguration();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Stripe Configuration</h2>
          <p className="text-gray-600 dark:text-gray-400">Configure Stripe integration and manage billing products</p>
        </div>
        <Badge className={config.connected ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
          {config.connected ? <><CheckCircle className="w-3 h-3 mr-1" />Connected</> : <><AlertCircle className="w-3 h-3 mr-1" />Not Connected</>}
        </Badge>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <ConfigurationTab
            config={config}
            loading={loading}
            testingConnection={testingConnection}
            onConfigChange={setConfig}
            onSave={saveStripeConfig}
            onTestConnection={testStripeConnection}
            onInitiateOAuth={initiateStripeOAuth}
            onDisconnectOAuth={disconnectStripeOAuth}
          />
        </TabsContent>

        <TabsContent value="products">
          <ProductsTab
            products={products}
            connected={config.connected}
            syncingProducts={syncingProducts}
            onSyncProducts={syncStripeProducts}
            onImportProduct={importProductToBillingPlans}
          />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab lastSync={config.last_sync} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
