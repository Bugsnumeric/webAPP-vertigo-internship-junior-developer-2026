import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, Bet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute('/auth/resolved_bets')({
  component: RouteComponent,
})

function RouteComponent() {
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const limit = 10
  const [totalBets, setTotalBets] = useState(0)
  const navigate = useNavigate()

  const totalPages = Math.ceil(totalBets / limit)

  const loadBets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.getResolvedBets()
      setBets(data.data ?? data)
      setTotalBets(data.total ?? data.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bets')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBets()
  }, [page])

  if (isLoading) return <div className="p-8"><p>Loading resolved bets...</p></div>
  if (error) return <div className="p-8"><p className="text-red-500">{error}</p></div>
  if (bets.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>✅ Resolved Bets</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">No resolved bets found.</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate({ to: "/" })}>
                Browse Markets
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/markets/new" })}>
                Create Market
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const start = page * limit
  const end = start + limit
  const paginatedBets = bets.slice(start, end)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Button  onClick={() => navigate({ to: "/" })}>
                Go to markets!
              </Button>
      <h1 className="text-2xl font-bold mb-4">✅ Your Resolved Bets</h1>
      <p className="text-muted-foreground mb-6">{totalBets} total bets</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedBets.map((bet) => (
          <BetCard key={bet.id} bet={bet} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={page === 0}
            variant="outline"
            size="sm"
          >
            Prev
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>

          <Button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function BetCard({ bet }: { bet: Bet }) {
  const isWin = bet.status === 'won'
  const isLoss = bet.status === 'lost' || bet.result === 'lost'
  
  return (
    <Card className={`border-l-4 ${isWin ? 'border-l-green-500' : isLoss ? 'border-l-red-500' : 'border-l-gray-500'}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg line-clamp-2">{bet.market?.title || bet.marketTitle}</CardTitle>

          <StatusIndicator won={isWin} />
          
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Outcome:</span>
          <span className="font-medium">{bet.outcome?.title || bet.outcome}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Stake:</span>
          <span className="font-semibold">${bet.amount?.toFixed(2)}</span>
        </div>

        {!isWin && <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Lost:</span>
          <span className={`font-semibold ${'text-red-600'}`}>
          ${bet.profit.toFixed(2)}
          </span>
        </div>}
        
        {isWin && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payout:</span>
            <span className="font-semibold text-green-600">+${bet.payout.toFixed(2)}</span>
          </div>
        )}

        {isWin && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Profit:</span>
            <span className="font-semibold text-green-600">+${bet.profit.toFixed(2)}</span>
          </div>
        )}
        
        <div className="pt-2 border-t text-xs text-muted-foreground">
          {new Date(bet.createdAt || bet.placedAt).toLocaleDateString("en-GB")} 
          {' • '} 
          {new Date(bet.createdAt || bet.placedAt).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIndicator({ won }: { won: boolean }) {
  if (won) {
    return (
      <div 
        className="w-8 h-8 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center 
                   border border-green-300 dark:border-green-700"
        title="Won"
      >
        <svg 
          className="w-5 h-5 text-green-600 dark:text-green-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      </div>
    )
  }
  
  return (
    <div 
      className="w-8 h-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center 
                 border border-red-300 dark:border-red-700"
      title="Lost"
    >
      <svg 
        className="w-5 h-5 text-red-600 dark:text-red-400" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2.5} 
          d="M6 18L18 6M6 6l12 12" 
        />
      </svg>
    </div>
  )
}