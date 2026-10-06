import type { Journal } from '../../../shared/domain'

export function downloadJournal(journal: Journal, mode: 'demo' | 'cloud') {
  const blob = new Blob([JSON.stringify({
    format: 'flexa-journal', version: 1, exportedAt: new Date().toISOString(),
    mode, data: journal,
  }, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `flexa-${mode}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
