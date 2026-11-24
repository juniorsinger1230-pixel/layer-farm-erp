import rawPages from './pageRegistry.json';
import type { DomainCode, DomainGroup, PageDefinition } from '../types';

export const PAGES = rawPages as PageDefinition[];
export const PAGE_MAP = Object.fromEntries(PAGES.map((page) => [page.pageId, page])) as Record<string, PageDefinition>;
export const DOMAIN_ORDER: DomainCode[] = ['ORG', 'FARM', 'VET', 'PROC', 'INV', 'SALES', 'LOG', 'FIN', 'EQP', 'RPT', 'PRINT', 'TRACE', 'PLAT'];
export const DOMAIN_GROUPS: DomainGroup[] = DOMAIN_ORDER.map((domain) => {
  const pages = PAGES.filter((page) => page.domain === domain);
  return { domain, domainName: pages[0]?.domainName ?? domain, pages };
});
export const DEFAULT_PAGE_ID = 'rpt-001';
export const COVERAGE = Object.freeze({ domains: 13, businessPages: 87, businessMenus: 87, totalPages: 88 });

export function getPage(pageId?: string): PageDefinition | undefined {
  return pageId ? PAGE_MAP[pageId] : undefined;
}
