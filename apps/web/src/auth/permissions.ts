import pageApiMap from '../generated/page-api-map.json';
import type { PageDefinition } from '../types';
import { gapReadPermissionByDomain, type AuthMe } from './types';

export interface MappedPageContract {
  requirementId: string;
  table: string;
  path: string;
  mode: 'CRUD_AND_ACTION' | 'READ_ONLY' | 'TEMPORARY_UNMAPPED';
  allowedMethods: string[];
  permission: string;
  companyScope: boolean;
  contractPath: boolean;
}

const mappedContracts = pageApiMap.mapped as Record<string, MappedPageContract>;
const gapPageIds = new Set(pageApiMap.gap.map((page) => page.pageId));

export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes('*') || permissions.includes(required)) return true;
  const [module, action] = required.split(':');
  if (module && permissions.includes(`${module}:*`)) return true;
  if (module && permissions.includes(`${module}:manage`)) return true;
  if (action && permissions.includes(`*:${action}`)) return true;
  return false;
}

export function isGapPage(pageId: string): boolean {
  return gapPageIds.has(pageId);
}

export function getMappedContract(pageId: string): MappedPageContract | null {
  return mappedContracts[pageId] ?? null;
}

export function pageReadPermission(page: PageDefinition): string {
  const contract = getMappedContract(page.pageId);
  if (contract) return `${contract.permission}:read`;
  return gapReadPermissionByDomain[page.domain];
}

export function canReadPage(profile: AuthMe, pageId: string): boolean {
  const page = pageApiMap.gap.find((item) => item.pageId === pageId);
  const contract = getMappedContract(pageId);
  if (contract) return hasPermission(profile.permissions, `${contract.permission}:read`);
  if (page) {
    const domain = page.domain as PageDefinition['domain'];
    return hasPermission(profile.permissions, gapReadPermissionByDomain[domain]);
  }
  return false;
}

export function canCreatePage(profile: AuthMe, pageId: string): boolean {
  const contract = getMappedContract(pageId);
  return Boolean(contract && contract.mode === 'CRUD_AND_ACTION' && contract.allowedMethods.includes('POST') && hasPermission(profile.permissions, `${contract.permission}:create`));
}

export function canUpdatePage(profile: AuthMe, pageId: string): boolean {
  const contract = getMappedContract(pageId);
  return Boolean(contract && contract.mode === 'CRUD_AND_ACTION' && contract.allowedMethods.includes('PATCH') && hasPermission(profile.permissions, `${contract.permission}:update`));
}

export function canApprovePage(profile: AuthMe, pageId: string): boolean {
  const contract = getMappedContract(pageId);
  return Boolean(contract && contract.mode === 'CRUD_AND_ACTION' && contract.allowedMethods.includes('POST') && hasPermission(profile.permissions, `${contract.permission}:approve`));
}
