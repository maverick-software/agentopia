import { AccountToolInstallationStatusEnum } from './manager.types.ts';

export function mapDtmaStatusToInstallationStatus(
  dtmaStatus: string
): AccountToolInstallationStatusEnum {
  switch (dtmaStatus?.toUpperCase()) {
    case 'PENDING':
    case 'STARTING':
      return 'deploying';
    case 'RUNNING':
      return 'running';
    case 'STOPPING':
      return 'deploying';
    case 'STOPPED':
      return 'stopped';
    case 'ERROR':
      return 'error';
    case 'UNKNOWN':
    default:
      console.warn(`Unknown DTMA status: ${dtmaStatus}. Mapping to 'error'.`);
      return 'error';
  }
}
