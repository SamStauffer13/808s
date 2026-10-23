import type { Provider } from './providers.ts'

const API = 'https://www.googleapis.com/youtube/v3'

// YouTube keeps one category per video; it stands in for a song's genres so the reveal still has a vibe to show
const categories: Record<string, string> = {
  '1': 'film', '2': 'autos', '10': 'music', '15': 'pets', '17': 'sports', '19': 'travel', '20': 'gaming', '22': 'vlogs',
  '23': 'comedy', '24': 'entertainment', '25': 'news', '26': 'how-to', '27': 'education', '28': 'science & tech',
}

// search results come back with HTML entities in the text ("Tom &amp; Jerry")
const plain = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e as string]!)

async function youtube(path: string, params: Record<string, string>) {
  const key = Deno.env.get('YOUTUBE_API_KEY')
  if (!key) throw new Error('YouTube is not set up (YOUTUBE_API_KEY)')
  const res = await fetch(`${API}${path}?${new URLSearchParams({ ...params, key })}`)
  if (!res.ok) throw new Error(`YouTube ${path} failed (${res.status})`)
  return await res.json()
}

const thumb = (s: any) => (s.thumbnails?.medium ?? s.thumbnails?.default)?.url ?? null

// Search and lookups use our own API key and no login, so players and hosts never touch YouTube. There is no list to
// build: the guess screen plays the videos in order with an embed. (A host login would let it make a real playlist: see
// "Ideas not built" in the README.)
export const youtubeProvider: Provider = {
  needsHostAccount: false,
  maxPicks: 1, // one video each: a video takes minutes to watch, where a song takes seconds
  isId: (id) => /^[A-Za-z0-9_-]{11}$/.test(id),

  async search(q) {
    const data = await youtube('/search', { part: 'snippet', type: 'video', maxResults: '6', safeSearch: 'moderate', q })
    return (data.items ?? [])
      .filter((v: any) => v?.id?.videoId)
      .map((v: any) => ({ id: v.id.videoId as string, title: plain(v.snippet.title), artist: plain(v.snippet.channelTitle), art: thumb(v.snippet), blocked: false }))
  },

  async lookup(id) {
    const data = await youtube('/videos', { part: 'snippet', id })
    const v = data.items?.[0]
    if (!v) return null
    const category = categories[v.snippet.categoryId]
    return { id: v.id as string, title: v.snippet.title as string, artist: v.snippet.channelTitle as string, art: thumb(v.snippet), blocked: false, genres: category ? [category] : [] }
  },

  publish: async () => null,
}
