"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthTest() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (status === "unauthenticated") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Not Authenticated</CardTitle>
          <CardDescription>You need to login first</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = "/login2"}>
            Go to Login2
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Auth Test - Success!</CardTitle>
        <CardDescription>You are authenticated</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <strong>Email:</strong> {session?.user?.email}
          </div>
          <div>
            <strong>Name:</strong> {session?.user?.name}
          </div>
          <div>
            <strong>JWT:</strong> {session?.jwt ? "Present" : "Not present"}
          </div>
          <Button onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}