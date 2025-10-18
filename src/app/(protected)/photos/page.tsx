'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Search, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Photo = {
  id: string
  name: string
  url: string
  storage_path: string
  created_at: string
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date')
  const [uploading, setUploading] = useState(false)
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [editingName, setEditingName] = useState('')
  const supabase = useMemo(() => createClient(), [])

  const fetchPhotos = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setPhotos([])
      return
    }

    const orderColumn = sortBy === 'name' ? 'name' : 'created_at'
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order(orderColumn, { ascending: sortBy === 'name' })

    if (error) {
      console.error('Failed to fetch photos', error.message)
      return
    }

    setPhotos(data ?? [])
    setIsLoading(false)
  }, [sortBy, supabase])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploading(true)

    const file = e.target.files[0]
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setUploading(false)
      return
    }

    const fileExt = file.name.split('.').pop()
    const fileName = fileExt ? `${crypto.randomUUID()}.${fileExt}` : crypto.randomUUID()
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file)

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(filePath)

      const { error: insertError } = await supabase.from('photos').insert({
        user_id: user.id,
        name: file.name.trim() || 'Untitled Photo',
        url: publicUrl,
        storage_path: filePath,
      })

      if (insertError) {
        console.error('Failed to save photo metadata', insertError.message)
      } else {
        fetchPhotos()
      }
    } else {
      console.error('Failed to upload photo', uploadError.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  const deletePhoto = async (photo: Photo) => {
    const { error: storageError } = await supabase.storage.from('photos').remove([photo.storage_path])

    if (storageError) {
      console.error('Failed to delete photo from storage', storageError.message)
      return
    }

    const { error } = await supabase.from('photos').delete().eq('id', photo.id)

    if (error) {
      console.error('Failed to delete photo record', error.message)
      return
    }

    if (editingPhotoId === photo.id) {
      setEditingPhotoId(null)
      setEditingName('')
    }

    fetchPhotos()
  }

  const startEditingPhoto = (photo: Photo) => {
    setEditingPhotoId(photo.id)
    setEditingName(photo.name)
  }

  const cancelEditing = () => {
    setEditingPhotoId(null)
    setEditingName('')
  }

  const savePhotoName = async () => {
    if (!editingPhotoId || !editingName.trim()) return

    const { error } = await supabase
      .from('photos')
      .update({ name: editingName.trim() })
      .eq('id', editingPhotoId)

    if (error) {
      console.error('Failed to rename photo', error.message)
      return
    }

    cancelEditing()
    fetchPhotos()
  }

  const filteredPhotos = photos.filter((photo) =>
    photo.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Google Drive Lite</h1>
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search photos..."
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(value: 'name' | 'date') => setSortBy(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="date">Sort by Date</SelectItem>
          </SelectContent>
        </Select>
        <Button disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? 'Uploading...' : 'Upload Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        { isLoading ? <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading photos...
        </div> : filteredPhotos.map((photo) => (
          <div key={photo.id} className="border rounded-lg p-4 space-y-2">
            <img src={photo.url} alt={photo.name} className="w-full h-48 object-cover rounded" />
            {editingPhotoId === photo.id ? (
              <div className="space-y-2">
                <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePhotoName}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium truncate">{photo.name}</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => startEditingPhoto(photo)}>
                  Rename
                </Button>
              </div>
            )}
            <p className="text-sm text-gray-500">
              {new Date(photo.created_at).toLocaleDateString()}
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletePhoto(photo)}
              className="mt-2 w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
