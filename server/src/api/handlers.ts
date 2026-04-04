import { eq, and, sql, ne } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import { hashPassword, verifyPassword, type AuthTokenPayload } from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash, role: "user" }).returning();

  const token = await jwt.sign({ userId: newUser[0].id, role: newUser[0].role });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    role: newUser[0].role,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id, role: user.role });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
      createdAt: new Date(),
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string; limit?: number; offset?: number; } }) {
  const statusFilter = query.status || "active";
  const limit = Number(query.limit || 20);
  const offset = Number(query.offset || 0);

  const markets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    limit,
    offset,
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  const enrichedMarkets = await Promise.all(
    markets.map(async (market) => {
      const betsPerOutcome = await Promise.all(
        market.outcomes.map(async (outcome) => {
          const totalBets = await db
            .select()
            .from(betsTable)
            .where(eq(betsTable.outcomeId, outcome.id));

          const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
          return { outcomeId: outcome.id, totalBets: totalAmount };
        }),
      );

      const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);
      // Added count for participants per market
      const participantsResult = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${betsTable.userId})`,
        })
        .from(betsTable)
        .where(eq(betsTable.marketId, market.id));

      const totalParticipants = participantsResult[0].count;
      
      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        outcomes: market.outcomes.map((outcome) => {
          const outcomeBets =
            betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
          const odds =
            totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcomeBets,
          };
        }),
        totalMarketBets,
        totalParticipants,
        createdAt: market.createdAt,
      };
    }),
  );

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(marketsTable)
    .where(eq(marketsTable.status, statusFilter));

  const total = totalResult[0]?.count ?? 0;

  return {
    data: enrichedMarkets,
    limit,
    offset,
    total,
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const parsedAmount = Number(amount);

  const errors = validateBet(amount);
  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  if (parsedAmount <= 0) {
    set.status = 400;
    return { error: "Bet amount must be positive" };
  }

  return await db.transaction(async (tx) => {
    const freshUser = await tx.query.usersTable.findFirst({
      where: eq(usersTable.id, user.id),
    });

    if (!freshUser || freshUser.balance < parsedAmount) {
      set.status = 400;
      return {
        error: "Insufficient balance",
        current: freshUser?.balance ?? 0,
        required: parsedAmount,
      };
    }

    const market = await tx.query.marketsTable.findFirst({
      where: eq(marketsTable.id, marketId),
    });

    if (!market) {
      set.status = 404;
      return { error: "Market not found" };
    }

    if (market.status !== "active") {
      set.status = 400;
      return { error: "Market is not active" };
    }

    const outcome = await tx.query.marketOutcomesTable.findFirst({
      where: and(
        eq(marketOutcomesTable.id, outcomeId),
        eq(marketOutcomesTable.marketId, marketId)
      ),
    });

    if (!outcome) {
      set.status = 404;
      return { error: "Outcome not found" };
    }

    const existingBet = await tx.query.betsTable.findFirst({
      where: (bets, { and, eq }) =>
        and(
          eq(bets.userId, user.id),
          eq(bets.marketId, marketId),
          eq(bets.outcomeId, outcomeId)
        ),
    });

    await tx
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${parsedAmount}`,
      })
      .where(eq(usersTable.id, user.id));

    if (existingBet) {
      const updated = await tx
        .update(betsTable)
        .set({
          amount: existingBet.amount + parsedAmount,
        })
        .where(eq(betsTable.id, existingBet.id))
        .returning();

      set.status = 200;
      return updated[0];
    }

    const bet = await tx
      .insert(betsTable)
      .values({
        userId: user.id,
        marketId,
        outcomeId,
        amount: parsedAmount,
      })
      .returning();

    set.status = 201;
    return bet[0];
  });
}

export async function handleGetProfile(userId: number) {
  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      won: sql<number>`
        SUM(CASE 
          WHEN ${betsTable.outcomeId} = ${marketsTable.resolvedOutcomeId} 
          THEN 1 ELSE 0 
        END)
      `,
      lost: sql<number>`
        SUM(CASE 
          WHEN ${marketsTable.resolvedOutcomeId} IS NOT NULL
          AND ${betsTable.outcomeId} != ${marketsTable.resolvedOutcomeId}
          THEN 1 ELSE 0 
        END)
      `,
    })
    .from(betsTable)
    .leftJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(eq(betsTable.userId, userId));

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  return {
    username: user?.username,
    balance: user?.balance ?? 0,
    totalBets: result[0].total,
    wonBets: result[0].won,
    lostBets: result[0].lost,
  };
}

export async function handleGetActiveBets(userId: number) {
  return db.query.betsTable.findMany({
    where: eq(betsTable.userId, userId),
    with: {
      market: true,
      outcome: true,
    },
  });
}

export async function handleGetResolvedBets(userId: number) {
  const bets = await db.query.betsTable.findMany({
    where: and(
      eq(betsTable.userId, userId),
      ne(betsTable.status, "pending")
    ),
    with: {
      market: true,
      outcome: true,
    },
  });

  const resolvedMarkets = new Map<number, { totalWinning: number; totalLosing: number; winningOutcomeId: number }>();

  for (const bet of bets) {
    const marketId = bet.marketId;

    if (!resolvedMarkets.has(marketId)) {
      const allBets = await db.query.betsTable.findMany({
        where: eq(betsTable.marketId, marketId),
      });

      const winningOutcomeId = bet.market?.resolvedOutcomeId;
      const totalWinning = allBets
        .filter(b => b.outcomeId === winningOutcomeId)
        .reduce((sum, b) => sum + b.amount, 0);

      const totalLosing = allBets
        .filter(b => b.outcomeId !== winningOutcomeId)
        .reduce((sum, b) => sum + b.amount, 0);

      resolvedMarkets.set(marketId, { totalWinning, totalLosing, winningOutcomeId: winningOutcomeId! });
    }
  }

  return bets.map((bet) => {
    const isWin = bet.status === "won";
    let payout = 0;
    let profit = -bet.amount;

    if (isWin) {
      const { totalWinning, totalLosing } = resolvedMarkets.get(bet.marketId)!;
      payout = bet.amount + (bet.amount / totalWinning) * totalLosing;
      profit = payout - bet.amount;
    }

    return {
      ...bet,
      payout,
      profit,
      result: bet.status,
    };
  });
}

export async function handleResolveMarket({ 
  params, 
  body, 
  set 
}: {
  params: { id: number };  // marketId
  body: { winningOutcomeId: number };
  set: { status: number };
}) {
  const marketId = params.id;
  const { winningOutcomeId } = body;

  // Get market
  const [market] = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.id, marketId))
    .limit(1);

  if (!market || market.status === "resolved") {
    set.status = 400;
    return { error: "Market not found or already resolved" };
  }

  // Get all bets for this market
  const bets = await db
    .select()
    .from(betsTable)
    .where(eq(betsTable.marketId, marketId));

  if (bets.length === 0) {
    set.status = 400;
    return { error: "No bets found" };
  }

  // Calculate payouts
  const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
  const winningBets = bets.filter(b => b.outcomeId === winningOutcomeId);
  const totalWinning = winningBets.reduce((sum, b) => sum + b.amount, 0);

  // Update each bet AND user balance
  for (const bet of bets) {
    const isWinner = bet.outcomeId === winningOutcomeId;
    const status = isWinner ? "won" : "lost";

    // Update bet status
    await db
      .update(betsTable)
      .set({ status })
      .where(eq(betsTable.id, bet.id));

    // Update winner's balance
    if (isWinner && totalWinning > 0) {
      const payout = (bet.amount / totalWinning) * totalPool;
      
      await db
        .update(usersTable)
        .set({ 
          balance: sql`${usersTable.balance} + ${payout}`
        })
        .where(eq(usersTable.id, bet.userId));
    }
  }

  // Mark market as resolved
  await db
    .update(marketsTable)
    .set({ status: "resolved", resolvedOutcomeId: winningOutcomeId })
    .where(eq(marketsTable.id, marketId));

  return { success: true, totalBetsResolved: bets.length };
}

export async function handleGetMarketDetails({ params, set }: {
  params: { id: number }
  set: { status: number }
}) {
  const { id } = params

  // Get market
  const [market] = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.id, id))
    .limit(1)

  if (!market) {
    set.status = 404
    return { error: 'Market not found' }
  }

  // Get outcomes
  const outcomes = await db.query.marketOutcomesTable.findMany({
    where: eq(marketOutcomesTable.marketId, id),
    orderBy: (outcomes, { asc }) => [asc(outcomes.position)],
  })

  // Get bets with user info for each outcome
  const outcomeDetails = await Promise.all(
    outcomes.map(async (outcome) => {
      const bets = await db
        .select({
          userId: betsTable.userId,
          username: usersTable.username,
          amount: betsTable.amount,
        })
        .from(betsTable)
        .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
        .where(eq(betsTable.outcomeId, outcome.id))

      return {
        id: outcome.id,
        title: outcome.title,
        position: outcome.position,
        totalBets: bets.length,
        totalAmount: bets.reduce((sum, b) => sum + b.amount, 0),
        bettors: bets,
      }
    })
  )

  // Get total participants
  const participants = await db
    .selectDistinct({ userId: betsTable.userId })
    .from(betsTable)
    .where(eq(betsTable.marketId, id))

  // Get total volume
  const volume = await db
    .select({ total: sql<number>`SUM(${betsTable.amount})` })
    .from(betsTable)
    .where(eq(betsTable.marketId, id))

  return {
    ...market,
    outcomes: outcomeDetails,
    totalParticipants: participants.length,
    totalVolume: volume[0]?.total ?? 0,
  }
}

export async function handleGetRankings() {
  const result = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      wins: sql<number>`
        SUM(CASE 
          WHEN ${betsTable.status} = 'won' THEN 1 
          ELSE 0 
        END)
      `,
    })
    .from(usersTable)
    .leftJoin(betsTable, eq(usersTable.id, betsTable.userId))
    .groupBy(usersTable.id);

  return result
    .sort((a, b) => b.wins - a.wins)
    .map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
}

