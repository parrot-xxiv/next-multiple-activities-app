'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Trash2 } from 'lucide-react'

type Todo = {
  id: string
  title: string
  completed: boolean
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), [])

  const fetchTodos = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setTodos([])
      return
    }

    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch todos', error.message)
      return
    }

    setTodos(data ?? [])
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('todos')
      .insert({ title: newTodo.trim(), user_id: user.id })

    if (!error) {
      setNewTodo('')
      fetchTodos()
    } else {
      console.error('Failed to create todo', error.message)
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)

    if (error) {
      console.error('Failed to toggle todo', error.message)
      return
    }

    fetchTodos()
  }

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete todo', error.message)
      return
    }

    fetchTodos()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Todo List</h1>
      <form onSubmit={addTodo} className="flex gap-2 mb-6">
        <Input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo..."
          className="flex-1"
        />
        <Button type="submit">Add</Button>
      </form>
      <div className="space-y-2">
        { isLoading ? <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks...
        </div> : todos.length ? todos.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
          >
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
            />
            <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
              {todo.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteTodo(todo.id)}
              className="text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )) : <span className='text-sm'>No todos available.</span>}
      </div>
    </div>
  )
}
