'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Eye, Code, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Note = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchNotes = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setNotes([])
      return
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch notes', error.message)
      return
    }
    setIsLoading(false)
    setNotes(data ?? [])
  }, [supabase])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const saveNote = async () => {
    if (!title.trim() || !content.trim()) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    if (isEditing && selectedNote) {
      const { error } = await supabase
        .from('notes')
        .update({
          title,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNote.id)
      if (error) {
        console.error('Failed to update note', error.message)
        return
      }
    } else {
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
      })
      if (error) {
        console.error('Failed to create note', error.message)
        return
      }
    }

    setTitle('')
    setContent('')
    setIsEditing(false)
    setSelectedNote(null)
    setDialogOpen(false)
    fetchNotes()
  }

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete note', error.message)
      return
    }

    fetchNotes()
  }

  const openEditDialog = (note: Note) => {
    setSelectedNote(note)
    setTitle(note.title)
    setContent(note.content)
    setIsEditing(true)
    setDialogOpen(true)
  }

  const openNewDialog = () => {
    setSelectedNote(null)
    setTitle('')
    setContent('')
    setIsEditing(false)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Markdown Notes</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setSelectedNote(null)
              setTitle('')
              setContent('')
              setIsEditing(false)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>Create Note</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Note' : 'Create Note'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
              />
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">
                    <Code className="h-4 w-4 mr-2" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your note in Markdown..."
                    className="min-h-[400px] font-mono"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="border rounded-lg p-4 min-h-[400px] prose max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
              <Button onClick={saveNote} className="w-full">
                {isEditing ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (<div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes...
        </div>) : notes.length ? notes.map((note) => (
          <div key={note.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
            <h3 className="font-semibold text-lg mb-2 truncate">{note.title}</h3>
            <div className="text-sm text-gray-600 mb-3 line-clamp-3">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>Updated: {new Date(note.updated_at).toLocaleDateString()}</span>
            </div>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{note.title}</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="preview">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </TabsTrigger>
                      <TabsTrigger value="raw">
                        <Code className="h-4 w-4 mr-2" />
                        Raw
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview">
                      <div className="prose max-w-none p-4">
                        <ReactMarkdown>{note.content}</ReactMarkdown>
                      </div>
                    </TabsContent>
                    <TabsContent value="raw">
                      <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{note.content}</code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={() => openEditDialog(note)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteNote(note.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )) : 'No notes. Create one.' }
      </div>
    </div>
  )
}
