import { Download, RefreshCw, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StripeProduct } from './types';

interface ProductsTabProps {
  products: StripeProduct[];
  connected: boolean;
  syncingProducts: boolean;
  onSyncProducts: () => void;
  onImportProduct: (product: StripeProduct) => void;
}

export function ProductsTab({ products, connected, syncingProducts, onSyncProducts, onImportProduct }: ProductsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Download className="w-5 h-5" />Stripe Products</div>
          <Button onClick={onSyncProducts} disabled={syncingProducts || !connected} size="sm">
            {syncingProducts ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Syncing...</> : <><RefreshCw className="w-4 h-4 mr-2" />Sync Products</>}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length > 0 ? (
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium">{product.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={product.active ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-600'}>{product.active ? 'Active' : 'Inactive'}</Badge>
                    <span className="text-sm">${(product.default_price.unit_amount / 100).toFixed(2)} / {product.default_price.recurring?.interval || 'one-time'}</span>
                  </div>
                </div>
                <Button onClick={() => onImportProduct(product)} size="sm" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">{connected ? 'No products found. Click "Sync Products" to load from Stripe.' : 'Connect to Stripe to view products.'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
