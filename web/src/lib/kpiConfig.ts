export const KPI_CONFIG_KEY = "fs_kpi_config";

export interface KpiConfig {
  totalRevenue: boolean;
  growthRate: boolean;
  shopMargin: boolean;
  avgBookingValue: boolean;
  ytdRevenue: boolean;
  annualProjection: boolean;
  profitAfterPayouts: boolean;
  totalAppointments: boolean;
  avgBookingValueArtist: boolean;
  artistAnalytics: boolean;
  artistRankings: boolean;
  servicePerformance: boolean;
  clientIntelligence: boolean;
  appointmentVolume: boolean;
}

export const DEFAULT_KPI_CONFIG: KpiConfig = {
  totalRevenue: true,
  growthRate: true,
  shopMargin: true,
  avgBookingValue: true,
  ytdRevenue: true,
  annualProjection: true,
  profitAfterPayouts: true,
  totalAppointments: true,
  avgBookingValueArtist: true,
  artistAnalytics: true,
  artistRankings: true,
  servicePerformance: true,
  clientIntelligence: true,
  appointmentVolume: true,
};

export function loadKpiConfig(): KpiConfig {
  try {
    const raw = localStorage.getItem(KPI_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_KPI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<KpiConfig>;
    return { ...DEFAULT_KPI_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_KPI_CONFIG };
  }
}

export function saveKpiConfig(config: KpiConfig): void {
  localStorage.setItem(KPI_CONFIG_KEY, JSON.stringify(config));
}

export const REVENUE_METRICS: Array<{
  key: keyof KpiConfig;
  label: string;
  description: string;
}> = [
  { key: "totalRevenue", label: "Total Revenue", description: "Shows your total appointment income" },
  { key: "growthRate", label: "Growth Rate", description: "Compares current period to previous periods" },
  { key: "shopMargin", label: "Shop Margin %", description: "Shows profit percentage after artist payouts" },
  { key: "avgBookingValue", label: "Average Booking Value", description: "Average income per appointment" },
  { key: "ytdRevenue", label: "Year-to-Date Revenue", description: "Year-to-date total revenue" },
  { key: "annualProjection", label: "Annual Projection", description: "Estimated full-year revenue based on current data" },
  { key: "profitAfterPayouts", label: "Profit After Payouts", description: "Net profit remaining after artist payouts and expenses" },
];

export const ARTIST_METRICS: Array<{
  key: keyof KpiConfig;
  label: string;
  description: string;
}> = [
  { key: "totalAppointments", label: "Total Appointments", description: "Total number of appointments this period" },
  { key: "avgBookingValueArtist", label: "Average Booking Value", description: "Average per appointment across all artists" },
  { key: "artistAnalytics", label: "Artist Analytics", description: "Individual artist rankings (10 artists tracked)" },
  { key: "artistRankings", label: "Artist Rankings Section", description: "Full artist performance rankings panel" },
];

export const SERVICE_METRICS: Array<{
  key: keyof KpiConfig;
  label: string;
  description: string;
}> = [
  { key: "servicePerformance", label: "Service Performance Section", description: "Complete service breakdown with profit margins" },
  { key: "clientIntelligence", label: "Client Intelligence Section", description: "Clients ranked by total spend with profiles" },
  { key: "appointmentVolume", label: "Appointment Volume", description: "Total appointments in selected period" },
];
