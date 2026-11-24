import rawDesign from './uxDesign.json';
import rawPageMap from './uxPageMap.json';
import { PAGES } from './registry';
import type { DemoRole, PageDefinition } from '../types';

export interface UxRole {
  id: DemoRole;
  name: string;
  shortName: string;
  kind: 'BUSINESS' | 'GOVERNANCE';
  description: string;
  dataScope: string;
  defaultCompany: 'THL' | 'TGE';
  allowedCompanies: Array<'THL' | 'TGE'>;
  environmentIds: string[];
  homePageId: string;
  source: string;
}
export interface UxEnvironment {
  id: string;
  name: string;
  terminal: string;
  network: string;
  input: string;
  constraints: string;
  offline: string;
}
export interface UxJourneyStep {
  roleId: DemoRole;
  pageId: string;
  action: string;
  evidence: string;
}
export interface UxJourney {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  goal: string;
  trigger: string;
  environmentIds: string[];
  entryPageId: string;
  requirementIds: string[];
  exceptionIds: string[];
  steps: UxJourneyStep[];
  nfrIds: string[];
  externalCandidateIds: string[];
  preconditions: string[];
  permissionFailure: string;
  weakNetworkRecovery: string;
  audit: string;
  completionEvidence: string;
}
export interface UxCapability {
  id: string;
  title: string;
  stage: string;
  output: string;
  journeyId: string;
  roleIds: DemoRole[];
  flow?: { trigger?: string; fallback?: string; companyScope?: string };
}
export interface UxDesign {
  meta: Record<string, string>;
  roles: UxRole[];
  environments: UxEnvironment[];
  iaGroups: Array<{ id: string; name: string; purpose: string; objects: string[]; domains: string[] }>;
  objectIndex: Array<{ id: string; name: string; key: string; routePageId: string; relatedDomains: string[] }>;
  journeys: UxJourney[];
  capabilities: UxCapability[];
  traceability: Array<Record<string, unknown>>;
}
export interface UxPageAccess {
  pageId: string;
  requirementId: string;
  readRoles: DemoRole[];
  writeRoles: DemoRole[];
  environmentIds: string[];
  journeyIds: string[];
  mappingBasis: string;
}

export const uxDesign = rawDesign as unknown as UxDesign;
export const uxPageMap = rawPageMap as unknown as Record<string, UxPageAccess>;
export const uxRoles = uxDesign.roles;
export const uxRoleMap = Object.fromEntries(uxRoles.map((role) => [role.id, role])) as Record<DemoRole, UxRole>;
export const uxEnvironmentMap = Object.fromEntries(uxDesign.environments.map((environment) => [environment.id, environment]));
export const uxJourneyMap = Object.fromEntries(uxDesign.journeys.map((journey) => [journey.id, journey])) as Record<string, UxJourney>;
export const uxRoleLabels = Object.fromEntries(uxRoles.map((role) => [role.id, role.name])) as Record<DemoRole, string>;

export function canReadPage(pageId: string, role: DemoRole) {
  return Boolean(uxPageMap[pageId]?.readRoles.includes(role));
}
export function canWritePage(pageId: string, role: DemoRole) {
  return Boolean(uxPageMap[pageId]?.writeRoles.includes(role));
}
export function canUseCompany(role: DemoRole, company: 'THL' | 'TGE') {
  return uxRoleMap[role]?.allowedCompanies.includes(company) ?? false;
}
export function getRolePages(role: DemoRole, writeOnly = false): PageDefinition[] {
  return PAGES.filter((page) => writeOnly ? canWritePage(page.pageId, role) : canReadPage(page.pageId, role));
}
export function getRoleTasks(role: DemoRole): PageDefinition[] {
  const priority = { P0: 0, P1: 1, P2: 2 };
  return getRolePages(role).sort((a, b) => Number(canWritePage(b.pageId, role)) - Number(canWritePage(a.pageId, role)) || priority[a.priority] - priority[b.priority] || a.index - b.index);
}
export function getRoleJourneys(role: DemoRole) {
  return uxDesign.journeys.filter((journey) => journey.steps.some((step) => step.roleId === role) || journey.requirementIds.some((requirementId) => {
    const page = PAGES.find((item) => item.requirementId === requirementId);
    return page ? canReadPage(page.pageId, role) : false;
  }));
}
export function getRoleCapabilities(role: DemoRole) {
  return uxDesign.capabilities.filter((capability) => capability.roleIds.includes(role));
}
export function getPageRoute(pageId: string, mobile = false) {
  return `${mobile ? '/h5' : '/app'}/${pageId}`;
}
export function getRoleHome(role: DemoRole, mobile = false) {
  return getPageRoute(uxRoleMap[role]?.homePageId ?? 'workbench', mobile);
}
