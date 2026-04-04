import { Elysia, t, sse } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet,
          handleGetProfile, handleGetActiveBets, handleGetResolvedBets,
          handleResolveMarket, handleGetMarketDetails, handleGetRankings } from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      offset: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
    }),
  })
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .post("/", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        }),
  )
  // Added SSE for live updates
  .get("/sse", async function* ({ query }) {
  while (true) {
    try {
      const page = Number(query?.page || 0);
      const limit = Number(query?.limit || 20);
      const status = query?.status || "active";
      const offset = page * limit;

      const res = await handleListMarkets({ 
        query: { status, offset, limit } 
      });
      
      yield sse({ event: "marketsUpdate", data: JSON.stringify(res) });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (err) {
      console.error("SSE error:", err);
      break;
    }
  }
}, {
  query: t.Object({
    status: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
  }),
})

.get("/me", async ({ user }) => {
  return handleGetProfile(user.id);
})

.get("/me/active-bets", async ({ user }) => {
  const bets = await handleGetActiveBets(user.id);
  return bets.filter(b => b.market.status === "active");
})

.get("/me/resolved-bets", async ({ user }) => {
  const bets = await handleGetResolvedBets(user.id);
  return bets.filter(b => b.market.status === "resolved");
})

.guard(
    {
      beforeHandle({ user, set }) {
        if (!user || user.role !== "admin") {
          set.status = 403;
          return { error: "Admin access required" };
        }
      },
    },
    (app) =>
      app.post(
        "/:id/resolve-market",
        handleResolveMarket,
        {
          params: t.Object({ id: t.Numeric() }),
          body: t.Object({
            winningOutcomeId: t.Numeric(),
          }),
        }
      )
  )

  .get("/details/:id", handleGetMarketDetails, {
  params: t.Object({ id: t.Numeric() }),
})

.get("/rankings", handleGetRankings);
