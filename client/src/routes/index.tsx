import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved">("active");
  // ADDED TIME
  const [time, setTime] = useState(new Date());
  const [sortBy, setSortBy] = useState<string>("createdAt_desc");
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [totalMarkets, setTotalMarkets] = useState(0);
  const sortedMarkets = [...markets].sort((a, b) => {
  switch (sortBy) {
    case "createdAt_desc":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "createdAt_asc":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "totalMarketBets_desc":
      return b.totalMarketBets - a.totalMarketBets;
    case "totalMarketBets_asc":
      return a.totalMarketBets - b.totalMarketBets;
    case "totalParticipants_desc":
      return b.totalParticipants - a.totalParticipants;
    case "totalParticipants_asc":
      return a.totalParticipants - b.totalParticipants;
    default:
      return 0;
  }});
  const totalPages = Math.ceil(sortedMarkets.length / limit);
  const paginatedMarkets = sortedMarkets.slice(page * limit, (page + 1) * limit);

  const loadMarkets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listMarkets(status, 0, 100);
      setMarkets(data.data);
      setTotalMarkets(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [status, page]);

  // Added SSE for live updates
  useEffect(() => {
    const es = new EventSource(`http://localhost:4001/api/markets/sse?status=${status}&page=${page}&limit=${limit}`);

    es.addEventListener("marketsUpdate", (event) => {
      const res = JSON.parse(event.data);
      setMarkets(prev => {
        // Merge updates into full list
        const updated = [...prev];
        res.data.forEach(newMarket => {
          const idx = updated.findIndex(m => m.id === newMarket.id);
          if (idx >= 0) updated[idx] = newMarket;
          else updated.push(newMarket);
        });
        return updated;
      });});

    es.onerror = () => es.close();
    return () => es.close();
  }, [status, page]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Prediction Markets</h1>
          <p className="text-gray-600 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Markets</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.username}!</p>
            {/* Added TIME */}
            <p className="text-sm text-black-500 mt-1">
              {time.toLocaleDateString("en-GB")} -- {time.toLocaleTimeString()}
            </p>
          </div>
              <div>
                <Button onClick={() => navigate({ to: "/auth/profile" })}>Profile</Button>
              </div>

              <div>
                <Button onClick={() => navigate({ to: "/auth/rankings" })}>Rankings</Button>
              </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
              Logout
            </Button>
            <Button onClick={() => navigate({ to: "/markets/new" })}>Create Market</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={status === "active" ? "default" : "outline"}
            onClick={() => setStatus("active")}
          >
            Active Markets
          </Button>
          <Button
            variant={status === "resolved" ? "default" : "outline"}
            onClick={() => setStatus("resolved")}
          >
            Resolved Markets
          </Button>
          <Button variant="outline" onClick={loadMarkets} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center space-x-2 mt-4">
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 0))}
            disabled={page === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="px-2 text-sm">
            Page {page + 1} of {totalPages}
          </span>

          <button
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {/* Sort by ... */}
        <div className="mb-6 flex gap-4 items-center">
          <label htmlFor="sort" className="mr-2 text-sm font-medium">Sort by:</label>
          <select
            id="sort"
            className="border rounded px-2 py-1"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt_desc">Date created (newest)</option>
            <option value="createdAt_asc">Date created (oldest)</option>
            <option value="totalMarketBets_desc">Total bet (high → low)</option>
            <option value="totalMarketBets_asc">Total bet (low → high)</option>
            <option value="totalParticipants_desc">Participants (high → low)</option>
            <option value="totalParticipants_asc">Participants (low → high)</option>
          </select>
        </div>

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg">
                  No {status} markets found. {status === "active" && "Create one to get started!"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
