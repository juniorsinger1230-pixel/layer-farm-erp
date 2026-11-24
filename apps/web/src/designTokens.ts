import type { ThemeConfig } from 'antd';

export const COLORS = {
  primary: '#2563EB', primaryHover: '#3B82F6', primaryActive: '#1D4ED8',
  success: '#16A34A', warning: '#F59E0B', danger: '#DC2626', info: '#0891B2',
  text: '#1F2937', textSecondary: '#6B7280', border: '#E5E7EB',
  pageBg: '#F5F7FA', cardBg: '#FFFFFF', accentOrange: '#FD972A', accentBlue: '#0E68B5',
} as const;

export const CHART_PALETTE = ['#2563EB', '#16A34A', '#0891B2', '#F59E0B', '#8B5CF6', '#0E68B5', '#FD972A', '#64748B'];

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: COLORS.primary, colorSuccess: COLORS.success, colorWarning: COLORS.warning,
    colorError: COLORS.danger, colorInfo: COLORS.primary, colorText: COLORS.text,
    colorTextSecondary: COLORS.textSecondary, colorBorder: COLORS.border,
    colorBgLayout: COLORS.pageBg, colorBgContainer: COLORS.cardBg,
    borderRadius: 8, borderRadiusLG: 12, fontSize: 14,
    controlHeight: 36, controlHeightLG: 44,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: { headerBg: COLORS.cardBg, siderBg: COLORS.cardBg, headerHeight: 64 },
    Menu: { itemHeight: 40, subMenuItemBg: COLORS.cardBg, itemSelectedBg: '#EFF6FF' },
    Card: { paddingLG: 20 },
    Table: { headerBg: '#F9FAFB', rowHoverBg: '#F3F6FB', cellPaddingBlock: 12 },
    Button: { fontWeight: 500 },
    Tabs: { horizontalMargin: '0' },
  },
};
