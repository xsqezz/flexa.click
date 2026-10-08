import type { Journal } from '../../../shared/domain'
import { csvExports, type CsvExportKind } from './csv'
import { saveFileNatively, type SavedFileType } from './native'

export const EXPORT_FORMAT = 'flexa-journal'
export const EXPORT_VERSION = 2

/** Hands the file to the Android save dialog when available, otherwise lets the browser download it. */
export function downloadText(name: string, text: string, mime: SavedFileType) {
  if (saveFileNatively(name, text, mime)) return
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const day = () => new Date().toISOString().slice(0, 10)

export function journalExportText(journal: Journal, mode: 'demo' | 'cloud', exportedAt = new Date()): string {
  return JSON.stringify({
    format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: exportedAt.toISOString(),
    mode, data: journal,
  }, null, 2)
}

export function downloadJournal(journal: Journal, mode: 'demo' | 'cloud') {
  downloadText(`flexa-${mode}-${day()}.json`, journalExportText(journal, mode), 'application/json')
}

export function downloadCsv(journal: Journal, kind: CsvExportKind) {
  const entry = csvExports[kind]
  downloadText(`flexa-${entry.file}-${day()}.csv`, entry.build(journal), 'text/csv')
}
