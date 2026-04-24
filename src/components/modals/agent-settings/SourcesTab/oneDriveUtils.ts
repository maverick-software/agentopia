export function mapOneDriveScopes(scopes: string[]): string[] {
  const capabilities: string[] = [];
  if (scopes.includes('https://graph.microsoft.com/Files.Read') || scopes.includes('https://graph.microsoft.com/Files.Read.All')) capabilities.push('files.read');
  if (scopes.includes('https://graph.microsoft.com/Files.ReadWrite') || scopes.includes('https://graph.microsoft.com/Files.ReadWrite.All')) capabilities.push('files.write');
  if (scopes.includes('https://graph.microsoft.com/Sites.Read.All')) capabilities.push('sites.read');
  if (scopes.includes('https://graph.microsoft.com/Sites.ReadWrite.All')) capabilities.push('sites.write');
  return capabilities.length > 0 ? capabilities : ['files.read'];
}

export function getOneDriveStatus(credentialCount: number, permissionCount: number) {
  if (permissionCount > 0) return { enabled: true, statusText: 'Connected' as const };
  if (credentialCount > 0) return { enabled: false, statusText: 'Available' as const };
  return { enabled: false, statusText: 'Not Connected' as const };
}

export const ONE_DRIVE_SCOPE_DISPLAY: Record<string, { label: string; description: string }> = {
  'https://graph.microsoft.com/Files.Read': { label: 'Read Files', description: 'Access and read your files' },
  'https://graph.microsoft.com/Files.ReadWrite': { label: 'Read and Write Files', description: 'Create, edit, and manage your files' },
  'https://graph.microsoft.com/Files.Read.All': { label: 'Read All Files', description: 'Access all files you have permission to read' },
  'https://graph.microsoft.com/Files.ReadWrite.All': { label: 'Full File Access', description: 'Complete access to all your files and folders' },
  'https://graph.microsoft.com/Sites.Read.All': { label: 'Read SharePoint Sites', description: 'Access SharePoint sites and libraries' },
  'https://graph.microsoft.com/Sites.ReadWrite.All': { label: 'Write SharePoint Sites', description: 'Create and modify SharePoint sites and libraries' },
  'https://graph.microsoft.com/User.Read': { label: 'Read User Profile', description: 'Access your basic profile information' },
};
