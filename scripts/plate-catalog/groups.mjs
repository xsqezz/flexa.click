/** Maps USDA FoodData Central categories and descriptions to the plate groups used by the app. A null result drops the record. */

const wweia = {
  burger: [3702],
  wrap: [3502, 3504, 3506, 3704, 3720, 3722, 3730, 3740, 3742, 3744, 3703],
  breakfast: [3706, 4404, 4602, 4604],
  pizza: [3602],
  chicken: [2202, 2204],
  meat: [2002, 2004, 2006, 2008, 2010, 2206, 2602, 2604, 2606, 2608],
  fish: [2402, 2404],
  egg: [2502],
  home: [3002, 3004, 3006, 3102, 3104, 3202, 3204, 3206, 3208],
  asian: [3402, 3404, 3406, 3808],
  soup: [3802, 3804, 3806],
  veg: [6402, 6404, 6406, 6407, 6409, 6411, 6412, 6413, 6414, 6416, 6418, 6420, 6489, 2802, 2806],
  side: [6802, 6804, 6806, 6410, 6430, 6432, 8408],
  fruit: [6002, 6004, 6006, 6008, 6009, 6011, 6012, 6014, 6016, 6018, 6020, 6022, 6024],
  grain: [4002, 4004, 4802, 4804],
  bread: [4202, 4204, 4206, 4208, 4402],
  snack: [5002, 5004, 5006, 5008, 5202, 5204, 5402, 5404, 2804],
  sweet: [5502, 5504, 5506, 5702, 5704, 5802, 5804, 5806, 8802, 8806],
  sauce: [8002, 8004, 8010, 8006, 8012, 8402, 8404, 8406, 8410, 8412],
  dairy: [1002, 1004, 1006, 1008, 1602, 1604, 1820, 1822, 1904, 8008],
  drink: [1202, 1204, 1206, 1208, 1402, 1902, 7002, 7004, 7006, 7008, 7102, 7104, 7106, 7202, 7204, 7206, 7220, 7302, 7304, 7702, 7704, 7802, 7804],
  alcohol: [7502, 7504, 7506],
}
const wweiaIndex = new Map(Object.entries(wweia).flatMap(([group, ids]) => ids.map((id) => [id, group])))
export const wweiaGroup = (category) => wweiaIndex.get(Number(category)) ?? null

const cookedWords = /\b(cooked|roasted|fried|grilled|broiled|braised|stewed|baked|boiled|steamed|scrambled|poached|canned|prepared)\b/i
const rawFruit = /\braw\b/i
const noisy = /\b(separable|trimmed to|select,|choice,|prime,|grade|imitation|dehydrated|dry mix|dry, |powder|unprepared|frozen, unprepared|mature seeds, raw|infant|babyfood|baby food|lean only|fat only|NFS)\b/i

/** SR Legacy categories worth keeping; plain cuts of raw meat and bulk ingredients are left to the generic FNDDS list. */
export function srGroup(category, description) {
  const id = Number(category)
  if (noisy.test(description) && ![21, 25].includes(id)) return null
  if (id === 21 || id === 25) return null
  if (id === 22) return 'home'
  if (id === 23) return 'snack'
  if (id === 19) return 'sweet'
  if (id === 18) return /\b(cake|cookie|pie|brownie|doughnut|donut|danish|pastry|eclair|cupcake|muffin|cheesecake|strudel)\b/i.test(description) ? 'sweet' : 'bread'
  if (id === 7) return 'meat'
  if (id === 6) return /\b(soup|chowder|broth|stew)\b/i.test(description) && /\b(ready-to-serve|prepared with|home|restaurant)\b/i.test(description) ? 'soup' : /\b(sauce|gravy|dressing)\b/i.test(description) ? 'sauce' : null
  if (id === 1) return /\b(cheese|yogurt|egg)\b/i.test(description) ? (/\begg\b/i.test(description) ? 'egg' : 'dairy') : null
  if (id === 9) return rawFruit.test(description) ? 'fruit' : null
  if (id === 11) return /\b(cooked|raw)\b/i.test(description) && !/\b(boiled, drained, with salt|without salt)\b/i.test(description) ? 'veg' : null
  if (id === 16) return /\bcooked\b/i.test(description) ? 'veg' : null
  if (id === 20) return /\bcooked\b/i.test(description) ? 'grain' : null
  if (id === 15) return cookedWords.test(description) ? 'fish' : null
  if ([5, 10, 13, 17].includes(id)) return cookedWords.test(description) ? (id === 5 ? 'chicken' : 'meat') : null
  if (id === 14) return /\b(prepared|ready-to-drink|carbonated|beverage|tea|coffee)\b/i.test(description) && !/powder/i.test(description) ? 'drink' : null
  if (id === 28) return 'alcohol'
  if (id === 12) return /\b(roasted|dry roasted|oil roasted|butter)\b/i.test(description) ? 'snack' : null
  return null
}

const chainWords = [
  ['mcdonald', "McDonald's"], ['burger king', 'Burger King'], ['kfc', 'KFC'], ['wendy', "Wendy's"], ['taco bell', 'Taco Bell'], ['subway', 'Subway'],
  ['pizza hut', 'Pizza Hut'], ['domino', "Domino's"], ['little caesar', "Little Caesars"], ['popeyes', 'Popeyes'], ['chick-fil', 'Chick-fil-A'],
  ['arby', "Arby's"], ['papa john', "Papa John's"], ['denny', "Denny's"], ['applebee', "Applebee's"], ['olive garden', 'Olive Garden'],
  ['carl', "Carl's Jr."], ['jack in the box', 'Jack in the Box'], ['sonic', 'Sonic'], ['dairy queen', 'Dairy Queen'],
]
export function chainOf(description) {
  const lower = description.toLowerCase()
  const hit = chainWords.find(([needle]) => lower.includes(needle))
  return hit ? hit[1] : null
}

/** Group for fast-food and restaurant records, decided from the dish name. */
export function dishGroup(text) {
  const t = text.toLowerCase()
  if (/\b(pizza)\b/.test(t)) return 'pizza'
  if (/\b(shake|sundae|cone|mcflurry|frosty|cookie|brownie|pie\b|cheesecake|cinnamon|parfait|dessert|ice cream|dilly|blizzard)\b/.test(t)) return 'sweet'
  if (/\b(coffee|latte|cappuccino|mocha|tea|soda|cola|sprite|juice|lemonade|coke|drink)\b/.test(t)) return 'drink'
  if (/\b(french fries|fries|hash brown|onion rings|potato wedges|coleslaw|mashed|corn on the cob|biscuit|side)\b/.test(t)) return 'side'
  if (/\b(sauce|dressing|ketchup|mayo|mayonnaise|honey mustard|ranch|dip)\b/.test(t)) return 'sauce'
  if (/\b(burger|hamburger|cheeseburger|whopper|big mac|quarter pounder|double stack|baconator|big king)\b/.test(t)) return 'burger'
  if (/\b(nugget|tender|strip|wing|drumstick|thigh|breast|fried chicken|popcorn chicken|chicken)\b/.test(t) && !/\b(sandwich|sub|wrap|salad|burrito|taco)\b/.test(t)) return 'chicken'
  if (/\b(taco|burrito|wrap|sandwich|sub\b|quesadilla|gordita|chalupa|nachos|hot dog|croissan|muffin|sausage biscuit|panini)\b/.test(t)) return 'wrap'
  if (/\b(salad)\b/.test(t)) return 'side'
  if (/\b(soup|chili)\b/.test(t)) return 'soup'
  if (/\b(egg|pancake|waffle|hotcake|breakfast)\b/.test(t)) return 'breakfast'
  if (/\b(steak|ribs|fish|shrimp|pasta|alfredo|lasagna|rice|beans|macaroni)\b/.test(t)) return 'home'
  return 'home'
}

/** How far a plausible real portion can stray from the tabulated one, by what the dish hides. */
export const spreadOf = {
  burger: 'wide', wrap: 'wide', breakfast: 'normal', pizza: 'normal', chicken: 'normal', meat: 'normal', fish: 'normal', egg: 'tight',
  home: 'wide', asian: 'wide', soup: 'normal', veg: 'normal', side: 'normal', fruit: 'tight', grain: 'normal', bread: 'tight',
  snack: 'tight', sweet: 'normal', sauce: 'normal', dairy: 'tight', drink: 'tight', alcohol: 'tight',
}
