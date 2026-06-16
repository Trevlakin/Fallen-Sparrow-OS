import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { DATA_EVENTS } from "@/lib/eventBus";
import { formatCurrency, formatPercent, toDateInput } from "@/lib/format";
import { useCanViewFinancials } from "@/context/AuthContext";

interface ArtistPerf {
  artistId: string;
  artistName: string;
  totalRevenue: number;
  appointmentCount: number;
  avgBookingValue: number;
  shopMarginPercent: number;
}

export function ArtistsPage() {
  const canViewFinancials = useCanViewFinancials();
  const now = new Date();
  const [from, setFrom] = useState(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(toDateInput(now));
  const [artists, setArtists] = useState<ArtistPerf[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArtists = useCallback(() => {
    setLoading(true);
    void api
      .get<{ artists: ArtistPerf[] }>(`/api/artists/performance?from=${from}&to=${to}`)
      .then((res) => setArtists(res.artists))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  useEventBusRefresh([DATA_EVENTS.appointments, DATA_EVENTS.expenses], loadArtists);

  const sorted = [...artists].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="page">
      <h1>Artists</h1>
      <div className="date-filters">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {loading && <p className="text-muted">Loading...</p>}
      <div className="artist-grid">
        {sorted.map((artist, idx) => (
          <div key={artist.artistId} className="artist-card">
            <span className="rank-badge">{idx + 1}</span>
            <h3>{artist.artistName}</h3>
            {canViewFinancials && (
              <p className="value-amber">
                {formatCurrency(artist.totalRevenue)} revenue
              </p>
            )}
            <p>{artist.appointmentCount} appointments</p>
            <p>Avg booking {formatCurrency(artist.avgBookingValue)}</p>
            {canViewFinancials && (
              <p>Shop margin {formatPercent(artist.shopMarginPercent)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
