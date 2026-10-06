import type { Food } from '../../../shared/domain'
import { sourceNames, sourceURL } from '../lib/sources'

export function SourceCredit({ food }: { food: Food }) {
  const url = sourceURL(food)
  return <div className="source-credit">
    Źródło: {url ? <a href={url} target="_blank" rel="noreferrer">{sourceNames[food.source]}</a> : sourceNames[food.source]}.
    {food.source === 'open-food-facts' && <> Dane dostępne na licencji <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>. Sprawdź etykietę: wartości mogą być niepełne.</>}
    {food.source === 'usda' && ' Dane w domenie publicznej (CC0), bazowo na 100 g.'}
    {food.source === 'custom' && ' Prywatny wpis. Wartości przepisane przez Ciebie z etykiety.'}
    {food.source === 'demo' && ' Przykładowe wartości, nie zweryfikowana baza produktów.'}
    {food.estimated && ' Źródło oznacza część wartości jako szacunkowe — nie są potwierdzoną tabelą producenta.'}
  </div>
}
