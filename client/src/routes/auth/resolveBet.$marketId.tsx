import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/auth/resolveBet/$marketId')({
  component: RouteComponent,
})

type OutcomeDetail = {
  id: number
  title: string
  position: number
  totalBets: number
  totalAmount: number
  uniqueParticipants: number
  bettors: Array<{ userId: number; username: string; amount: number }>
}

type MarketDetails = {
  id: number
  title: string
  description?: string
  status: 'active' | 'resolved'
  totalParticipants: number
  totalVolume: number
  totalBets: number
  outcomes: OutcomeDetail[]
}

function RouteComponent() {
  const { marketId } = useParams({ from: '/auth/resolveBet/$marketId' })
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  
  const [market, setMarket] = useState<MarketDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvingOutcomeId, setResolvingOutcomeId] = useState<number | null>(null)
  const [adminHasBets, setAdminHasBets] = useState(false)
  const [adminBetDetails, setAdminBetDetails] = useState<{ outcomeTitle: string; amount: number } | null>(null)


  // Redirect non-admins
  useEffect(() => {
    if (user && !isAdmin) {
      navigate({ to: '/' })
    }
  }, [user, isAdmin, navigate])

  // Fetch market details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true)
        setError(null)
        const id = Number(marketId)
        if (isNaN(id)) throw new Error('Invalid market ID')
        
        const data = await api.getMarketDetails(id)
        
        // Calculate stats from outcomes
        const totalBets = data.outcomes.reduce((sum, o) => sum + o.totalBets, 0)
        const totalVolume = data.outcomes.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        const allUserIds = data.outcomes.flatMap(o => o.bettors.map(b => b.userId))
        const totalParticipants = new Set(allUserIds).size
        
        const outcomesWithStats = data.outcomes.map(outcome => ({
          ...outcome,
          uniqueParticipants: new Set(outcome.bettors.map(b => b.userId)).size,
        }))
        
        setMarket({
          ...data,
          totalBets,
          totalVolume,
          totalParticipants,
          outcomes: outcomesWithStats,
        })

        if (user?.id && isAdmin) {
          const allUserBets = await api.getActiveBets()
          const adminBetsOnMarket = allUserBets.filter(
            (bet: any) => bet.marketId === id
          )
          
          if (adminBetsOnMarket.length > 0) {
            setAdminHasBets(true)
            const firstBet = adminBetsOnMarket[0]
            const outcome = data.outcomes.find(o => o.id === firstBet.outcomeId)
            setAdminBetDetails({
              outcomeTitle: outcome?.title || 'Unknown',
              amount: firstBet.amount,
            })
          }
        }

      } catch (err: any) {
        console.error('Failed to fetch market details:', err)
        setError(err.message || 'Failed to load market')
      } finally {
        setLoading(false)
      }
    }

    if (marketId && isAdmin) {
      fetchDetails()
    }
  }, [marketId, isAdmin, user?.id])

  const handleResolveMarket = async (winningOutcomeId: number) => {
    const outcome = market?.outcomes.find(o => o.id === winningOutcomeId);
    if (!outcome) return;
    
    if (!confirm(`Mark "${outcome.title}" as winner?`)) return;

    try {
      setResolvingOutcomeId(winningOutcomeId);
      
      await api.resolveMarket(Number(marketId), winningOutcomeId);
      
      alert('✅ Market resolved!');
      setMarket(prev => prev ? { ...prev, status: 'resolved' } : null);
      setTimeout(() => navigate({ to: '/' }), 1500);
      
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setResolvingOutcomeId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button className="mt-4" onClick={() => navigate({ to: '/' })}>
              ← Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Market Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The market you're looking for doesn't exist or couldn't be loaded.
            </p>
            <Button onClick={() => navigate({ to: '/' })}>
              ← Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only admins can access this page.</p>
        <Button className="mt-4" onClick={() => navigate({ to: '/' })}>
          Go to Markets
        </Button>
      </div>
    )
  }
  
  if (adminHasBets && isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You can't resolve a market you are part of.</p>
        <Button className="mt-4" onClick={() => navigate({ to: '/' })}>
          Go to Markets
        </Button>
      </div>
    )
  }
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🛡️ Admin: Resolve Market</h1>
          <p className="text-muted-foreground">{market.title}</p>
        </div>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          ← Back to Markets
        </Button>
      </div>

      {/* Market Info */}
      <Card>
        <CardHeader>
          <CardTitle>{market.title}</CardTitle>
          <CardDescription>{market.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Total Participants" value={market.totalParticipants} icon="👥" />
            <StatBox label="Total Bets" value={market.totalBets} icon="🎲" />
            <StatBox label="Total Volume" value={`$${market.totalVolume?.toFixed(2) ?? '0.00'}`} icon="💰" />
          </div>
          <div className="mt-4">
            <Badge variant={market.status === 'active' ? 'default' : 'secondary'}>
              Status: {market.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {market.status !== 'active' ? (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-6 text-center">
            <p className="text-yellow-800 font-medium text-lg">
              ⚠️ This market is not active
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Current status: <strong>{market.status}</strong>
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate({ to: '/' })}>
              ← Back to Markets
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Show outcomes with resolve buttons */
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Select Winning Outcome</h2>
          
          {market.outcomes.map((outcome) => (
            <OutcomeCard
              key={outcome.id}
              outcome={outcome}
              onResolve={() => handleResolveMarket(outcome.id)}
              isResolving={resolvingOutcomeId === outcome.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon?: string }) {
  return (
    <div className="p-4 bg-muted rounded-lg text-center">
      <span className="text-2xl mb-1 block">{icon}</span>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function OutcomeCard({ 
  outcome, 
  onResolve, 
  isResolving 
}: { 
  outcome: OutcomeDetail
  onResolve: () => void
  isResolving: boolean
}) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{outcome.title}</CardTitle>
          <Badge variant="outline">
            {outcome.totalBets} bets • ${outcome.totalAmount?.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Unique Bettors</p>
            <p className="text-lg font-bold">{outcome.uniqueParticipants}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Total Bets</p>
            <p className="text-lg font-bold">{outcome.totalBets}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold text-green-600">${outcome.totalAmount?.toFixed(2)}</p>
          </div>
        </div>

        {/* Bettors List */}
        {outcome.bettors.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
              View bettors ({outcome.bettors.length})
            </summary>
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {outcome.bettors.map((bettor) => (
                <div key={bettor.userId} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                  <span>{bettor.username}</span>
                  <span className="font-medium">${bettor.amount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <Button
          onClick={onResolve}
          disabled={isResolving}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {isResolving ? '⏳ Resolving...' : `✓ Mark "${outcome.title}" as Winner`}
        </Button>
      </CardContent>
    </Card>
  )
}