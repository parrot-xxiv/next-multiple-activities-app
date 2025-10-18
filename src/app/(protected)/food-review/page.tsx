'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Star, Pencil, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const ratingOptions = [1, 2, 3, 4, 5]

type FoodPhoto = {
  id: string
  user_id: string
  name: string
  url: string
  storage_path: string
  created_at: string
  owner_email: string | null
}

type Review = {
  id: string
  user_id: string
  review: string
  rating: number
  created_at: string
  reviewer_email: string | null
}

const formatDate = (value: string) => new Date(value).toLocaleDateString()

export default function FoodReviewPage() {
  const supabase = useMemo(() => createClient(), [])

  const [sessionUser, setSessionUser] = useState<User | null>(null)
  const [photos, setPhotos] = useState<FoodPhoto[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date')
  const [isFetchingPhotos, setIsFetchingPhotos] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [renamingPhotoId, setRenamingPhotoId] = useState<string | null>(null)
  const [editingPhotoName, setEditingPhotoName] = useState('')
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)

  const [selectedPhoto, setSelectedPhoto] = useState<FoodPhoto | null>(null)
  const [isReviewsDialogOpen, setIsReviewsDialogOpen] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isFetchingReviews, setIsFetchingReviews] = useState(false)
  const [newReview, setNewReview] = useState('')
  const [rating, setRating] = useState(5)
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (active) {
        setSessionUser(data.user ?? null)
      }
    }

    loadUser()

    return () => {
      active = false
    }
  }, [supabase])

  const fetchPhotos = useCallback(async () => {
    setIsFetchingPhotos(true)
    const orderColumn = sortBy === 'name' ? 'name' : 'created_at'

    const { data, error } = await supabase
      .from('food_photos')
      .select('*')
      .order(orderColumn, { ascending: sortBy === 'name' })

    if (error) {
      console.error('Failed to fetch food photos', error.message)
      setPhotos([])
    } else {
      setPhotos(data ?? [])
    }

    setIsFetchingPhotos(false)
  }, [sortBy, supabase])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const closeReviewsDialog = () => {
    setIsReviewsDialogOpen(false)
    setSelectedPhoto(null)
    setReviews([])
    setNewReview('')
    setRating(5)
  }

  const fetchReviews = useCallback(
    async (photoId: string) => {
      setIsFetchingReviews(true)

      const { data, error } = await supabase
        .from('food_reviews')
        .select('*')
        .eq('food_photo_id', photoId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch food reviews', error.message)
        setReviews([])
      } else {
        const result = data ?? []
        setReviews(result)
        const ownReview = sessionUser ? result.find((review) => review.user_id === sessionUser.id) : null
        setNewReview(ownReview?.review ?? '')
        setRating(ownReview?.rating ?? 5)
      }

      setIsFetchingReviews(false)
    },
    [sessionUser, supabase]
  )

  useEffect(() => {
    if (selectedPhoto) {
      fetchReviews(selectedPhoto.id)
    }
  }, [fetchReviews, selectedPhoto])

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || uploading) return

    setUploading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error('You must be logged in to upload photos')
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = fileExt ? `${crypto.randomUUID()}.${fileExt}` : crypto.randomUUID()
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('food-photos').upload(filePath, file)

      if (uploadError) {
        console.error('Failed to upload food photo', uploadError.message)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('food-photos').getPublicUrl(filePath)

      const { error: insertError } = await supabase.from('food_photos').insert({
        user_id: user.id,
        name: file.name.trim() || 'Untitled Food Photo',
        url: publicUrl,
        storage_path: filePath,
        owner_email: user.email ?? null,
      })

      if (insertError) {
        console.error('Failed to save food photo metadata', insertError.message)
        return
      }

      fetchPhotos()
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const startRenamingPhoto = (photo: FoodPhoto) => {
    setRenamingPhotoId(photo.id)
    setEditingPhotoName(photo.name)
  }

  const cancelRenamingPhoto = () => {
    setRenamingPhotoId(null)
    setEditingPhotoName('')
  }

  const savePhotoName = async () => {
    if (!renamingPhotoId || !editingPhotoName.trim()) return

    const { error } = await supabase
      .from('food_photos')
      .update({ name: editingPhotoName.trim() })
      .eq('id', renamingPhotoId)

    if (error) {
      console.error('Failed to rename food photo', error.message)
      return
    }

    cancelRenamingPhoto()
    fetchPhotos()
  }

  const deletePhoto = async (photo: FoodPhoto) => {
    if (!sessionUser || photo.user_id !== sessionUser.id) return
    setDeletingPhotoId(photo.id)

    const { error: storageError } = await supabase.storage
      .from('food-photos')
      .remove([photo.storage_path])

    if (storageError) {
      console.error('Failed to delete food photo from storage', storageError.message)
      setDeletingPhotoId(null)
      return
    }

    const { error } = await supabase.from('food_photos').delete().eq('id', photo.id)

    if (error) {
      console.error('Failed to delete food photo', error.message)
      setDeletingPhotoId(null)
      return
    }

    if (selectedPhoto?.id === photo.id) {
      closeReviewsDialog()
    }

    setDeletingPhotoId(null)
    fetchPhotos()
  }

  const saveReview = async () => {
    if (!selectedPhoto || !sessionUser || !newReview.trim()) return

    setIsSavingReview(true)

    const { error } = await supabase
      .from('food_reviews')
      .upsert(
        {
          user_id: sessionUser.id,
          food_photo_id: selectedPhoto.id,
          review: newReview.trim(),
          rating,
          reviewer_email: sessionUser.email ?? null,
        },
        { onConflict: 'food_photo_id,user_id' }
      )

    if (error) {
      console.error('Failed to save food review', error.message)
    } else {
      await fetchReviews(selectedPhoto.id)
    }

    setIsSavingReview(false)
  }

  const deleteReview = async (review: Review) => {
    if (!sessionUser || review.user_id !== sessionUser.id) return

    setDeletingReviewId(review.id)

    const { error } = await supabase.from('food_reviews').delete().eq('id', review.id)

    if (error) {
      console.error('Failed to delete food review', error.message)
      setDeletingReviewId(null)
      return
    }

    setDeletingReviewId(null)
    if (selectedPhoto) {
      await fetchReviews(selectedPhoto.id)
    }
  }

  const isPhotoOwner = (photo: FoodPhoto) => sessionUser?.id === photo.user_id

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Food Review App</h1>
      <div className="flex gap-4 mb-6">
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
          <label className="cursor-pointer flex items-center gap-2">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading...' : 'Upload Food Photo'}
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

      {isFetchingPhotos ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading photos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {photos.map((photo) => {
            const owner = isPhotoOwner(photo)
            const isRenaming = renamingPhotoId === photo.id
            const isDeleting = deletingPhotoId === photo.id

            return (
              <div key={photo.id} className="border rounded-lg p-4 space-y-3">
                <img src={photo.url} alt={photo.name} className="w-full h-48 object-cover rounded" />

                {isRenaming ? (
                  <div className="space-y-2">
                    <Input
                      value={editingPhotoName}
                      onChange={(event) => setEditingPhotoName(event.target.value)}
                      disabled={isDeleting}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={savePhotoName} disabled={isDeleting}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelRenamingPhoto} disabled={isDeleting}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate flex-1">{photo.name}</p>
                    {owner && (
                      <Button variant="outline" size="icon" onClick={() => startRenamingPhoto(photo)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Uploaded by{' '}
                  {owner
                    ? sessionUser?.email ?? 'your account'
                    : photo.owner_email ?? `user ${photo.user_id.slice(0, 8)}`}{' '}
                  · {formatDate(photo.created_at)}
                </p>

                <div className="flex gap-2">
                  <Dialog open={isReviewsDialogOpen && selectedPhoto?.id === photo.id} onOpenChange={(open) => {
                    if (open) {
                      setSelectedPhoto(photo)
                      setIsReviewsDialogOpen(true)
                    } else {
                      closeReviewsDialog()
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        Reviews
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{selectedPhoto?.name ?? photo.name}</DialogTitle>
                      </DialogHeader>

                      {isFetchingReviews ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews...
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Textarea
                              value={newReview}
                              onChange={(event) => setNewReview(event.target.value)}
                              placeholder="Write your review..."
                              disabled={isSavingReview}
                            />
                            <div className="flex flex-wrap gap-2 items-center">
                              <Select
                                value={rating.toString()}
                                onValueChange={(value) => setRating(Number(value))}
                                disabled={isSavingReview}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ratingOptions.map((option) => (
                                    <SelectItem key={option} value={option.toString()}>
                                      {option} Star{option > 1 ? 's' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button onClick={saveReview} disabled={isSavingReview || !sessionUser}>
                                {isSavingReview ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                {isSavingReview ? 'Saving...' : 'Save Review'}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="font-semibold">Reviews</h3>
                            {reviews.length === 0 ? (
                              <p className="text-gray-500 text-sm">No reviews yet. Be the first to review!</p>
                            ) : (
                              reviews.map((review) => {
                                const isOwnerReview = sessionUser?.id === review.user_id
                                return (
                                  <div key={review.id} className="border rounded p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <p className="text-sm font-medium">
                                          {isOwnerReview
                                            ? sessionUser?.email ?? review.reviewer_email ?? 'You'
                                            : review.reviewer_email ?? `user ${review.user_id.slice(0, 8)}`}
                                        </p>
                                        <div className="flex items-center gap-1">
                                          {Array.from({ length: review.rating }).map((_, index) => (
                                            <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                          ))}
                                        </div>
                                      </div>
                                      {isOwnerReview && (
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setNewReview(review.review)
                                              setRating(review.rating)
                                            }}
                                            disabled={isSavingReview}
                                          >
                                            <Pencil className="h-4 w-4 text-blue-500" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteReview(review)}
                                            disabled={deletingReviewId === review.id}
                                          >
                                            {deletingReviewId === review.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                            ) : (
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                            )}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-sm">{review.review}</p>
                                    <p className="text-xs text-gray-500 mt-1">{formatDate(review.created_at)}</p>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  {owner && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deletePhoto(photo)}
                      disabled={deletingPhotoId === photo.id}
                    >
                      {deletingPhotoId === photo.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {deletingPhotoId === photo.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
