import { per, type Nutrients } from '../kitchen/types.ts'

export const plateGroups = ['burger', 'chicken', 'pizza', 'wrap', 'side', 'home', 'asian', 'sauce', 'drink', 'sweet'] as const
export type PlateGroup = typeof plateGroups[number]
export const plateGroupLabels: Record<PlateGroup, string> = {
  burger: 'Burgery', chicken: 'Kurczak i przekąski', pizza: 'Pizza', wrap: 'Kebab, wrapy i kanapki', side: 'Dodatki i surówki',
  home: 'Dania domowe', asian: 'Kuchnia azjatycka', sauce: 'Sosy', drink: 'Napoje', sweet: 'Słodycze i desery',
}

export const plateSizes = ['S', 'M', 'L'] as const
export type PlateSize = typeof plateSizes[number]
export const plateSizeLabels: Record<PlateSize, string> = { S: 'Mała', M: 'Średnia', L: 'Duża' }

/** How far a typical real portion can stray from the table: hidden oil, sauces and filling make mixed and fried dishes the least certain. */
export type PlateSpread = 'tight' | 'normal' | 'wide'

export type PlateItem = {
  id: string
  /** Polish name shown to the user. */
  name: string
  group: PlateGroup
  unit: 'g' | 'ml'
  /** Per 100 g (100 ml) of the prepared item as served, with typical restaurant or fast-food recipes. */
  per100: Nutrients
  /** Small, medium and large portion in grams or millilitres. */
  sizes: Readonly<Record<PlateSize, number>>
  /** When the item comes in countable pieces, one piece weighs this much. */
  piece?: { grams: number; label: string }
  spread: PlateSpread
  /** Extra words used when the user searches by hand. */
  aliases?: readonly string[]
}

type Options = { piece?: [grams: number, label: string]; aliases?: readonly string[] }

function item(id: string, name: string, group: PlateGroup, unit: 'g' | 'ml', nutrients: Nutrients, sizes: readonly [number, number, number], spread: PlateSpread, options: Options = {}): PlateItem {
  return {
    id, name, group, unit, per100: nutrients, sizes: { S: sizes[0], M: sizes[1], L: sizes[2] }, spread,
    ...(options.piece ? { piece: { grams: options.piece[0], label: options.piece[1] } } : {}),
    ...(options.aliases ? { aliases: options.aliases } : {}),
  }
}

/**
 * Typical prepared foods as eaten away from home. Values are rounded averages from public composition tables
 * (USDA FoodData Central restaurant and fast-food records, Polish tables) and chain nutrition leaflets, so a
 * particular restaurant can differ: its own menu values should always win (see the "own values" option in the app).
 */
export const plateItems: readonly PlateItem[] = [
  item('hamburger', 'Hamburger', 'burger', 'g', per(245, 12.5, 29, 8.7, 1.5), [95, 105, 130], 'normal', { piece: [105, 'szt.'], aliases: ['burger'] }),
  item('cheeseburger', 'Cheeseburger', 'burger', 'g', per(258, 13.5, 28, 10.5, 1.5), [110, 120, 150], 'normal', { piece: [120, 'szt.'], aliases: ['burger z serem'] }),
  item('burger-double', 'Burger duży lub podwójny (np. Big Mac)', 'burger', 'g', per(251, 11.4, 20.5, 13.7, 1.5), [160, 215, 300], 'wide', { piece: [215, 'szt.'], aliases: ['big mac', 'whopper', 'double', 'podwójny'] }),
  item('burger-chicken', 'Burger z kurczakiem w panierce', 'burger', 'g', per(280, 9.8, 27.3, 14.7, 1.5), [130, 160, 220], 'wide', { piece: [160, 'szt.'], aliases: ['chicken burger', 'mcchicken', 'crispy'] }),
  item('burger-gourmet', 'Burger restauracyjny (bułka maślana, ser, bekon)', 'burger', 'g', per(275, 14, 20, 16, 1.2), [250, 330, 450], 'wide', { piece: [330, 'szt.'], aliases: ['burger rzemieślniczy', 'burger wołowy'] }),
  item('burger-veggie', 'Burger wegetariański', 'burger', 'g', per(225, 8, 28, 8.5, 3), [150, 200, 280], 'normal', { piece: [200, 'szt.'], aliases: ['burger roślinny', 'vege'] }),

  item('nuggets', 'Nuggetsy z kurczaka', 'chicken', 'g', per(255, 15, 15.5, 15), [100, 150, 220], 'normal', { piece: [17, 'szt.'], aliases: ['mcnuggets', 'kawałki kurczaka'] }),
  item('chicken-fried-bone', 'Kurczak w panierce (kawałek z kością)', 'chicken', 'g', per(228, 17, 8, 14), [110, 220, 330], 'wide', { piece: [110, 'szt.'], aliases: ['kfc', 'udko', 'pałka', 'smażony kurczak'] }),
  item('chicken-tenders', 'Paski z kurczaka w panierce', 'chicken', 'g', per(258, 17, 16, 14), [90, 135, 225], 'normal', { piece: [45, 'szt.'], aliases: ['strips', 'tenders', 'stripsy'] }),
  item('chicken-wings', 'Skrzydełka kurczaka z sosem', 'chicken', 'g', per(285, 20, 8, 20), [120, 200, 320], 'wide', { piece: [40, 'szt.'], aliases: ['hot wings', 'skrzydełka'] }),
  item('chicken-grilled', 'Pierś z kurczaka z grilla', 'chicken', 'g', per(165, 31, 0, 3.6), [100, 150, 220], 'tight', { aliases: ['kurczak grillowany', 'filet z kurczaka'] }),
  item('mozzarella-sticks', 'Paluszki serowe (mozzarella w panierce)', 'chicken', 'g', per(305, 14, 22, 18), [75, 125, 200], 'normal', { piece: [25, 'szt.'], aliases: ['sticks'] }),
  item('onion-rings', 'Krążki cebulowe', 'chicken', 'g', per(296, 4, 34, 16, 2), [70, 110, 160], 'normal', { piece: [18, 'szt.'] }),

  item('pizza-cheese', 'Pizza margherita lub z serem (kawałek)', 'pizza', 'g', per(243, 11, 30, 9, 2), [110, 220, 330], 'normal', { piece: [110, 'kawałki'], aliases: ['pizza', 'margherita'] }),
  item('pizza-meat', 'Pizza z wędliną lub pepperoni (kawałek)', 'pizza', 'g', per(272, 12, 28, 12.5, 2), [110, 220, 330], 'normal', { piece: [110, 'kawałki'], aliases: ['pepperoni', 'pizza z szynką'] }),

  item('kebab', 'Kebab w picie lub tortilli', 'wrap', 'g', per(193, 11, 17, 9, 1.5), [300, 450, 600], 'wide', { piece: [450, 'szt.'], aliases: ['kebap', 'döner', 'gyros', 'durum'] }),
  item('kebab-meat', 'Mięso kebab (sam talerz)', 'wrap', 'g', per(206, 17, 3, 14), [100, 150, 220], 'wide', { aliases: ['gyros mięso', 'döner mięso'] }),
  item('wrap-chicken', 'Wrap lub twister z kurczakiem', 'wrap', 'g', per(222, 11, 22, 10, 1.5), [180, 250, 330], 'wide', { piece: [250, 'szt.'], aliases: ['tortilla', 'twister', 'rolka'] }),
  item('burrito', 'Burrito lub quesadilla', 'wrap', 'g', per(195, 8, 25, 7, 3), [250, 350, 450], 'wide', { piece: [350, 'szt.'], aliases: ['meksykańskie', 'quesadilla', 'taco'] }),
  item('hotdog', 'Hot dog', 'wrap', 'g', per(254, 10, 22, 14, 1.2), [100, 150, 230], 'normal', { piece: [150, 'szt.'], aliases: ['parówka w bułce'] }),
  item('zapiekanka', 'Zapiekanka z serem i pieczarkami', 'wrap', 'g', per(229, 9, 28, 9, 1.5), [200, 300, 400], 'wide', { piece: [300, 'szt.'], aliases: ['bagietka zapiekana'] }),
  item('sandwich', 'Kanapka lub bagietka z mięsem i warzywami', 'wrap', 'g', per(194, 10, 25, 6, 2), [180, 250, 350], 'normal', { piece: [250, 'szt.'], aliases: ['subway', 'sub', 'bagietka'] }),
  item('toast', 'Tost z serem i szynką', 'wrap', 'g', per(263, 11, 30, 11, 1.5), [90, 180, 270], 'normal', { piece: [90, 'szt.'], aliases: ['tosty', 'kanapka grillowana'] }),

  item('fries', 'Frytki', 'side', 'g', per(312, 3.4, 41, 15, 3.8), [80, 115, 165], 'normal', { aliases: ['pommes', 'frytki z budki'] }),
  item('potato-wedges', 'Ziemniaki pieczone lub wedges', 'side', 'g', per(218, 3, 29, 10, 2.5), [100, 150, 220], 'normal', { aliases: ['cząstki ziemniaczane', 'ćwiartki'] }),
  item('coleslaw', 'Surówka coleslaw (z majonezem)', 'side', 'g', per(151, 1, 12, 11, 1.5), [80, 120, 180], 'normal', { aliases: ['kapusta z majonezem'] }),
  item('salad-plain', 'Surówka lub sałatka warzywna bez sosu', 'side', 'g', per(23, 1.5, 3.5, 0.3, 1.8), [60, 100, 160], 'tight', { aliases: ['warzywa', 'mizeria', 'sałata'] }),
  item('salad-chicken', 'Sałatka z kurczakiem i sosem', 'side', 'g', per(132, 9, 6, 8, 1.5), [200, 300, 400], 'wide', { aliases: ['cezar', 'sałatka cezar', 'sałatka z mięsem'] }),
  item('rice-cooked', 'Ryż gotowany', 'side', 'g', per(130, 2.7, 28, 0.3, 0.4), [100, 150, 220], 'tight', { aliases: ['ryż biały'] }),
  item('pasta-cooked', 'Makaron gotowany', 'side', 'g', per(158, 5.8, 31, 0.9, 1.8), [120, 200, 300], 'tight', { aliases: ['spaghetti', 'penne'] }),
  item('potatoes-boiled', 'Ziemniaki gotowane', 'side', 'g', per(86, 1.7, 20, 0.1, 1.8), [100, 200, 300], 'tight', { aliases: ['puree', 'kartofle'] }),
  item('groats-cooked', 'Kasza gotowana', 'side', 'g', per(112, 4, 23, 0.6, 2.5), [100, 150, 220], 'tight', { aliases: ['kasza gryczana', 'kasza jaglana'] }),
  item('bread-roll', 'Bułka lub pieczywo', 'side', 'g', per(265, 9, 49, 3.2, 2.7), [50, 100, 150], 'tight', { piece: [50, 'szt.'], aliases: ['chleb', 'bagietka', 'kromka'] }),
  item('veg-cooked', 'Warzywa gotowane lub pieczone', 'side', 'g', per(67, 2, 8, 3, 2.5), [80, 150, 250], 'normal', { aliases: ['surówka gotowana', 'brokuły', 'marchewka'] }),
  item('chips-bag', 'Chipsy', 'side', 'g', per(529, 6, 52, 33, 4), [30, 50, 100], 'tight', { aliases: ['nachos', 'przekąska'] }),
  item('potato-pancake', 'Placki ziemniaczane', 'side', 'g', per(220, 4, 24, 12, 2), [70, 140, 210], 'normal', { piece: [70, 'szt.'] }),
  item('pierogi', 'Pierogi', 'side', 'g', per(174, 5.5, 28, 4.5, 1.5), [150, 240, 360], 'normal', { piece: [30, 'szt.'], aliases: ['pierożki', 'uszka'] }),

  item('scrambled-eggs', 'Jajecznica lub omlet', 'home', 'g', per(158, 10, 1.5, 12.5), [100, 150, 220], 'normal', { aliases: ['jajka'] }),
  item('porridge', 'Owsianka na mleku', 'home', 'g', per(92, 3.7, 13, 2.8, 1.5), [200, 300, 400], 'normal', { aliases: ['płatki z mlekiem', 'kasza manna'] }),
  item('sandwich-bread', 'Kanapka z chleba (ser, wędlina)', 'home', 'g', per(245, 11, 30, 9, 2.5), [90, 180, 270], 'normal', { piece: [90, 'szt.'], aliases: ['kanapka śniadaniowa'] }),
  item('schnitzel', 'Kotlet schabowy lub drobiowy w panierce', 'home', 'g', per(246, 18, 12, 14, 0.8), [120, 180, 250], 'wide', { piece: [120, 'szt.'], aliases: ['schabowy', 'kotlet'] }),
  item('grilled-meat', 'Mięso z grilla (wołowina, wieprzowina)', 'home', 'g', per(248, 26, 0, 16), [120, 180, 250], 'wide', { aliases: ['stek', 'karkówka', 'żeberka', 'kiełbasa z grilla'] }),
  item('fish-breaded', 'Ryba w panierce', 'home', 'g', per(245, 14, 18, 13, 1), [100, 150, 220], 'wide', { piece: [100, 'szt.'], aliases: ['fish and chips', 'filet z ryby', 'filet-o-fish'] }),
  item('salmon-baked', 'Łosoś lub ryba pieczona', 'home', 'g', per(196, 22, 0, 12), [100, 150, 200], 'normal', { aliases: ['ryba', 'dorsz', 'łosoś'] }),
  item('soup', 'Zupa', 'home', 'ml', per(56, 2.5, 7, 2, 1), [250, 350, 500], 'normal', { aliases: ['rosół', 'krem', 'pomidorowa', 'żurek'] }),

  item('sushi', 'Sushi (maki i nigiri)', 'asian', 'g', per(138, 5, 25, 2, 1), [140, 224, 336], 'normal', { piece: [28, 'szt.'], aliases: ['maki', 'nigiri', 'roll'] }),
  item('noodles-wok', 'Makaron smażony na woku', 'asian', 'g', per(166, 6, 22, 6, 1.5), [250, 350, 500], 'wide', { aliases: ['chow mein', 'pad thai', 'ramen smażony'] }),
  item('chicken-sweet-sour', 'Kurczak w sosie słodko-kwaśnym', 'asian', 'g', per(218, 10, 22, 10, 1), [150, 250, 350], 'wide', { aliases: ['kurczak po chińsku', 'kurczak curry'] }),
  item('rice-fried', 'Ryż smażony z warzywami', 'asian', 'g', per(173, 4, 28, 5, 1), [150, 250, 350], 'wide', { aliases: ['ryż z woka'] }),

  item('sauce-ketchup', 'Ketchup', 'sauce', 'g', per(105, 1, 25, 0.1, 0.3), [15, 30, 60], 'normal', { piece: [15, 'saszetki'] }),
  item('sauce-mayo', 'Majonez', 'sauce', 'g', per(683, 1, 1, 75), [10, 20, 40], 'tight', { piece: [15, 'saszetki'] }),
  item('sauce-garlic', 'Sos czosnkowy lub tatarski', 'sauce', 'g', per(406, 1, 6, 42), [20, 40, 60], 'wide', { aliases: ['sos jogurtowy', 'tzatziki', 'tatarski'] }),
  item('sauce-cheese', 'Sos serowy', 'sauce', 'g', per(224, 5, 6, 20), [30, 50, 80], 'wide', { aliases: ['cheddar', 'dip serowy'] }),
  item('sauce-bbq', 'Sos BBQ', 'sauce', 'g', per(151, 0.8, 36, 0.5), [20, 35, 50], 'normal', { aliases: ['barbecue'] }),
  item('sauce-sweet-sour', 'Sos słodko-kwaśny', 'sauce', 'g', per(130, 0.3, 32, 0.1), [25, 40, 60], 'normal'),
  item('dressing-oil', 'Dressing winegret (oliwa, ocet)', 'sauce', 'g', per(392, 0.5, 3, 42), [15, 30, 50], 'wide', { aliases: ['winegret', 'oliwa', 'olej'] }),
  item('dressing-creamy', 'Dressing kremowy (cezar, jogurtowy)', 'sauce', 'g', per(330, 2, 4, 34), [15, 30, 50], 'wide', { aliases: ['cezar', 'ranch', 'sos do sałatki'] }),

  item('cola', 'Cola lub inny napój gazowany', 'drink', 'ml', per(42, 0, 10.6, 0), [250, 400, 500], 'tight', { aliases: ['pepsi', 'fanta', 'sprite', 'lemoniada', 'napój'] }),
  item('cola-zero', 'Napój zero (bez cukru)', 'drink', 'ml', per(0, 0, 0, 0), [250, 400, 500], 'tight', { aliases: ['cola zero', 'light', 'woda smakowa'] }),
  item('juice', 'Sok owocowy', 'drink', 'ml', per(45, 0.5, 10.5, 0.1), [200, 300, 400], 'tight', { aliases: ['nektar', 'smoothie owocowe'] }),
  item('shake', 'Shake lub koktajl mleczny', 'drink', 'ml', per(125, 3.5, 20, 3.5), [300, 400, 500], 'normal', { aliases: ['milkshake'] }),
  item('latte', 'Kawa z mlekiem (latte, cappuccino)', 'drink', 'ml', per(50, 2.6, 4, 2.6), [250, 350, 450], 'normal', { aliases: ['cappuccino', 'flat white', 'kawa'] }),
  item('coffee-black', 'Kawa czarna lub herbata bez cukru', 'drink', 'ml', per(1, 0.1, 0, 0), [150, 250, 350], 'tight', { aliases: ['herbata', 'espresso', 'americano'] }),
  item('water', 'Woda', 'drink', 'ml', per(0, 0, 0, 0), [250, 500, 750], 'tight'),

  item('ice-cream', 'Lody (gałki)', 'sweet', 'g', per(209, 3.5, 24, 11), [50, 100, 150], 'normal', { piece: [50, 'gałki'], aliases: ['lody', 'lód', 'sorbet', 'rożek'] }),
  item('donut', 'Pączek lub donut', 'sweet', 'g', per(398, 5, 45, 22, 1.5), [80, 160, 240], 'normal', { piece: [80, 'szt.'], aliases: ['pączek'] }),
  item('cheesecake', 'Sernik lub ciasto (kawałek)', 'sweet', 'g', per(326, 6, 26, 22, 1), [100, 140, 200], 'wide', { aliases: ['ciasto', 'tort'] }),
  item('apple-pie', 'Szarlotka lub pieróg z nadzieniem', 'sweet', 'g', per(271, 2.5, 36, 13, 2), [80, 160, 240], 'normal', { piece: [80, 'szt.'], aliases: ['apple pie', 'szarlotka'] }),
  item('chocolate', 'Czekolada lub baton', 'sweet', 'g', per(532, 6, 55, 32, 3), [20, 50, 100], 'tight', { aliases: ['baton', 'snickers', 'wafelek'] }),
  item('brownie', 'Brownie lub ciastko', 'sweet', 'g', per(410, 5, 55, 20, 2.5), [40, 80, 120], 'normal', { piece: [40, 'szt.'], aliases: ['ciasteczko', 'muffin', 'babeczka'] }),
  item('pancake', 'Naleśnik z nadzieniem', 'sweet', 'g', per(190, 6, 28, 6, 1), [90, 180, 270], 'normal', { piece: [90, 'szt.'], aliases: ['naleśniki', 'gofr'] }),
]

export const plateItemsById: ReadonlyMap<string, PlateItem> = new Map(plateItems.map((entry) => [entry.id, entry]))

export function getPlateItem(id: string): PlateItem {
  const found = plateItemsById.get(id)
  if (!found) throw new Error(`Unknown plate item: ${id}`)
  return found
}

const fold = (text: string) => text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim()

const searchIndex = plateItems.map((entry) => ({ entry, text: fold([entry.name, ...(entry.aliases ?? [])].join(' ')) }))

/** Hand search by name or alias; every typed word has to appear. */
export function searchPlateItems(query: string, limit = 12): PlateItem[] {
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return []
  return searchIndex.filter(({ text }) => words.every((word) => text.includes(word))).slice(0, limit).map(({ entry }) => entry)
}

/** Maps a name written by a model to a catalogue id when it is the id itself or the exact Polish name. */
export function matchPlateName(name: string): string | null {
  const key = fold(name)
  if (!key) return null
  const direct = plateItemsById.get(name.trim().toLowerCase())
  if (direct) return direct.id
  const exact = plateItems.find((entry) => fold(entry.name) === key)
  return exact?.id ?? null
}
