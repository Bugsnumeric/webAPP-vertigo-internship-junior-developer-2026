const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved";
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
  totalParticipants: number;
  createdAt: string;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role?: "user" | "admin";
  token: string;
  balance?: number;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export interface Bettor {
  userId: number;
  username: string;
  amount: number;
}

export interface OutcomeWithBets extends MarketOutcome {
  position: number;
  bettors: Bettor[];
  totalAmount: number;
}

export interface MarketDetails extends Market {
  outcomes: OutcomeWithBets[];
  totalParticipants: number;
  totalVolume: number;
}

export interface ResolveMarketResponse {
  success: boolean;
  bet?: any;
  warning?: string;
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // Markets endpoints +
  async listMarkets(
  status: "active" | "resolved" = "active",
  offset = 0,
  limit = 20,
): Promise<{ data: Market[]; offset: number; limit: number; total: number }> {
  return this.request(`/api/markets?status=${status}&offset=${offset}&limit=${limit}`);
}


  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`);
  }

  async createMarket(title: string, description: string, outcomes: string[]): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes }),
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  // User endpoints
  async getProfile() {
    return this.request("/api/markets/me");
  }

  async getActiveBets() {
    return this.request("/api/markets/me/active-bets");
  }

  async getResolvedBets() {
    return this.request("/api/markets/me/resolved-bets");
  }

  async getMarketDetails(marketId: number): Promise<MarketDetails>  {
    return this.request(`/api/markets/details/${marketId}`);
  }

  async resolveMarket(marketId: number, winningOutcomeId: number): Promise<{
    success: boolean;
    marketId: number;
    winningOutcomeId: number;
    totalBetsResolved: number;
  }> {
    return this.request(`/api/markets/${marketId}/resolve-market`, {
      method: "POST",
      body: JSON.stringify({ winningOutcomeId }),
    });
  }

  async getRanking(): Promise<any[]> {
    return this.request('/api/markets/rankings');
  }
}

export const api = new ApiClient(API_BASE_URL);
