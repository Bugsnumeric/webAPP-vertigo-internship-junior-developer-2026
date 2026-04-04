import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute('/auth/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const [profile, setProfile] = useState<any>(null)
  const [activeBets, setActiveBets] = useState<any[]>([])
  const [resolvedBets, setResolvedBets] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.getProfile().then(setProfile)
    api.getActiveBets().then(setActiveBets)
    api.getResolvedBets().then(setResolvedBets)
  }, [])
  
  if (!profile) return <p>Loading profile...</p>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{profile.username}'s Profile</h1>

      <section className="mt-4">
        <h2 className="font-semibold">Stats</h2>
        <p>Winning bets: {profile.wonBets ?? 0}</p>
        <p>Losing bets: {profile.lostBets ?? 0}</p>
        <p>Total balance: ${profile.balance.toFixed(2) ?? 0}</p>
      </section>

      <section className="mt-4">
        <Button onClick={() => navigate({ to: "/auth/active_bets" })}>See active bets</Button>
      </section>

      <section className="mt-4">
        <Button onClick={() => navigate({ to: "/auth/resolved_bets" })}>See resolved bets</Button>
      </section>
    </div>
  )
}
