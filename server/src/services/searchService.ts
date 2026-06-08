import * as searchRepo from "../repos/searchRepo.js";

export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 120;

export type SearchResultType = "appointment" | "expense" | "customer" | "artist";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

export interface GlobalSearchResponse {
  query: string;
  results: SearchResultItem[];
  groups: {
    appointments: SearchResultItem[];
    expenses: SearchResultItem[];
    customers: SearchResultItem[];
    artists: SearchResultItem[];
  };
}

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
}

export function isSearchQueryValid(query: string): boolean {
  return query.length >= MIN_SEARCH_QUERY_LENGTH;
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthRange(date: Date): { from: string; to: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  return { from: formatDateYmd(from), to: formatDateYmd(to) };
}

function mapAppointment(row: searchRepo.AppointmentSearchRow): SearchResultItem {
  const range = formatMonthRange(row.appointmentDate);
  const params = new URLSearchParams({ from: range.from, to: range.to });
  const serviceLabel = row.serviceType.replace(/_/g, " ");
  const title = row.customerName
    ? `${row.customerName} · ${serviceLabel}`
    : serviceLabel;
  const subtitleParts = [
    formatDateYmd(row.appointmentDate),
    row.artistName ?? undefined,
    row.totalRevenue > 0 ? `$${row.totalRevenue.toFixed(2)}` : undefined,
  ].filter(Boolean);

  return {
    id: row.id,
    type: "appointment",
    title,
    subtitle: subtitleParts.join(" · "),
    href: `/appointments?${params.toString()}`,
  };
}

function mapExpense(row: searchRepo.ExpenseSearchRow): SearchResultItem {
  const date = formatDateYmd(row.expenseDate);
  const params = new URLSearchParams({
    expenseDesc: row.description,
    expenseDate: date,
  });
  return {
    id: row.id,
    type: "expense",
    title: row.description,
    subtitle: `${date} · ${row.category} · $${row.amount.toFixed(2)}`,
    href: `/pnl?${params.toString()}`,
  };
}

function mapCustomer(row: searchRepo.CustomerSearchRow): SearchResultItem {
  const subtitleParts = [row.email, row.phone].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return {
    id: row.id,
    type: "customer",
    title: row.name,
    subtitle: subtitleParts.join(" · ") || "Customer",
    href: "/customers",
  };
}

function mapArtist(row: searchRepo.ArtistSearchRow): SearchResultItem {
  return {
    id: row.id,
    type: "artist",
    title: row.name,
    subtitle: "Artist",
    href: "/artists",
  };
}

export async function globalSearch(
  rawQuery: string,
  options: { includeExpenses: boolean },
): Promise<GlobalSearchResponse> {
  const query = normalizeSearchQuery(rawQuery);
  const empty: GlobalSearchResponse = {
    query,
    results: [],
    groups: {
      appointments: [],
      expenses: [],
      customers: [],
      artists: [],
    },
  };

  if (!isSearchQueryValid(query)) {
    return empty;
  }

  const [appointmentRows, expenseRows, customerRows, artistRows] = await Promise.all([
    searchRepo.searchAppointments(query),
    options.includeExpenses ? searchRepo.searchExpenses(query) : Promise.resolve([]),
    searchRepo.searchCustomers(query),
    searchRepo.searchArtists(query),
  ]);

  const groups = {
    appointments: appointmentRows.map(mapAppointment),
    expenses: expenseRows.map(mapExpense),
    customers: customerRows.map(mapCustomer),
    artists: artistRows.map(mapArtist),
  };

  return {
    query,
    results: [
      ...groups.appointments,
      ...groups.expenses,
      ...groups.customers,
      ...groups.artists,
    ],
    groups,
  };
}
