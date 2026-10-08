import type { Journal } from '../../../shared/domain'
import { saveJsonNatively } from './native'

export function downloadJournal(journal: Journal, mode: 'demo' | 'cloud') {
  const text = JSON.stringify({
    format: 'flexa-journal', version: 1, exportedAt: new Date().toISOString(),
    mode, data: journal,
  }, null, 2)
  const name = `flexa-${mode}-${new Date().toISOString().slice(0, 10)}.json`
  if (saveJsonNatively(name, text)) return
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
