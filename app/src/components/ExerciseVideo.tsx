import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import { allowVideos, embedUrl, videoFor, videosAllowed, youtubeSearchUrl } from '../lib/training/media'

export function ExerciseVideo({ exerciseId, name }: { exerciseId: string; name: string }) {
  const video = videoFor(exerciseId)
  const [enabled, setEnabled] = useState(videosAllowed)
  const [autoplay, setAutoplay] = useState(false)
  if (!video) return <div className="exercise-media exercise-media-search">
    <Play size={22} aria-hidden="true" />
    <p>Nie mamy jeszcze sprawdzonego filmu do tego ćwiczenia.</p>
    <a href={youtubeSearchUrl(name)} target="_blank" rel="noreferrer">Wyszukaj „{name}” na YouTube<ExternalLink size={15} aria-hidden="true" /></a>
  </div>
  if (!enabled) return <button type="button" className="exercise-media video-facade" onClick={() => { allowVideos(true); setEnabled(true); setAutoplay(true) }}>
    <span className="video-play" aria-hidden="true"><Play size={26} /></span>
    <span className="video-facade-text">
      <strong>Odtwórz film: jak wykonać ćwiczenie</strong>
      <small>{video.title} · {video.channel}{video.lang === 'pl' ? '' : ' · po angielsku'}</small>
    </span>
    <small className="video-facade-note">Odtwarzacz YouTube załaduje się dopiero po kliknięciu.</small>
  </button>
  return <div className="exercise-media-player">
    <div className="exercise-media video-frame">
      <iframe src={embedUrl(video.id, autoplay)} title={`Film instruktażowy: ${name}`} loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
    <p className="video-credit">{video.title} · {video.channel}{video.lang === 'pl' ? '' : ' · po angielsku'}
      <button type="button" className="text-link" onClick={() => { allowVideos(false); setEnabled(false); setAutoplay(false) }}>Nie ładuj filmów automatycznie</button></p>
  </div>
}
