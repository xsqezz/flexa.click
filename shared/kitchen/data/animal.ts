import { per, type Ingredient } from '../types.ts'

const meatDone = 'aż mięso będzie białe w środku, a sok przezroczysty'
const porkDone = 'aż mięso straci różowy kolor, a sok będzie przezroczysty'
const mincedDone = 'aż mięso straci różowy kolor i lekko się zarumieni'
const fishDone = 'aż ryba będzie nieprzezroczysta i łatwo rozpadnie się na płatki'

export const animalIngredients: readonly Ingredient[] = [
  {
    id: 'chicken-breast', nom: 'pierś z kurczaka', acc: 'pierś z kurczaka', ins: 'piersią z kurczaka', gen: 'piersi z kurczaka', en: 'chicken breast', emoji: '🍗',
    aliases: ['filet z kurczaka', 'pierś kurczaka', 'filet z piersi kurczaka', 'kurczak', 'chicken', 'chicken breast'],
    category: 'meat', roles: ['protein'], per100: per(112, 23, 0, 2), diet: 'omnivore',
    prep: 'Pokrój {acc} w kostkę 2–3 cm.', cook: { pan: 8, oven: 20, air: 12 }, done: meatDone,
  },
  {
    id: 'chicken-thigh', nom: 'filet z udka kurczaka', acc: 'filet z udka kurczaka', ins: 'filetem z udka kurczaka', gen: 'filetu z udka kurczaka', en: 'boneless chicken thigh', emoji: '🍗',
    aliases: ['udko z kurczaka', 'udka z kurczaka', 'udko kurczaka', 'udka kurczaka', 'chicken thigh', 'chicken thighs'],
    category: 'meat', roles: ['protein'], per100: per(140, 19.5, 0, 7), diet: 'omnivore',
    prep: 'Pokrój {acc} w kawałki 3 cm.', cook: { pan: 10, oven: 25, air: 15 }, done: 'aż mięso będzie całkiem ugotowane, a sok przezroczysty',
  },
  {
    id: 'turkey-breast', nom: 'pierś z indyka', acc: 'pierś z indyka', ins: 'piersią z indyka', gen: 'piersi z indyka', en: 'turkey breast', emoji: '🦃',
    aliases: ['filet z indyka', 'pierś indyka', 'indyk', 'turkey', 'turkey breast'],
    category: 'meat', roles: ['protein'], per100: per(105, 23.5, 0, 1.2), diet: 'omnivore',
    prep: 'Pokrój {acc} w kostkę 2–3 cm.', cook: { pan: 8, oven: 20, air: 12 }, done: meatDone,
  },
  {
    id: 'minced-beef', nom: 'mielona wołowina', acc: 'mieloną wołowinę', ins: 'mieloną wołowiną', gen: 'mielonej wołowiny', en: 'minced beef', emoji: '🥩',
    aliases: ['wołowina mielona', 'mięso mielone wołowe', 'mielone mięso wołowe', 'wołowina', 'minced beef', 'ground beef', 'beef'],
    category: 'meat', roles: ['protein'], per100: per(215, 19, 0, 15), diet: 'omnivore',
    prep: 'Rozbij {acc} widelcem na mniejsze kawałki.', cook: { pan: 8 }, done: mincedDone,
  },
  {
    id: 'minced-pork', nom: 'mielona wieprzowina', acc: 'mieloną wieprzowinę', ins: 'mieloną wieprzowiną', gen: 'mielonej wieprzowiny', en: 'minced pork', emoji: '🥩',
    aliases: ['wieprzowina mielona', 'mięso mielone', 'mięso mielone wieprzowe', 'mielone mięso wieprzowe', 'minced pork', 'ground pork'],
    category: 'meat', roles: ['protein'], per100: per(240, 17, 0, 19), diet: 'omnivore',
    prep: 'Rozbij {acc} widelcem na mniejsze kawałki.', cook: { pan: 8 }, done: mincedDone,
  },
  {
    id: 'minced-turkey', nom: 'mielone mięso z indyka', acc: 'mielone mięso z indyka', ins: 'mielonym mięsem z indyka', gen: 'mielonego mięsa z indyka', en: 'minced turkey', emoji: '🦃',
    aliases: ['mielony indyk', 'indyk mielony', 'mięso mielone z indyka', 'minced turkey', 'ground turkey'],
    category: 'meat', roles: ['protein'], per100: per(150, 20, 0, 8), diet: 'omnivore',
    prep: 'Rozbij {acc} widelcem na mniejsze kawałki.', cook: { pan: 8 }, done: mincedDone,
  },
  {
    id: 'pork-loin', nom: 'schab', acc: 'schab', ins: 'schabem', gen: 'schabu', en: 'pork loin', emoji: '🥩',
    aliases: ['schab wieprzowy', 'wieprzowina', 'pork', 'pork loin'],
    category: 'meat', roles: ['protein'], per100: per(143, 21, 0, 6.5), diet: 'omnivore',
    prep: 'Pokrój {acc} w plastry 1,5 cm i lekko rozbij.', cook: { pan: 10, oven: 22, air: 12 }, done: porkDone,
  },
  {
    id: 'ham', nom: 'szynka', acc: 'szynkę', ins: 'szynką', gen: 'szynki', en: 'ham', emoji: '🍖',
    aliases: ['szynka wieprzowa', 'szynka gotowana', 'szynka z indyka', 'wędlina', 'ham'],
    category: 'meat', roles: ['protein', 'topping'], per100: per(110, 18, 1, 3.5), diet: 'omnivore', ready: true,
    prep: 'Pokrój {acc} w kostkę.',
  },
  {
    id: 'sausage', nom: 'kiełbasa', acc: 'kiełbasę', ins: 'kiełbasą', gen: 'kiełbasy', en: 'sausage', emoji: '🌭',
    aliases: ['kiełbasa śląska', 'kiełbasa wieprzowa', 'kiełbaska', 'kiełbaski', 'kabanos', 'sausage'],
    category: 'meat', roles: ['protein'], per100: per(320, 14, 2, 28), diet: 'omnivore', ready: true,
    prep: 'Pokrój {acc} w półplasterki.',
  },
  {
    id: 'bacon', nom: 'boczek', acc: 'boczek', ins: 'boczkiem', gen: 'boczku', en: 'bacon', emoji: '🥓',
    aliases: ['boczek wędzony', 'boczek wieprzowy', 'bekon', 'bacon'],
    category: 'meat', roles: ['protein'], per100: per(410, 13, 0, 39), diet: 'omnivore',
    prep: 'Pokrój {acc} w paski szerokości 1 cm.', cook: { pan: 6, oven: 12, air: 7 }, done: 'aż się zarumieni',
  },
  {
    id: 'frankfurters', nom: 'parówki', acc: 'parówki', ins: 'parówkami', gen: 'parówek', en: 'frankfurters', emoji: '🌭',
    aliases: ['parówka', 'parówki wieprzowe', 'parówki drobiowe', 'hot dog', 'frankfurters'],
    category: 'meat', roles: ['protein'], per100: per(250, 11, 2, 22), diet: 'omnivore', ready: true, piece: 50,
    prep: 'Pokrój {acc} w plasterki.',
  },
  {
    id: 'salmon', nom: 'łosoś', acc: 'łososia', ins: 'łososiem', gen: 'łososia', en: 'salmon fillet', emoji: '🐟',
    aliases: ['filet z łososia', 'łosoś świeży', 'łosoś atlantycki', 'salmon', 'salmon fillet'],
    category: 'fish', roles: ['protein'], per100: per(205, 20, 0, 13.5), allergens: ['fish'], diet: 'pescatarian',
    prep: 'Osusz {acc} ręcznikiem papierowym i pokrój w kawałki 3–4 cm.', cook: { pan: 6, oven: 14, air: 9 }, done: fishDone,
  },
  {
    id: 'cod', nom: 'dorsz', acc: 'dorsza', ins: 'dorszem', gen: 'dorsza', en: 'white fish fillet', emoji: '🐟',
    aliases: ['filet z dorsza', 'ryba biała', 'biała ryba', 'filet z białej ryby', 'ryba', 'mintaj', 'filet z mintaja', 'cod', 'white fish'],
    category: 'fish', roles: ['protein'], per100: per(82, 18, 0, 0.7), allergens: ['fish'], diet: 'pescatarian',
    prep: 'Osusz {acc} ręcznikiem papierowym i pokrój w kawałki 3–4 cm.', cook: { pan: 5, oven: 12, air: 8 }, done: fishDone,
  },
  {
    id: 'tuna-canned', nom: 'tuńczyk z puszki', acc: 'tuńczyka z puszki', ins: 'tuńczykiem z puszki', gen: 'tuńczyka z puszki', en: 'canned tuna', emoji: '🥫',
    aliases: ['tuńczyk', 'tuńczyk w puszce', 'tuńczyk w sosie własnym', 'tuńczyk w oleju', 'tuna', 'canned tuna'],
    category: 'fish', roles: ['protein'], per100: per(116, 26, 0, 1), allergens: ['fish'], diet: 'pescatarian', ready: true,
    prep: 'Odsącz {acc} z zalewy.',
  },
  {
    id: 'sardines-canned', nom: 'sardynki z puszki', acc: 'sardynki z puszki', ins: 'sardynkami z puszki', gen: 'sardynek z puszki', en: 'canned sardines', emoji: '🥫',
    aliases: ['sardynki', 'sardynki w puszce', 'sardynki w oleju', 'sardynka', 'sardines'],
    category: 'fish', roles: ['protein'], per100: per(208, 24.6, 0, 11.5), allergens: ['fish'], diet: 'pescatarian', ready: true,
    prep: 'Odsącz {acc} z zalewy.',
  },
  {
    id: 'mackerel-smoked', nom: 'wędzona makrela', acc: 'wędzoną makrelę', ins: 'wędzoną makrelą', gen: 'wędzonej makreli', en: 'smoked mackerel', emoji: '🐟',
    aliases: ['makrela', 'makrela wędzona', 'smoked mackerel', 'mackerel'],
    category: 'fish', roles: ['protein'], per100: per(305, 19, 0, 25), allergens: ['fish'], diet: 'pescatarian', ready: true,
    prep: 'Zdejmij skórę z {gen} i usuń ości, a mięso rozdziel na kawałki.',
  },
  {
    id: 'salmon-smoked', nom: 'wędzony łosoś', acc: 'wędzonego łososia', ins: 'wędzonym łososiem', gen: 'wędzonego łososia', en: 'smoked salmon', emoji: '🐟',
    aliases: ['łosoś wędzony', 'łosoś wędzony na zimno', 'smoked salmon'],
    category: 'fish', roles: ['protein'], per100: per(180, 22, 0, 10.5), allergens: ['fish'], diet: 'pescatarian', ready: true,
    prep: 'Pokrój {acc} w wąskie paski.',
  },
  {
    id: 'shrimp', nom: 'krewetki', acc: 'krewetki', ins: 'krewetkami', gen: 'krewetek', en: 'shrimp', emoji: '🦐',
    aliases: ['krewetka', 'owoce morza', 'shrimp', 'prawns'],
    category: 'fish', roles: ['protein'], per100: per(85, 18, 0.5, 1), allergens: ['crustaceans'], diet: 'pescatarian',
    prep: 'Jeśli są mrożone, rozmroź i osusz {acc} ręcznikiem papierowym.', cook: { pan: 4, oven: 8, air: 6 }, done: 'aż krewetki zrobią się różowe i nieprzezroczyste',
  },
  {
    id: 'egg', nom: 'jajka', acc: 'jajka', ins: 'jajkami', gen: 'jajek', en: 'eggs', emoji: '🥚',
    aliases: ['jajko', 'jaja', 'jajo', 'jajka kurze', 'eggs', 'egg'],
    category: 'egg', roles: ['protein'], per100: per(143, 12.5, 0.7, 9.5), piece: 55, allergens: ['egg'], diet: 'vegetarian',
    prep: 'Wbij {acc} do miseczki.', cook: { pan: 4, boil: 9, microwave: 2 },
  },
  {
    id: 'milk', nom: 'mleko', acc: 'mleko', ins: 'mlekiem', gen: 'mleka', en: 'milk', emoji: '🥛',
    aliases: ['mleko krowie', 'mleko świeże', 'milk'],
    category: 'dairy', roles: ['dairy', 'liquid'], per100: per(50, 3.4, 4.8, 2), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'yogurt-natural', nom: 'jogurt naturalny', acc: 'jogurt naturalny', ins: 'jogurtem naturalnym', gen: 'jogurtu naturalnego', en: 'plain yogurt', emoji: '🥛',
    aliases: ['jogurt', 'jogurt biały', 'jogurt klasyczny', 'plain yogurt', 'yogurt', 'yoghurt'],
    category: 'dairy', roles: ['dairy', 'sauce'], per100: per(62, 4.3, 6.2, 2), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'yogurt-greek', nom: 'jogurt grecki', acc: 'jogurt grecki', ins: 'jogurtem greckim', gen: 'jogurtu greckiego', en: 'greek yogurt', emoji: '🥛',
    aliases: ['jogurt typu greckiego', 'jogurt naturalny typu greckiego', 'greek yogurt', 'greek yoghurt'],
    category: 'dairy', roles: ['dairy', 'sauce'], per100: per(115, 5, 4, 8.5), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'skyr', nom: 'skyr', acc: 'skyr', ins: 'skyrem', gen: 'skyru', en: 'skyr', emoji: '🥛',
    aliases: ['jogurt skyr', 'skyr naturalny', 'islandzki jogurt'],
    category: 'dairy', roles: ['dairy'], per100: per(63, 11, 4, 0.2), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'kefir', nom: 'kefir', acc: 'kefir', ins: 'kefirem', gen: 'kefiru', en: 'kefir', emoji: '🥛',
    aliases: ['kefir naturalny'],
    category: 'dairy', roles: ['dairy', 'liquid'], per100: per(51, 3.4, 4.7, 2), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'cottage-cheese', nom: 'serek wiejski', acc: 'serek wiejski', ins: 'serkiem wiejskim', gen: 'serka wiejskiego', en: 'cottage cheese', emoji: '🧀',
    aliases: ['ser wiejski', 'serek wiejski ziarnisty', 'twarożek ziarnisty', 'cottage cheese'],
    category: 'cheese', roles: ['protein', 'dairy'], per100: per(98, 11.5, 3.2, 4), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'quark', nom: 'twaróg', acc: 'twaróg', ins: 'twarogiem', gen: 'twarogu', en: 'quark', emoji: '🧀',
    aliases: ['twaróg półtłusty', 'twaróg chudy', 'twaróg tłusty', 'ser biały', 'twarożek', 'quark', 'farmer cheese'],
    category: 'cheese', roles: ['protein', 'dairy'], per100: per(133, 18, 3.5, 5.5), allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Rozgnieć {acc} widelcem.',
  },
  {
    id: 'cream', nom: 'śmietana 18%', acc: 'śmietanę 18%', ins: 'śmietaną 18%', gen: 'śmietany 18%', en: 'sour cream', emoji: '🥛',
    aliases: ['śmietana', 'śmietana kwaśna', 'śmietana do zup i sosów', 'sour cream'],
    category: 'dairy', roles: ['dairy', 'sauce'], per100: per(190, 2.5, 3.4, 18), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'cream-heavy', nom: 'śmietanka 30%', acc: 'śmietankę 30%', ins: 'śmietanką 30%', gen: 'śmietanki 30%', en: 'heavy cream', emoji: '🥛',
    aliases: ['śmietanka', 'śmietanka kremówka', 'kremówka', 'śmietana kremówka', 'heavy cream', 'whipping cream'],
    category: 'dairy', roles: ['dairy', 'sauce'], per100: per(290, 2.2, 3, 30), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'cream-cheese', nom: 'serek śmietankowy', acc: 'serek śmietankowy', ins: 'serkiem śmietankowym', gen: 'serka śmietankowego', en: 'cream cheese', emoji: '🧀',
    aliases: ['serek kremowy', 'serek do smarowania', 'ser kremowy', 'twarożek kremowy', 'philadelphia', 'cream cheese'],
    category: 'cheese', roles: ['sauce', 'dairy'], per100: per(250, 5.5, 4, 24), allergens: ['milk'], diet: 'vegetarian', ready: true,
  },
  {
    id: 'cheese-yellow', nom: 'ser żółty', acc: 'ser żółty', ins: 'serem żółtym', gen: 'sera żółtego', en: 'yellow cheese', emoji: '🧀',
    aliases: ['ser', 'ser gouda', 'gouda', 'ser edamski', 'edamski', 'ser cheddar', 'cheddar', 'ser kanapkowy', 'cheese', 'yellow cheese'],
    category: 'cheese', roles: ['protein', 'topping'], per100: per(350, 25, 0.5, 28), allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Zetrzyj {acc} na tarce.',
  },
  {
    id: 'mozzarella', nom: 'mozzarella', acc: 'mozzarellę', ins: 'mozzarellą', gen: 'mozzarelli', en: 'mozzarella', emoji: '🧀',
    aliases: ['ser mozzarella', 'mozzarella kulki'],
    category: 'cheese', roles: ['protein', 'topping'], per100: per(250, 18, 2, 19), piece: 125, allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Pokrój {acc} w plasterki.',
  },
  {
    id: 'feta', nom: 'feta', acc: 'fetę', ins: 'fetą', gen: 'fety', en: 'feta cheese', emoji: '🧀',
    aliases: ['ser feta', 'ser typu feta', 'ser sałatkowy', 'feta cheese'],
    category: 'cheese', roles: ['protein', 'topping'], per100: per(265, 14, 4, 21), allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Pokrusz {acc} widelcem.',
  },
  {
    id: 'parmesan', nom: 'parmezan', acc: 'parmezan', ins: 'parmezanem', gen: 'parmezanu', en: 'grated parmesan', emoji: '🧀',
    aliases: ['ser parmezan', 'grana padano', 'parmigiano', 'parmesan'],
    category: 'cheese', roles: ['topping'], per100: per(400, 35, 3, 28), allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Zetrzyj {acc} drobno na tarce.',
  },
  {
    id: 'halloumi', nom: 'ser halloumi', acc: 'ser halloumi', ins: 'serem halloumi', gen: 'sera halloumi', en: 'halloumi', emoji: '🧀',
    aliases: ['halloumi', 'haloumi', 'grillowany ser', 'ser grillowany'],
    category: 'cheese', roles: ['protein', 'topping'], per100: per(320, 22, 2, 25), allergens: ['milk'], diet: 'vegetarian', ready: true,
    prep: 'Pokrój {acc} w plastry 1 cm.',
  },
]
