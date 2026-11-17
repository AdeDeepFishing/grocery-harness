// ─────────────────────────────────────────────
// The eval set: a week's meal plan + messy pantry notes → the correct grocery list.
//
// Each case is declared as structured data, and BOTH the text the model sees
// and the correct answer are generated from it. So the answer key is computed,
// never typed by hand.
// ─────────────────────────────────────────────

export type Unit = "g" | "ml" | "pcs";
export type ListItem = { item: string; qty: number; unit: Unit };

export type Case = {
  id: string;
  title: string;
  mealPlan: string; // what the model reads
  pantry: string; // what the model reads
  planLines: string[]; // every ingredient line in the plan (the verifier's source of truth)
  pantryLines: string[];
  expected: ListItem[]; // the answer key
};

type Use = [item: string, qty: number, unit: Unit];
type Meal = { name: string; uses: Use[] };
// text = the pantry note as a human wrote it. item/qty = what it really means.
// No item = something in the pantry that no meal needs (a distractor).
type Stock = { text: string; item?: string; qty?: number };

const meal = (name: string, ...uses: Use[]): Meal => ({ name, uses });
const have = (text: string, item?: string, qty?: number): Stock => ({ text, item, qty });

const plural = (word: string) => (word.endsWith("o") ? word + "es" : word + "s");
const pluralPhrase = (item: string) => {
  const words = item.split(" ");
  words[words.length - 1] = plural(words[words.length - 1]);
  return words.join(" ");
};
const PREP = ["", ", diced", "", ", chopped", ", sliced", ""];
const CHOPPABLE = ["onion", "carrot", "potato", "tomato", "spring onion", "garlic clove", "avocado", "banana"];

// Recipes are written the way people write them: three different line shapes.
function ingredientLine([item, qty, unit]: Use, n: number): string {
  if (unit === "pcs") return `${qty} ${qty === 1 ? item : pluralPhrase(item)}${CHOPPABLE.includes(item) ? PREP[n % PREP.length] : ""}`;
  return n % 2 === 0 ? `${qty} ${unit} ${item}` : `${item}, ${qty} ${unit}`;
}

function build(id: string, title: string, meals: Meal[], stock: Stock[]): Case {
  const planLines: string[] = [];
  const need = new Map<string, { qty: number; unit: Unit }>();
  let n = 0;

  const mealPlan = meals
    .map((m) => {
      const lines = m.uses.map((use) => {
        const [item, qty, unit] = use;
        const entry = need.get(item) ?? { qty: 0, unit };
        if (entry.unit !== unit) throw new Error(`${id}: ${item} uses both ${entry.unit} and ${unit}`);
        entry.qty += qty;
        need.set(item, entry);
        const line = ingredientLine(use, n++);
        planLines.push(line);
        return `- ${line}`;
      });
      return `${m.name}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const expected: ListItem[] = [];
  for (const [item, { qty, unit }] of need) {
    const inStock = stock.find((s) => s.item === item)?.qty ?? 0;
    if (qty - inStock > 0) expected.push({ item, qty: qty - inStock, unit });
  }
  for (const s of stock) if (s.item && !need.has(s.item)) throw new Error(`${id}: pantry item ${s.item} is in no meal`);

  return {
    id,
    title,
    mealPlan,
    pantry: stock.map((s) => `- ${s.text}`).join("\n"),
    planLines,
    pantryLines: stock.map((s) => s.text),
    expected,
  };
}

export const cases: Case[] = [
  build(
    "weeknight-classics",
    "Weeknight classics",
    [
      meal("Monday — Oyakodon", ["chicken thigh", 300, "g"], ["egg", 4, "pcs"], ["onion", 1, "pcs"], ["rice", 300, "g"], ["soy sauce", 30, "ml"]),
      meal("Tuesday — Carbonara", ["spaghetti", 200, "g"], ["egg", 3, "pcs"], ["bacon", 100, "g"], ["parmesan", 40, "g"]),
      meal("Wednesday — Chicken curry", ["chicken thigh", 250, "g"], ["onion", 2, "pcs"], ["carrot", 1, "pcs"], ["potato", 2, "pcs"], ["rice", 300, "g"], ["curry roux", 100, "g"]),
      meal("Thursday — Fried rice", ["rice", 250, "g"], ["egg", 2, "pcs"], ["bacon", 50, "g"], ["spring onion", 2, "pcs"], ["soy sauce", 15, "ml"]),
      meal("Friday — Cheese omelette", ["egg", 3, "pcs"], ["milk", 50, "ml"], ["butter", 20, "g"], ["parmesan", 20, "g"]),
    ],
    [
      have("eggs: half a dozen", "egg", 6),
      have("rice: one 1 kg bag, unopened", "rice", 1000),
      have("onions: 2", "onion", 2),
      have("soy sauce: almost out", "soy sauce", 0),
      have("butter: 200 g block, a quarter already used", "butter", 150),
      have("spaghetti: 500 g pack", "spaghetti", 500),
      have("ketchup: 1 bottle"),
      have("milk: 1 L carton, half left", "milk", 500),
      have("olive oil: plenty"),
    ],
  ),

  build(
    "veggie-week",
    "Vegetarian week",
    [
      meal("Monday — Mapo tofu", ["tofu block", 2, "pcs"], ["garlic clove", 3, "pcs"], ["spring onion", 2, "pcs"], ["miso paste", 30, "g"], ["rice", 200, "g"]),
      meal("Tuesday — Tomato pasta", ["penne", 250, "g"], ["tomato", 4, "pcs"], ["garlic clove", 2, "pcs"], ["olive oil", 30, "ml"], ["parmesan", 30, "g"]),
      meal("Wednesday — Miso soup and rice", ["tofu block", 1, "pcs"], ["miso paste", 45, "g"], ["spring onion", 1, "pcs"], ["rice", 200, "g"]),
      meal("Thursday — Shakshuka", ["egg", 4, "pcs"], ["tomato", 5, "pcs"], ["onion", 1, "pcs"], ["garlic clove", 2, "pcs"], ["olive oil", 20, "ml"]),
      meal("Friday — Veggie fried rice", ["rice", 300, "g"], ["egg", 2, "pcs"], ["carrot", 2, "pcs"], ["spring onion", 2, "pcs"], ["soy sauce", 20, "ml"]),
      meal("Saturday — Caprese salad", ["tomato", 3, "pcs"], ["mozzarella", 250, "g"], ["olive oil", 25, "ml"]),
    ],
    [
      have("garlic cloves: 4", "garlic clove", 4),
      have("rice: 2 kg bag, about a quarter left", "rice", 500),
      have("olive oil: some", "olive oil", 0),
      have("miso paste: 500 g tub, unopened", "miso paste", 500),
      have("eggs: a dozen", "egg", 12),
      have("tomatoes: 2", "tomato", 2),
      have("penne: 100 g", "penne", 100),
      have("mayonnaise: half a tube"),
      have("soy sauce: 150 ml", "soy sauce", 150),
      have("carrots: 1", "carrot", 1),
    ],
  ),

  build(
    "baking-weekend",
    "Baking weekend",
    [
      meal("Saturday morning — Pancakes", ["flour", 200, "g"], ["egg", 2, "pcs"], ["milk", 300, "ml"], ["butter", 30, "g"], ["sugar", 25, "g"]),
      meal("Saturday afternoon — Banana bread", ["flour", 250, "g"], ["banana", 3, "pcs"], ["egg", 2, "pcs"], ["butter", 110, "g"], ["sugar", 150, "g"]),
      meal("Sunday morning — French toast", ["egg", 3, "pcs"], ["milk", 150, "ml"], ["butter", 20, "g"], ["sugar", 15, "g"]),
      meal("Sunday afternoon — Shortbread", ["flour", 300, "g"], ["butter", 200, "g"], ["sugar", 100, "g"]),
      meal("Sunday evening — Custard", ["egg", 4, "pcs"], ["milk", 500, "ml"], ["sugar", 60, "g"], ["cream", 200, "ml"]),
    ],
    [
      have("flour: 1 kg bag, half used", "flour", 500),
      have("eggs: 10", "egg", 10),
      have("milk: two 1 L cartons, one of them half empty", "milk", 1500),
      have("butter: 2 blocks of 200 g", "butter", 400),
      have("sugar: a little", "sugar", 0),
      have("bananas: 2", "banana", 2),
      have("baking powder: 1 tin"),
      have("vanilla extract: 1 bottle"),
    ],
  ),

  build(
    "family-of-four",
    "Family of four",
    [
      meal("Monday — Beef stew", ["beef", 600, "g"], ["potato", 4, "pcs"], ["carrot", 3, "pcs"], ["onion", 2, "pcs"], ["beef stock", 500, "ml"]),
      meal("Tuesday — Tacos", ["beef", 400, "g"], ["tortilla", 8, "pcs"], ["tomato", 3, "pcs"], ["onion", 1, "pcs"], ["cheddar", 150, "g"], ["avocado", 2, "pcs"]),
      meal("Wednesday — Baked potatoes", ["potato", 4, "pcs"], ["cheddar", 100, "g"], ["butter", 40, "g"], ["bacon", 120, "g"]),
      meal("Thursday — Cottage pie", ["beef", 500, "g"], ["potato", 5, "pcs"], ["carrot", 2, "pcs"], ["onion", 1, "pcs"], ["beef stock", 300, "ml"], ["butter", 30, "g"]),
      meal("Friday — Quesadillas", ["tortilla", 6, "pcs"], ["cheddar", 200, "g"], ["tomato", 2, "pcs"], ["avocado", 1, "pcs"]),
      meal("Saturday — Burgers", ["beef", 500, "g"], ["onion", 1, "pcs"], ["tomato", 2, "pcs"], ["cheddar", 80, "g"], ["bacon", 80, "g"]),
    ],
    [
      have("potatoes: a 10-pack, 3 already eaten", "potato", 7),
      have("beef: 2 packs of 400 g in the freezer", "beef", 800),
      have("onions: 6", "onion", 6),
      have("cheddar: 250 g block", "cheddar", 250),
      have("beef stock: 1 L carton", "beef stock", 1000),
      have("tortillas: pack of 12", "tortilla", 12),
      have("butter: nearly gone", "butter", 0),
      have("carrots: 2", "carrot", 2),
      have("tomatoes: half a dozen", "tomato", 6),
      have("mustard: 1 jar"),
      have("pickles: 1 jar"),
    ],
  ),

  build(
    "noodle-week",
    "Noodle week",
    [
      meal("Monday — Yaki udon", ["udon", 400, "g"], ["pork belly", 150, "g"], ["cabbage", 200, "g"], ["carrot", 1, "pcs"], ["soy sauce", 30, "ml"]),
      meal("Tuesday — Cold soba", ["soba", 200, "g"], ["spring onion", 2, "pcs"], ["soy sauce", 40, "ml"], ["mirin", 20, "ml"]),
      meal("Wednesday — Tonjiru", ["pork belly", 200, "g"], ["carrot", 1, "pcs"], ["potato", 2, "pcs"], ["miso paste", 60, "g"], ["spring onion", 1, "pcs"]),
      meal("Thursday — Okonomiyaki", ["cabbage", 300, "g"], ["flour", 100, "g"], ["egg", 2, "pcs"], ["pork belly", 100, "g"], ["spring onion", 2, "pcs"]),
      meal("Friday — Kitsune udon", ["udon", 400, "g"], ["soy sauce", 30, "ml"], ["mirin", 30, "ml"], ["spring onion", 1, "pcs"], ["egg", 2, "pcs"]),
      meal("Saturday — Soba salad", ["soba", 200, "g"], ["cabbage", 150, "g"], ["carrot", 1, "pcs"], ["soy sauce", 20, "ml"], ["egg", 2, "pcs"]),
    ],
    [
      have("udon: 3 packs of 200 g", "udon", 600),
      have("soy sauce: 1 L bottle, about one tenth left", "soy sauce", 100),
      have("soba: 300 g", "soba", 300),
      have("mirin: a splash", "mirin", 0),
      have("eggs: 4", "egg", 4),
      have("miso paste: 750 g tub, unopened", "miso paste", 750),
      have("cabbage: half of a 1 kg head", "cabbage", 500),
      have("flour: 1 kg bag", "flour", 1000),
      have("spring onions: 3", "spring onion", 3),
      have("sesame oil: 1 bottle"),
      have("pork belly: 150 g in the freezer", "pork belly", 150),
    ],
  ),

  build(
    "brunch-party",
    "Brunch party",
    [
      meal("Frittata", ["egg", 8, "pcs"], ["potato", 3, "pcs"], ["onion", 1, "pcs"], ["cheddar", 100, "g"], ["milk", 100, "ml"]),
      meal("Avocado toast", ["avocado", 4, "pcs"], ["lemon", 1, "pcs"], ["sourdough", 400, "g"], ["egg", 4, "pcs"]),
      meal("Waffles", ["flour", 300, "g"], ["egg", 3, "pcs"], ["milk", 400, "ml"], ["butter", 100, "g"], ["sugar", 40, "g"]),
      meal("Smoked salmon bagels", ["bagel", 6, "pcs"], ["smoked salmon", 300, "g"], ["cream cheese", 200, "g"], ["lemon", 1, "pcs"]),
      meal("Fruit salad", ["banana", 3, "pcs"], ["lemon", 1, "pcs"], ["sugar", 20, "g"], ["yogurt", 300, "g"]),
      meal("Hash browns", ["potato", 5, "pcs"], ["onion", 1, "pcs"], ["butter", 50, "g"], ["egg", 1, "pcs"]),
    ],
    [
      have("eggs: a dozen and a half", "egg", 18),
      have("potatoes: 5", "potato", 5),
      have("milk: 1 L carton, a quarter gone", "milk", 750),
      have("butter: 250 g block, 100 g already used", "butter", 150),
      have("lemons: 1", "lemon", 1),
      have("flour: a bit at the bottom of the bag", "flour", 0),
      have("sugar: 1 kg bag", "sugar", 1000),
      have("cream cheese: 2 tubs of 150 g", "cream cheese", 300),
      have("yogurt: 500 g tub, 300 g eaten", "yogurt", 200),
      have("jam: 2 jars"),
      have("bananas: 3", "banana", 3),
      have("cheddar: 60 g", "cheddar", 60),
    ],
  ),
];
