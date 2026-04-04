import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export const Route = createFileRoute('/auth/rankings')({
  component: RouteComponent,
})

function RouteComponent() {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    api.getRanking().then((data) => {
      const sorted = [...data].sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
      setUsers(sorted)
    })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Rankings</h1>

      <table className="table-auto border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-4 py-2">Rank</th>
            <th className="border px-4 py-2">Username</th>
            <th className="border px-4 py-2">Wins</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.id}>
              <td className="border px-4 py-2">{index + 1}</td>
              <td className="border px-4 py-2">{user.username}</td>
              <td className="border px-4 py-2">{user.wins ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
