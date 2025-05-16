console.log('do_options_local.ts loaded');

export function listAvailableRegions(): Promise<any[]> {
  console.log('Simplified listAvailableRegions called from local');
  return Promise.resolve([{ name: 'testregion_local', slug: 'test1_local' }]);
}

export function listAvailableSizes(): Promise<any[]> {
  console.log('Simplified listAvailableSizes called from local');
  return Promise.resolve([{ slug: 'testsize_local', memory: 2048 }]);
} 