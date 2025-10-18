import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckSquare, Image, UtensilsCrossed, Zap, FileText } from 'lucide-react'

const activities = [
  {
    title: 'Todo List',
    description: 'Manage your tasks with a simple and efficient todo list',
    icon: CheckSquare,
    href: '/todos',
  },
  {
    title: 'Google Drive Lite',
    description: 'Store and manage your photos with search and sort features',
    icon: Image,
    href: '/photos',
  },
  {
    title: 'Food Review',
    description: 'Share food photos and write reviews',
    icon: UtensilsCrossed,
    href: '/food-review',
  },
  {
    title: 'Pokemon Review',
    description: 'Search for Pokemon and share your reviews',
    icon: Zap,
    href: '/pokemon-review',
  },
  {
    title: 'Markdown Notes',
    description: 'Create and manage notes with Markdown support',
    icon: FileText,
    href: '/notes',
  },
]

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Welcome to Activities App</h1>
      <p className="text-gray-600 mb-8">Choose an activity to get started</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.map((activity) => (
          <Link key={activity.href} href={activity.href}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <activity.icon className="h-10 w-10 mb-2 text-blue-500" />
                <CardTitle>{activity.title}</CardTitle>
                <CardDescription>{activity.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}