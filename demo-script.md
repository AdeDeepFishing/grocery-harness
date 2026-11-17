# Demo script (3:00)

Open `slides.html` full screen. Arrow keys move. Have `out/report.html` open in a second tab.

## Slide 1 — title (0:00–0:15)

Hi, we're Yanwen Chen and Beichun Qi. Our one line: don't let the agent mark its own homework.

## Slide 2 — the job (0:15–0:40)

The job sounds easy. Give a model a week of meals and some pantry notes, get a grocery list.
But it is four jobs at once: read every recipe, add up the same ingredient across meals, convert notes like "one kilo bag, half used", and subtract.
Here flour is in three recipes. 750 grams needed, 500 at home, so buy 250.

## Slide 3 — the failure (0:40–1:10)

This is what the model gave us. No flour. No cream.
Then we asked: is this list completely correct? It said yes, all quantities were calculated.
Across ten meal plans it said it was sure on seven. It was right on five.

## Slide 4 — what we built (1:10–1:45)

So we changed the layer around the model, not the model.
One: the model is not allowed to do maths. It fills in a ledger, and for every ingredient it has to copy the exact lines it found.
Two: code checks those quotes against the source. If something is wrong, it goes back to the model.
Three: code does the adding and subtracting.
The model reads. Code checks. Code counts.

## Slide 5 — the verifier (1:45–2:10)

This is one ledger line. Three quotes from the plan, one from the pantry.
And six checks. Is every quote real? Was every line used exactly once? Does the number match?
None of these checks know the right answer. They only need the text, so they work on any meal plan.

## Slide 6 — results (2:10–2:40)

Same harness, five open models on ai&, ten meal plans each.
Yellow is what the model claims. Red is what it actually got. Green is with the harness.
Gemma goes from five to ten. Four of the five models get ten out of ten.

(If time: click "Open the full report", scroll to Baking weekend, show the two lists side by side.)

## Slide 7 — what's next (2:40–3:00)

One honest miss: a model read "half a dozen eggs" wrong. The quote was real, so our check passed. That conversion is next to move into code.
After that: a photo of the fridge instead of notes.
The model reads. Code checks. Code counts. Thank you.

---

## If someone asks

- **Did the retry loop ever fire?** Rarely. Once the model only has to read, it almost never fails the checks. The gain comes from taking the arithmetic away.
- **Is the answer key hand-written?** No. Each case is structured data; the text the model sees and the correct list are both generated from it.
- **Why does bare gemma score differently each run?** Model output varies. We saw 4/6, 6/10 and 5/10 on separate runs. With the harness it was 6/6 or 10/10 every time.
