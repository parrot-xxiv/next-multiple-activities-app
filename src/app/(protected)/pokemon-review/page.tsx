'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Star, Search, Pencil, Loader2 } from 'lucide-react'

const ratingOptions = [1, 2, 3, 4, 5]

const spriteUrlForId = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

type Pokemon = {
  id: number
  name: string
  sprites: {
    front_default: string | null
  }
}

type Review = {
  id: string
  user_id: string
  pokemon_name: string
  pokemon_id: number
  review: string
  rating: number
  created_at: string
  reviewer_email: string | null
}

const formatDate = (value: string) => new Date(value).toLocaleDateString()

export default function PokemonReviewPage() {
  const supabase = useMemo(() => createClient(), [])

  const [sessionUser, setSessionUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [pokemon, setPokemon] = useState<Pokemon | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [reviews, setReviews] = useState<Review[]>([])
  const [isFetchingReviews, setIsFetchingReviews] = useState(false)
  const [newReview, setNewReview] = useState('')
  const [rating, setRating] = useState(5)
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  const [allReviews, setAllReviews] = useState<Review[]>([])
  const [isFetchingAllReviews, setIsFetchingAllReviews] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date')

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

  const fetchAllReviews = useCallback(async () => {
    setIsFetchingAllReviews(true)
    const orderColumn = sortBy === 'name' ? 'pokemon_name' : 'created_at'

    const { data, error } = await supabase
      .from('pokemon_reviews')
      .select('*')
      .order(orderColumn, { ascending: sortBy === 'name' })

    if (error) {
      console.error('Failed to fetch pokemon reviews', error.message)
      setAllReviews([])
    } else {
      setAllReviews(data ?? [])
    }

    setIsFetchingAllReviews(false)
  }, [sortBy, supabase])

  useEffect(() => {
    fetchAllReviews()
  }, [fetchAllReviews])

  const fetchReviewsForPokemon = useCallback(
    async (pokemonId: number) => {
      setIsFetchingReviews(true)

      const { data, error } = await supabase
        .from('pokemon_reviews')
        .select('*')
        .eq('pokemon_id', pokemonId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch reviews for pokemon', error.message)
        setReviews([])
        setNewReview('')
        setRating(5)
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

  const loadPokemon = useCallback(
    async (identifier: string | number) => {
      const value = typeof identifier === 'number' ? identifier.toString() : identifier.trim().toLowerCase()
      if (!value) return

      setIsSearching(true)

      try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${value}`)
        if (!response.ok) {
          setPokemon(null)
          setReviews([])
          setNewReview('')
          setRating(5)
          return
        }

        const data = (await response.json()) as Pokemon
        setPokemon({
          id: data.id,
          name: data.name,
          sprites: {
            front_default: data.sprites?.front_default ?? spriteUrlForId(data.id),
          },
        })
        await fetchReviewsForPokemon(data.id)
      } catch (error) {
        console.error('Failed to load pokemon', error)
        setPokemon(null)
        setReviews([])
        setNewReview('')
        setRating(5)
      } finally {
        setIsSearching(false)
      }
    },
    [fetchReviewsForPokemon]
  )

  const handleSearch = async () => {
    await loadPokemon(searchTerm)
  }

  const saveReview = async () => {
    if (!pokemon || !sessionUser || !newReview.trim()) return

    setIsSavingReview(true)

    const { error } = await supabase
      .from('pokemon_reviews')
      .upsert(
        {
          user_id: sessionUser.id,
          pokemon_id: pokemon.id,
          pokemon_name: pokemon.name,
          review: newReview.trim(),
          rating,
          reviewer_email: sessionUser.email ?? null,
        },
        { onConflict: 'pokemon_id,user_id' }
      )

    if (error) {
      console.error('Failed to save pokemon review', error.message)
    } else {
      await Promise.all([fetchReviewsForPokemon(pokemon.id), fetchAllReviews()])
    }

    setIsSavingReview(false)
  }

  const deleteReview = async (review: Review) => {
    if (!sessionUser || review.user_id !== sessionUser.id) return

    setDeletingReviewId(review.id)

    const { error } = await supabase.from('pokemon_reviews').delete().eq('id', review.id)

    if (error) {
      console.error('Failed to delete pokemon review', error.message)
      setDeletingReviewId(null)
      return
    }

    setDeletingReviewId(null)

    if (pokemon && pokemon.id === review.pokemon_id) {
      await fetchReviewsForPokemon(review.pokemon_id)
    }

    await fetchAllReviews()
  }

  const startEditingReview = async (review: Review) => {
    setSearchTerm(review.pokemon_name)
    await loadPokemon(review.pokemon_id)
    setNewReview(review.review)
    setRating(review.rating)
  }

  const reviewsForDisplay = reviews
  const allReviewsForDisplay = allReviews

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pokemon Review App</h1>
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            placeholder="Search Pokemon by name or ID..."
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {pokemon && (
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex gap-6">
            <img
              src={pokemon.sprites.front_default || spriteUrlForId(pokemon.id)}
              alt={pokemon.name}
              className="w-48 h-48 object-contain"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold capitalize mb-4">{pokemon.name}</h2>
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
                      {isSavingReview && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {isSavingReview ? 'Saving...' : 'Save Review'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold">Reviews</h3>
                  {isFetchingReviews ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews...
                    </div>
                  ) : reviewsForDisplay.length === 0 ? (
                    <p className="text-gray-500">No reviews yet. Be the first to review!</p>
                  ) : (
                    reviewsForDisplay.map((review) => {
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
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">All Reviews</h2>
          <Select value={sortBy} onValueChange={(value: 'name' | 'date') => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="date">Sort by Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFetchingAllReviews ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading all reviews...
          </div>
        ) : allReviewsForDisplay.length === 0 ? (
          <p className="text-gray-500">No reviews yet. Start by searching for a Pokémon above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allReviewsForDisplay.map((review) => {
              const isOwnerReview = sessionUser?.id === review.user_id
              return (
                <div key={review.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex flex-col items-center">
                    <div>
                      <h3 className="font-semibold capitalize">{review.pokemon_name}</h3>
                      <img
                        src={spriteUrlForId(review.pokemon_id)}
                        alt={pokemon?.name}
                        className="w-48 h-48 object-contain"
                      />
                      <p className="text-xs text-gray-500">
                        Reviewed by{' '}
                        { isOwnerReview ?  'you' : review.reviewer_email ?? `user ${review.user_id.slice(0, 8)}`}
                      </p>
                    </div>

                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm">{review.review}</p>
                  <p className="text-xs text-gray-500">{formatDate(review.created_at)}</p>
                  {isOwnerReview && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditingReview(review)}
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
