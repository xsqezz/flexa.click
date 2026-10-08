import { getIngredient } from './lookup.ts'

export const dishFormats = ['skillet', 'bake', 'onepot', 'eggs', 'soup', 'salad', 'wrap', 'oats', 'smoothie', 'pancakes'] as const
export type DishFormat = typeof dishFormats[number]

export const dishStyles = ['herb', 'asian', 'tomato', 'creamy', 'lemon', 'curry', 'mustard', 'pesto'] as const
export type DishStyle = typeof dishStyles[number]

const styleHints: Record<DishStyle, string> = {
  herb: 'seasoned with herbs', asian: 'glazed with soy sauce, Asian style', tomato: 'in a rich tomato sauce', creamy: 'in a light creamy sauce',
  lemon: 'with a squeeze of lemon and fresh herbs', curry: 'in a golden curry sauce', mustard: 'with a honey mustard glaze', pesto: 'tossed with green pesto',
}

const formatScenes: Record<DishFormat, (items: string) => string> = {
  skillet: (items) => `a pan-fried dish of ${items}, freshly cooked in a skillet`,
  bake: (items) => `roasted ${items} with golden crispy edges on a baking tray`,
  onepot: (items) => `a hearty one-pot meal with ${items} in a bowl`,
  eggs: (items) => `a fluffy egg dish with ${items} on a plate`,
  soup: (items) => `a creamy soup made of ${items} in a ceramic bowl`,
  salad: (items) => `a fresh colourful salad with ${items} in a bowl`,
  wrap: (items) => `a wrap or sandwich filled with ${items}, cut in half`,
  oats: (items) => `a bowl of warm porridge topped with ${items}`,
  smoothie: (items) => `a thick smoothie made of ${items} in a tall glass`,
  pancakes: (items) => `a stack of small pancakes with ${items}`,
}

export const maxPromptIngredients = 8

/** Builds the image prompt only from known identifiers, so no user-written text reaches the model. */
export function dishImagePrompt(format: DishFormat, ingredientIds: readonly string[], style?: DishStyle): string {
  const names = ingredientIds.slice(0, maxPromptIngredients).map((id) => getIngredient(id).en)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] ?? 'fresh ingredients'
  const hint = style ? `, ${styleHints[style]}` : ''
  return `Professional food photography of ${formatScenes[format](list)}${hint}. Served on a ceramic plate on a wooden table, natural window light, shallow depth of field, appetizing, vibrant colours, top-down 45 degree angle, no text, no people, no hands.`
}
