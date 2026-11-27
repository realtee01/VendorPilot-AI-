import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardPeriod, NavSection, Product, SalesRange } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { useTheme } from '../context/ThemeContext';
import {
  buildRevenueGrowthSeries,
  buildSalesPerformanceSeries,
  calculateDashboardMetrics,
  filterRecordsByPeriod,
  getTopSellingProducts,
} from '../utils/analytics';
import {
  buildDashboardReportCsv,
  buildDashboardReportFilename,
  triggerCsvDownload,
} from '../utils/reportCsv';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarSeed,
  getUserAvatarUrl,
  getUserInitials,
} from '../utils/avatars';
import { GlassBusinessDashboard } from './ui/glass-business-dashboard';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickRestock: (product: Product) => void;
}

export function DashboardView({ onNavigate, onQuickRestock }: DashboardViewProps) {
  const { user, state, lowStockProducts } = useBusiness();
  const { theme } = useTheme();
  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [range, setRange] = useState<SalesRange>('30d');
  const [downloaded, setDownloaded] = useState(false);
  const downloadTimerRef = useRef<number | null>(null);
  const symbol = state.settings.currencySymbol || '₦';

  const ownerRawName = state.settings.ownerName || user?.displayName || '';
  const ownerEmail = state.settings.email || user?.email || '';
  const firstName = extractFirstName(ownerRawName, ownerEmail);
  const fullName = formatDisplayName(ownerRawName, ownerEmail);
  const initials = getUserInitials(ownerRawName, ownerEmail);
  const avatarSeed = getUserAvatarSeed(ownerRawName, ownerEmail, user?.uid);
  const avatarUrl = getUserAvatarUrl(ownerRawName, ownerEmail, user?.uid);
  const isFreshWorkspace =
    state.sales.length === 0 && state.expenses.length === 0 && state.products.length === 0;

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current !== null) {
        window.clearTimeout(downloadTimerRef.current);
      }
    };
  }, []);

  const handlePeriodChange = (nextPeriod: DashboardPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'daily' || nextPeriod === 'weekly') {
      setRange('7d');
    } else if (nextPeriod === 'monthly') {
      setRange('30d');
    } else {
      setRange('6m');
    }
  };

  const periodData = useMemo(
    () => filterRecordsByPeriod(state.sales, state.expenses, period),
    [state.sales, state.expenses, period]
  );

  const periodMetrics = useMemo(
    () => calculateDashboardMetrics(periodData.sales, periodData.expenses, state.products),
    [periodData.sales, periodData.expenses, state.products]
  );

  const periodTopProducts = useMemo(
    () => getTopSellingProducts(periodData.sales, 5),
    [periodData.sales]
  );

  const chartData = useMemo(
    () => buildSalesPerformanceSeries(state.sales, state.expenses, range),
    [state.sales, state.expenses, range]
  );

  const revenueGrowth = useMemo(
    () => buildRevenueGrowthSeries(state.sales, state.expenses, range),
    [state.sales, state.expenses, range]
  );

  const recentSales = useMemo(() => periodData.sales.slice(0, 6), [periodData.sales]);

  const handleDownloadReport = () => {
    const now = new Date();
    const csv = buildDashboardReportCsv({
      settings: state.settings,
      period,
      periodLabel: periodData.periodLabel,
      chartRange: range,
      metrics: periodMetrics,
      chartData,
      topProducts: periodTopProducts,
      sales: periodData.sales,
      expenses: periodData.expenses,
      lowStockProducts,
      generatedAt: now,
    });
    const filename = buildDashboardReportFilename(state.settings.businessName, period, now);
    triggerCsvDownload(csv, filename);

    setDownloaded(true);
    if (downloadTimerRef.current !== null) {
      window.clearTimeout(downloadTimerRef.current);
    }
    downloadTimerRef.current = window.setTimeout(() => {
      setDownloaded(false);
      downloadTimerRef.current = null;
    }, 2500);
  };

  return (
    <GlassBusinessDashboard
      theme={theme}
      businessName={state.settings.businessName}
      businessType={state.settings.businessType}
      currencyCode={state.settings.currencyCode}
      currencySymbol={symbol}
      firstName={firstName}
      fullName={fullName}
      initials={initials}
      avatarSeed={avatarSeed}
      avatarUrl={avatarUrl}
      isFreshWorkspace={isFreshWorkspace}
      preferredGoal={state.settings.primaryGoal}
      period={period}
      periodLabel={periodData.periodLabel}
      onPeriodChange={handlePeriodChange}
      range={range}
      onRangeChange={setRange}
      metrics={periodMetrics}
      expenseCount={periodData.expenses.length}
      chartData={chartData}
      revenueGrowth={revenueGrowth}
      lowStockProducts={lowStockProducts}
      recentSales={recentSales}
      topProducts={periodTopProducts}
      downloaded={downloaded}
      onDownloadReport={handleDownloadReport}
      onNavigate={onNavigate}
      onQuickRestock={onQuickRestock}
    />
  );
}
