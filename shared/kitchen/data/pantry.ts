import { per, type Ingredient } from '../types.ts'

export const pantryIngredients: readonly Ingredient[] = [
  {
    id: 'rice-white', nom: 'ryż biały', acc: 'ryż biały', ins: 'ryżem białym', gen: 'ryżu białego', en: 'white rice', emoji: '🍚',
    aliases: ['ryż', 'ryż basmati', 'ryż jaśminowy', 'ryż długoziarnisty', 'rice', 'white rice'],
    category: 'grain', roles: ['carb'], per100: per(350, 7, 78, 0.6, 1.3), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 15 },
  },
  {
    id: 'rice-brown', nom: 'ryż brązowy', acc: 'ryż brązowy', ins: 'ryżem brązowym', gen: 'ryżu brązowego', en: 'brown rice', emoji: '🍚',
    aliases: ['ryż pełnoziarnisty', 'ryż brunatny', 'brown rice'],
    category: 'grain', roles: ['carb'], per100: per(360, 7.5, 76, 2.7, 3.5), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 30 },
  },
  {
    id: 'pasta', nom: 'makaron', acc: 'makaron', ins: 'makaronem', gen: 'makaronu', en: 'pasta', emoji: '🍝',
    aliases: ['makaron pszenny', 'spaghetti', 'penne', 'fusilli', 'świderki'],
    category: 'grain', roles: ['carb'], per100: per(360, 12.5, 72, 1.5, 3), allergens: ['gluten'], diet: 'vegan',
    prep: 'Odmierz {acc}.', cook: { boil: 10 },
  },
  {
    id: 'couscous', nom: 'kuskus', acc: 'kuskus', ins: 'kuskusem', gen: 'kuskusu', en: 'couscous', emoji: '🍚',
    aliases: ['couscous', 'kasza kuskus'],
    category: 'grain', roles: ['carb'], per100: per(365, 12.8, 72.4, 0.6, 2.2), allergens: ['gluten'], diet: 'vegan',
    prep: 'Odmierz {acc}.', cook: { boil: 5 },
  },
  {
    id: 'bulgur', nom: 'kasza bulgur', acc: 'kaszę bulgur', ins: 'kaszą bulgur', gen: 'kaszy bulgur', en: 'bulgur', emoji: '🌾',
    aliases: ['bulgur'],
    category: 'grain', roles: ['carb'], per100: per(342, 12.3, 75.9, 1.3, 12.5), allergens: ['gluten'], diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 12 },
  },
  {
    id: 'buckwheat', nom: 'kasza gryczana', acc: 'kaszę gryczaną', ins: 'kaszą gryczaną', gen: 'kaszy gryczanej', en: 'buckwheat groats', emoji: '🌾',
    aliases: ['gryczana', 'kasza gryczana prażona', 'gryka', 'buckwheat'],
    category: 'grain', roles: ['carb'], per100: per(343, 12, 71, 3.3, 10), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 15 },
  },
  {
    id: 'millet', nom: 'kasza jaglana', acc: 'kaszę jaglaną', ins: 'kaszą jaglaną', gen: 'kaszy jaglanej', en: 'millet', emoji: '🌾',
    aliases: ['jaglana', 'proso', 'millet'],
    category: 'grain', roles: ['carb'], per100: per(360, 11, 72.9, 4, 8.5), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie wrzątkiem.', cook: { boil: 15 },
  },
  {
    id: 'quinoa', nom: 'komosa ryżowa', acc: 'komosę ryżową', ins: 'komosą ryżową', gen: 'komosy ryżowej', en: 'quinoa', emoji: '🌾',
    aliases: ['quinoa', 'kinoa'],
    category: 'grain', roles: ['carb'], per100: per(368, 14.1, 64.2, 6.1, 7), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 15 },
  },
  {
    id: 'oats', nom: 'płatki owsiane', acc: 'płatki owsiane', ins: 'płatkami owsianymi', gen: 'płatków owsianych', en: 'rolled oats', emoji: '🥣',
    aliases: ['owsianka', 'płatki owsiane górskie', 'oats', 'oatmeal', 'rolled oats'],
    category: 'grain', roles: ['carb'], per100: per(372, 13.5, 58.7, 7, 10), allergens: ['gluten'], diet: 'vegan',
    prep: 'Odmierz {acc}.', cook: { boil: 5, microwave: 3 },
  },
  {
    id: 'flour-wheat', nom: 'mąka pszenna', acc: 'mąkę pszenną', ins: 'mąką pszenną', gen: 'mąki pszennej', en: 'wheat flour', emoji: '🌾',
    aliases: ['mąka', 'mąka tortowa', 'mąka uniwersalna', 'flour', 'wheat flour'],
    category: 'grain', roles: ['carb'], per100: per(350, 10, 73, 1, 3), allergens: ['gluten'], diet: 'vegan',
    prep: 'Odmierz {acc}.', cook: { pan: 5 },
  },
  {
    id: 'rice-noodles', nom: 'makaron ryżowy', acc: 'makaron ryżowy', ins: 'makaronem ryżowym', gen: 'makaronu ryżowego', en: 'rice noodles', emoji: '🍜',
    aliases: ['noodles', 'rice noodles', 'makaron sojowy', 'makaron chiński'],
    category: 'grain', roles: ['carb'], per100: per(360, 6, 80, 0.6, 1.6), diet: 'vegan',
    prep: 'Odmierz {acc}.', cook: { boil: 5 },
  },
  {
    id: 'bread-wheat', nom: 'chleb pszenny', acc: 'chleb pszenny', ins: 'chlebem pszennym', gen: 'chleba pszennego', en: 'white bread', emoji: '🍞',
    aliases: ['chleb', 'pieczywo', 'chleb biały', 'chleb tostowy', 'tost', 'bagietka', 'bread', 'white bread', 'toast'],
    category: 'bread', roles: ['carb'], per100: per(265, 8, 50, 3, 2.7), piece: 30, allergens: ['gluten'], diet: 'vegan', ready: true,
  },
  {
    id: 'bread-whole', nom: 'chleb razowy', acc: 'chleb razowy', ins: 'chlebem razowym', gen: 'chleba razowego', en: 'whole grain bread', emoji: '🍞',
    aliases: ['chleb pełnoziarnisty', 'chleb żytni', 'chleb graham', 'chleb ciemny', 'whole grain bread', 'rye bread'],
    category: 'bread', roles: ['carb'], per100: per(250, 8.5, 46, 2.6, 6.5), piece: 35, allergens: ['gluten'], diet: 'vegan', ready: true,
  },
  {
    id: 'bread-roll', nom: 'bułka', acc: 'bułkę', ins: 'bułką', gen: 'bułki', en: 'bread roll', emoji: '🥖',
    aliases: ['bułki', 'bułka pszenna', 'bułka kajzerka', 'kajzerka', 'bread roll', 'roll'],
    category: 'bread', roles: ['carb'], per100: per(275, 9, 55, 2, 2.5), piece: 50, allergens: ['gluten'], diet: 'vegan', ready: true,
  },
  {
    id: 'tortilla', nom: 'tortilla', acc: 'tortillę', ins: 'tortillą', gen: 'tortilli', en: 'tortilla wrap', emoji: '🌯',
    aliases: ['tortille', 'placek tortilla', 'wrap', 'tortilla wrap'],
    category: 'bread', roles: ['carb'], per100: per(300, 8, 50, 7.5, 3), piece: 60, allergens: ['gluten'], diet: 'vegan', ready: true,
  },
  {
    id: 'chickpeas-canned', nom: 'ciecierzyca z puszki', acc: 'ciecierzycę z puszki', ins: 'ciecierzycą z puszki', gen: 'ciecierzycy z puszki', en: 'chickpeas', emoji: '🥫',
    aliases: ['ciecierzyca', 'cieciorka', 'ciecierzyca konserwowa', 'chickpeas'],
    category: 'legume', roles: ['protein', 'carb'], per100: per(119, 7, 16.5, 2.6, 5), diet: 'vegan', ready: true,
    prep: 'Odsącz i przepłucz {acc}.',
  },
  {
    id: 'kidney-beans-canned', nom: 'czerwona fasola z puszki', acc: 'czerwoną fasolę z puszki', ins: 'czerwoną fasolą z puszki', gen: 'czerwonej fasoli z puszki', en: 'red kidney beans', emoji: '🥫',
    aliases: ['fasola czerwona', 'fasola', 'fasola konserwowa', 'kidney beans', 'red kidney beans'],
    category: 'legume', roles: ['protein', 'carb'], per100: per(90, 6.9, 14, 0.5, 5.5), diet: 'vegan', ready: true,
    prep: 'Odsącz i przepłucz {acc}.',
  },
  {
    id: 'white-beans-canned', nom: 'biała fasola z puszki', acc: 'białą fasolę z puszki', ins: 'białą fasolą z puszki', gen: 'białej fasoli z puszki', en: 'white beans', emoji: '🥫',
    aliases: ['fasola biała', 'fasola jaś', 'jaś', 'fasolka biała', 'white beans', 'cannellini beans'],
    category: 'legume', roles: ['protein', 'carb'], per100: per(85, 6, 13, 0.4, 5), diet: 'vegan', ready: true,
    prep: 'Odsącz i przepłucz {acc}.',
  },
  {
    id: 'lentils-red', nom: 'soczewica czerwona', acc: 'soczewicę czerwoną', ins: 'soczewicą czerwoną', gen: 'soczewicy czerwonej', en: 'red lentils', emoji: '🌱',
    aliases: ['soczewica', 'czerwona soczewica', 'red lentils', 'lentils'],
    category: 'legume', roles: ['protein', 'carb'], per100: per(340, 25, 60, 1.1, 11), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 15 },
  },
  {
    id: 'lentils-green', nom: 'soczewica zielona', acc: 'soczewicę zieloną', ins: 'soczewicą zieloną', gen: 'soczewicy zielonej', en: 'green lentils', emoji: '🌱',
    aliases: ['zielona soczewica', 'soczewica brązowa', 'brązowa soczewica', 'green lentils', 'brown lentils'],
    category: 'legume', roles: ['protein', 'carb'], per100: per(350, 24, 60, 1.9, 11), diet: 'vegan',
    prep: 'Przepłucz {acc} na sicie.', cook: { boil: 25 },
  },
  {
    id: 'tofu', nom: 'tofu', acc: 'tofu', ins: 'tofu', gen: 'tofu', en: 'tofu', emoji: '⬜',
    aliases: ['tofu naturalne', 'tofu wędzone', 'ser sojowy'],
    category: 'legume', roles: ['protein'], per100: per(121, 12.5, 2, 7, 1), allergens: ['soy'], diet: 'vegan',
    prep: 'Osusz {acc} ręcznikiem papierowym i pokrój w kostkę 2 cm.', cook: { pan: 8, oven: 20, air: 12 }, done: 'aż tofu będzie złociste z każdej strony',
  },
  {
    id: 'hummus', nom: 'hummus', acc: 'hummus', ins: 'hummusem', gen: 'hummusu', en: 'hummus', emoji: '🥣',
    aliases: ['humus', 'pasta z ciecierzycy'],
    category: 'sauce', roles: ['sauce', 'topping'], per100: per(240, 7, 11, 19, 5), allergens: ['sesame'], diet: 'vegan', ready: true,
  },
  {
    id: 'soy-sauce', nom: 'sos sojowy', acc: 'sos sojowy', ins: 'sosem sojowym', gen: 'sosu sojowego', en: 'soy sauce', emoji: '🍶',
    aliases: ['sos sojowy jasny', 'sos sojowy ciemny', 'soy sauce'],
    category: 'sauce', roles: ['sauce'], per100: per(60, 8, 5.6, 0.1, 0.8), allergens: ['soy', 'gluten'], diet: 'vegan',
  },
  {
    id: 'ketchup', nom: 'ketchup', acc: 'ketchup', ins: 'ketchupem', gen: 'ketchupu', en: 'ketchup', emoji: '🍅',
    aliases: ['ketchup pomidorowy', 'ketchup łagodny'],
    category: 'sauce', roles: ['sauce'], per100: per(100, 1.2, 25, 0.1, 0.3), diet: 'vegan',
  },
  {
    id: 'mustard', nom: 'musztarda', acc: 'musztardę', ins: 'musztardą', gen: 'musztardy', en: 'mustard', emoji: '🟡',
    aliases: ['musztarda sarepska', 'musztarda dijon', 'musztarda miodowa', 'mustard'],
    category: 'sauce', roles: ['sauce'], per100: per(70, 4, 5, 4, 1.5), allergens: ['mustard'], diet: 'vegan',
  },
  {
    id: 'mayonnaise', nom: 'majonez', acc: 'majonez', ins: 'majonezem', gen: 'majonezu', en: 'mayonnaise', emoji: '🥚',
    aliases: ['majonez kielecki', 'majonez dekoracyjny', 'mayonnaise', 'mayo'],
    category: 'sauce', roles: ['sauce'], per100: per(680, 1, 3, 74), allergens: ['egg', 'mustard'], diet: 'vegetarian',
  },
  {
    id: 'pesto', nom: 'pesto', acc: 'pesto', ins: 'pesto', gen: 'pesto', en: 'basil pesto', emoji: '🌿',
    aliases: ['pesto bazyliowe', 'pesto zielone', 'pesto genovese', 'pesto czerwone', 'basil pesto'],
    category: 'sauce', roles: ['sauce'], per100: per(450, 5, 5, 45, 1.5), allergens: ['milk', 'nuts'], diet: 'vegetarian',
  },
  {
    id: 'canned-tomatoes', nom: 'pomidory z puszki', acc: 'pomidory z puszki', ins: 'pomidorami z puszki', gen: 'pomidorów z puszki', en: 'chopped canned tomatoes', emoji: '🥫',
    aliases: ['pomidory krojone', 'pomidory w puszce', 'pomidory w kawałkach', 'pomidory pelati', 'chopped tomatoes', 'canned tomatoes'],
    category: 'sauce', roles: ['sauce'], per100: per(24, 1.2, 4.3, 0.2, 1.1), diet: 'vegan',
  },
  {
    id: 'passata', nom: 'przecier pomidorowy', acc: 'przecier pomidorowy', ins: 'przecierem pomidorowym', gen: 'przecieru pomidorowego', en: 'tomato passata', emoji: '🍅',
    aliases: ['passata', 'passata pomidorowa', 'sos pomidorowy', 'sos pomidorowy do makaronu', 'tomato passata'],
    category: 'sauce', roles: ['sauce'], per100: per(30, 1.4, 5.5, 0.2, 1.2), diet: 'vegan',
  },
  {
    id: 'tomato-paste', nom: 'koncentrat pomidorowy', acc: 'koncentrat pomidorowy', ins: 'koncentratem pomidorowym', gen: 'koncentratu pomidorowego', en: 'tomato paste', emoji: '🍅',
    aliases: ['koncentrat', 'przecier pomidorowy skoncentrowany', 'tomato paste', 'tomato puree'],
    category: 'sauce', roles: ['sauce'], per100: per(82, 4.3, 16, 0.5, 4), diet: 'vegan',
  },
  {
    id: 'balsamic-vinegar', nom: 'ocet balsamiczny', acc: 'ocet balsamiczny', ins: 'octem balsamicznym', gen: 'octu balsamicznego', en: 'balsamic vinegar', emoji: '🍇',
    aliases: ['balsamico', 'ocet', 'ocet winny', 'balsamic vinegar', 'vinegar'],
    category: 'sauce', roles: ['sauce'], per100: per(82, 0.5, 18, 0), diet: 'vegan',
  },
  {
    id: 'hot-sauce', nom: 'ostry sos', acc: 'ostry sos', ins: 'ostrym sosem', gen: 'ostrego sosu', en: 'hot chili sauce', emoji: '🌶️',
    aliases: ['sos chili', 'sos ostry', 'sriracha', 'tabasco', 'hot sauce', 'chili sauce'],
    category: 'sauce', roles: ['sauce', 'spice'], per100: per(15, 0.5, 3, 0.1, 0.3), diet: 'vegan', spicy: true,
  },
  {
    id: 'honey', nom: 'miód', acc: 'miód', ins: 'miodem', gen: 'miodu', en: 'honey', emoji: '🍯',
    aliases: ['miód pszczeli', 'miód wielokwiatowy', 'honey'],
    category: 'sweet', roles: ['sweet'], per100: per(320, 0.3, 80, 0), diet: 'vegetarian',
  },
  {
    id: 'jam', nom: 'dżem', acc: 'dżem', ins: 'dżemem', gen: 'dżemu', en: 'fruit jam', emoji: '🍓',
    aliases: ['konfitura', 'marmolada', 'powidła', 'jam', 'fruit jam'],
    category: 'sweet', roles: ['sweet'], per100: per(250, 0.4, 62, 0.1, 0.5), diet: 'vegan',
  },
  {
    id: 'cocoa', nom: 'kakao', acc: 'kakao', ins: 'kakao', gen: 'kakao', en: 'cocoa powder', emoji: '🍫',
    aliases: ['kakao ciemne', 'kakao naturalne', 'cocoa', 'cocoa powder'],
    category: 'sweet', roles: ['sweet'], per100: per(330, 21, 42, 11, 29), diet: 'vegan',
  },
  {
    id: 'sugar', nom: 'cukier', acc: 'cukier', ins: 'cukrem', gen: 'cukru', en: 'sugar', emoji: '🍬',
    aliases: ['cukier biały', 'cukier kryształ', 'cukier trzcinowy', 'sugar'],
    category: 'sweet', roles: ['sweet'], per100: per(400, 0, 100, 0), diet: 'vegan',
  },
  {
    id: 'coconut-milk', nom: 'mleczko kokosowe', acc: 'mleczko kokosowe', ins: 'mleczkiem kokosowym', gen: 'mleczka kokosowego', en: 'coconut milk', emoji: '🥥',
    aliases: ['mleko kokosowe', 'coconut milk', 'coconut cream'],
    category: 'liquid', roles: ['liquid', 'sauce'], per100: per(185, 1.8, 3, 19), diet: 'vegan',
  },
  {
    id: 'broth', nom: 'bulion warzywny', acc: 'bulion warzywny', ins: 'bulionem warzywnym', gen: 'bulionu warzywnego', en: 'vegetable broth', emoji: '🍲',
    aliases: ['bulion', 'kostka bulionowa', 'kostka warzywna', 'vegetable broth', 'broth', 'stock'],
    category: 'liquid', roles: ['liquid'], per100: per(5, 0.5, 0.5, 0.2), allergens: ['celery'], diet: 'vegan',
  },
  {
    id: 'water', nom: 'woda', acc: 'wodę', ins: 'wodą', gen: 'wody', en: 'water', emoji: '💧',
    aliases: ['woda z kranu', 'water'],
    category: 'liquid', roles: ['liquid'], per100: per(0, 0, 0, 0), diet: 'vegan', ready: true,
  },
  {
    id: 'olive-oil', nom: 'oliwa z oliwek', acc: 'oliwę z oliwek', ins: 'oliwą z oliwek', gen: 'oliwy z oliwek', en: 'olive oil', emoji: '🫒',
    aliases: ['oliwa', 'oliwa extra virgin', 'oliwa z oliwek extra virgin', 'olive oil'],
    category: 'fat', roles: ['fat'], per100: per(884, 0, 0, 100), diet: 'vegan',
  },
  {
    id: 'rapeseed-oil', nom: 'olej rzepakowy', acc: 'olej rzepakowy', ins: 'olejem rzepakowym', gen: 'oleju rzepakowego', en: 'rapeseed oil', emoji: '🌼',
    aliases: ['olej', 'olej roślinny', 'olej do smażenia', 'rapeseed oil', 'vegetable oil'],
    category: 'fat', roles: ['fat'], per100: per(884, 0, 0, 100), diet: 'vegan', staple: true,
  },
  {
    id: 'butter', nom: 'masło', acc: 'masło', ins: 'masłem', gen: 'masła', en: 'butter', emoji: '🧈',
    aliases: ['masło extra', 'masło ekstra', 'masło osełkowe', 'butter'],
    category: 'fat', roles: ['fat'], per100: per(740, 0.7, 0.6, 82), allergens: ['milk'], diet: 'vegetarian',
  },
  {
    id: 'peanut-butter', nom: 'masło orzechowe', acc: 'masło orzechowe', ins: 'masłem orzechowym', gen: 'masła orzechowego', en: 'peanut butter', emoji: '🥜',
    aliases: ['masło z orzeszków ziemnych', 'peanut butter'],
    category: 'nut', roles: ['topping', 'fat'], per100: per(600, 25, 14, 50, 6), allergens: ['peanuts'], diet: 'vegan', ready: true,
  },
  {
    id: 'walnuts', nom: 'orzechy włoskie', acc: 'orzechy włoskie', ins: 'orzechami włoskimi', gen: 'orzechów włoskich', en: 'walnuts', emoji: '🌰',
    aliases: ['orzech włoski', 'orzechy', 'walnuts'],
    category: 'nut', roles: ['topping'], per100: per(654, 15, 14, 65, 6.7), allergens: ['nuts'], diet: 'vegan', ready: true,
  },
  {
    id: 'almonds', nom: 'migdały', acc: 'migdały', ins: 'migdałami', gen: 'migdałów', en: 'almonds', emoji: '🌰',
    aliases: ['migdał', 'płatki migdałowe', 'almonds'],
    category: 'nut', roles: ['topping'], per100: per(579, 21, 22, 50, 12.5), allergens: ['nuts'], diet: 'vegan', ready: true,
  },
  {
    id: 'sunflower-seeds', nom: 'pestki słonecznika', acc: 'pestki słonecznika', ins: 'pestkami słonecznika', gen: 'pestek słonecznika', en: 'sunflower seeds', emoji: '🌻',
    aliases: ['słonecznik', 'nasiona słonecznika', 'sunflower seeds'],
    category: 'nut', roles: ['topping'], per100: per(584, 21, 20, 51, 8.6), diet: 'vegan', ready: true,
  },
  {
    id: 'chia', nom: 'nasiona chia', acc: 'nasiona chia', ins: 'nasionami chia', gen: 'nasion chia', en: 'chia seeds', emoji: '🌱',
    aliases: ['chia', 'szałwia hiszpańska', 'chia seeds'],
    category: 'nut', roles: ['topping'], per100: per(486, 16.5, 42, 31, 34), diet: 'vegan', ready: true,
  },
  {
    id: 'salt', nom: 'sól', acc: 'sól', ins: 'solą', gen: 'soli', en: 'salt', emoji: '🧂',
    aliases: ['sól kuchenna', 'sól morska', 'salt'],
    category: 'spice', roles: ['spice'], per100: per(0, 0, 0, 0), diet: 'vegan', staple: true,
  },
  {
    id: 'pepper', nom: 'pieprz', acc: 'pieprz', ins: 'pieprzem', gen: 'pieprzu', en: 'black pepper', emoji: '⚫',
    aliases: ['pieprz czarny', 'pieprz mielony', 'pepper', 'black pepper'],
    category: 'spice', roles: ['spice'], per100: per(250, 10, 64, 3.3, 25), diet: 'vegan', staple: true,
  },
  {
    id: 'paprika-sweet', nom: 'papryka słodka', acc: 'paprykę słodką', ins: 'papryką słodką', gen: 'papryki słodkiej', en: 'sweet paprika', emoji: '🌶️',
    aliases: ['papryka mielona', 'papryka w proszku', 'papryka wędzona', 'sweet paprika', 'paprika'],
    category: 'spice', roles: ['spice'], per100: per(282, 14, 54, 13, 35), diet: 'vegan', staple: true,
  },
  {
    id: 'garlic-granulated', nom: 'czosnek granulowany', acc: 'czosnek granulowany', ins: 'czosnkiem granulowanym', gen: 'czosnku granulowanego', en: 'garlic powder', emoji: '🧄',
    aliases: ['czosnek suszony', 'czosnek w proszku', 'garlic powder', 'granulated garlic'],
    category: 'spice', roles: ['spice'], per100: per(331, 16.5, 73, 0.7, 9), diet: 'vegan', staple: true,
  },
  {
    id: 'herbs-mixed', nom: 'zioła mieszane', acc: 'zioła mieszane', ins: 'ziołami mieszanymi', gen: 'ziół mieszanych', en: 'mixed herbs', emoji: '🌿',
    aliases: ['zioła prowansalskie', 'mieszanka ziół', 'zioła', 'przyprawa ziołowa', 'mixed herbs', 'herbes de provence'],
    category: 'spice', roles: ['spice'], per100: per(260, 10, 62, 5, 38), diet: 'vegan', staple: true,
  },
  {
    id: 'chili-flakes', nom: 'płatki chili', acc: 'płatki chili', ins: 'płatkami chili', gen: 'płatków chili', en: 'chili flakes', emoji: '🌶️',
    aliases: ['chili', 'chilli', 'papryczka chili', 'papryka chili', 'papryczki chili', 'płatki chilli', 'chili flakes'],
    category: 'spice', roles: ['spice'], per100: per(320, 12, 50, 14, 28), diet: 'vegan', spicy: true,
  },
  {
    id: 'curry-powder', nom: 'curry', acc: 'curry', ins: 'curry', gen: 'curry', en: 'curry powder', emoji: '🍛',
    aliases: ['przyprawa curry', 'curry w proszku', 'curry powder'],
    category: 'spice', roles: ['spice'], per100: per(330, 13, 55, 14, 33), diet: 'vegan', spicy: true,
  },
  {
    id: 'cumin', nom: 'kmin rzymski', acc: 'kmin rzymski', ins: 'kminem rzymskim', gen: 'kminu rzymskiego', en: 'ground cumin', emoji: '🌿',
    aliases: ['kmin', 'kumin', 'cumin'],
    category: 'spice', roles: ['spice'], per100: per(375, 17.8, 44.2, 22.3, 10.5), diet: 'vegan',
  },
  {
    id: 'cinnamon', nom: 'cynamon', acc: 'cynamon', ins: 'cynamonem', gen: 'cynamonu', en: 'cinnamon', emoji: '🍂',
    aliases: ['cynamon mielony', 'cinnamon'],
    category: 'spice', roles: ['spice'], per100: per(247, 4, 80.6, 1.2, 53.1), diet: 'vegan',
  },
  {
    id: 'oregano', nom: 'oregano', acc: 'oregano', ins: 'oregano', gen: 'oregano', en: 'oregano', emoji: '🌿',
    aliases: ['oregano suszone', 'majeranek'],
    category: 'spice', roles: ['spice'], per100: per(265, 9, 69, 4.3, 43), diet: 'vegan',
  },
  {
    id: 'basil-dried', nom: 'bazylia suszona', acc: 'bazylię suszoną', ins: 'bazylią suszoną', gen: 'bazylii suszonej', en: 'basil', emoji: '🌿',
    aliases: ['bazylia', 'bazylia świeża', 'basil', 'dried basil'],
    category: 'spice', roles: ['spice'], per100: per(233, 23, 48, 4, 38), diet: 'vegan',
  },
  {
    id: 'thyme', nom: 'tymianek', acc: 'tymianek', ins: 'tymiankiem', gen: 'tymianku', en: 'thyme', emoji: '🌿',
    aliases: ['tymianek suszony', 'thyme'],
    category: 'spice', roles: ['spice'], per100: per(276, 9.1, 63.9, 7.4, 37), diet: 'vegan',
  },
  {
    id: 'parsley', nom: 'natka pietruszki', acc: 'natkę pietruszki', ins: 'natką pietruszki', gen: 'natki pietruszki', en: 'fresh parsley', emoji: '🌿',
    aliases: ['pietruszka', 'natka', 'pietruszka natka', 'parsley'],
    category: 'spice', roles: ['spice', 'topping'], per100: per(36, 3, 6.3, 0.8, 3.3), diet: 'vegan', ready: true,
    prep: 'Posiekaj {acc}.',
  },
  {
    id: 'dill', nom: 'koperek', acc: 'koperek', ins: 'koperkiem', gen: 'koperku', en: 'fresh dill', emoji: '🌿',
    aliases: ['koper', 'koperek świeży', 'dill'],
    category: 'spice', roles: ['spice', 'topping'], per100: per(43, 3.5, 7, 1.1, 2.1), diet: 'vegan', ready: true,
    prep: 'Posiekaj {acc}.',
  },
  {
    id: 'chives', nom: 'szczypiorek', acc: 'szczypiorek', ins: 'szczypiorkiem', gen: 'szczypiorku', en: 'fresh chives', emoji: '🌿',
    aliases: ['szczypior', 'szczypiorek świeży', 'chives'],
    category: 'spice', roles: ['spice', 'topping'], per100: per(30, 3.3, 4.4, 0.7, 2.5), diet: 'vegan', ready: true,
    prep: 'Posiekaj {acc}.',
  },
  {
    id: 'ginger', nom: 'imbir', acc: 'imbir', ins: 'imbirem', gen: 'imbiru', en: 'fresh ginger', emoji: '🫚',
    aliases: ['imbir świeży', 'korzeń imbiru', 'imbir mielony', 'ginger'],
    category: 'spice', roles: ['spice'], per100: per(80, 1.8, 17.8, 0.8, 2), diet: 'vegan',
  },
]
