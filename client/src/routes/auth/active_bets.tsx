import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, Bet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute('/auth/active_bets')({
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
      const data = await api.getActiveBets()
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

  if (isLoading) return <p>Loading active bets...</p>
  if (error) return <p className="text-red-500">{error}</p>
  if (bets.length === 0) return <p>No active bets found.
    <p>
    <Button onClick={() => navigate({ to: "/markets/new" })}>Bet now</Button>
    </p>
    <p>
      <Button onClick={() => navigate({ to: "/" })}>See markets</Button>
    </p>
  </p>

  const start = page * limit
  const end = start + limit
  const paginatedBets = bets.slice(start, end)

  return (
    <div className="p-8">
      <Button onClick={() => navigate({ to: "/" })}>Go to markets!</Button>
      <h1 className="text-2xl font-bold mb-4">Your Active Bets</h1>

      <ul className="space-y-2">
        {paginatedBets.map((bet) => (
          <li key={bet.id} className="p-2 border rounded">
            <strong>{bet.market.title}</strong> <p></p> ${bet.amount} on outcome <strong>{bet.outcome.title}</strong> <br />
            Placed at: {new Date(bet.createdAt).toLocaleDateString("en-GB")} -- {new Date(bet.createdAt).toLocaleTimeString()}
          </li>
        ))}
      </ul>

      {/* Pagination */}
      <div className="flex items-center gap-2 mt-4">
        <Button
          onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
          disabled={page === 0}
        >
          Prev
        </Button>

        <span>
          Page {page + 1} of {totalPages}
        </span>

        <Button
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
          disabled={page >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
