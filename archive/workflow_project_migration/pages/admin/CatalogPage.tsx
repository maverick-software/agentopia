import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RequireGlobalRole } from '../../components/auth/RequireRole';

// TODO: Future Development Notes for Catalog Page:
// The catalog will be divided into two main sections: "Products" and "Plans".
// 1. Products: 
//    - Admins can create and manage individual products/services.
//    - Each product will have an option to be "plan-eligible", meaning it can be added to a recurring plan.
//    - Some products may be one-off purchases and not eligible for plans.
// 2. Plans:
//    - Plans are recurring, retainer-based subscriptions.
//    - Admins can create plans by bundling one or more "plan-eligible" products.
//    - Plans will have their own pricing, billing cycle, etc.

export const CatalogPage: React.FC = () => {
  return (
    <RequireGlobalRole allowedRoles={['SUPER_ADMIN', 'DEVELOPER']}>
      <div className="p-4 md:p-8 space-y-8 bg-background text-foreground min-h-screen">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Catalog Management</h1>
          <p className="text-muted-foreground">Manage your product and service catalog.</p>
        </div>

        {/* Placeholder content */}
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Catalog Overview</CardTitle>
            <CardDescription>
              This page will allow you to manage your organization's products and services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              This is a placeholder for the Catalog Management page. You'll be able to add, edit, and remove
              items from your catalog here. Future functionality may include:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Adding new products and services</li>
              <li>Categorizing items</li>
              <li>Setting pricing information</li>
              <li>Managing inventory</li>
              <li>Configuring availability</li>
            </ul>
            <div className="bg-muted p-4 rounded-md mt-6">
              <p className="text-sm font-medium">Development Note</p>
              <p className="text-sm text-muted-foreground">
                This page is currently a placeholder and will be implemented in an upcoming release.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequireGlobalRole>
  );
}; 