# Grocery Harness

**Don't let the agent mark its own homework.**

Built by Yanwen Chen and Beichun Qi at the +81 Builders Agent Harness Build Night (Tokyo, 17 November 2026).

## The problem

The job: turn a week's meal plan and some messy pantry notes into a grocery list.

It sounds easy, but it is four jobs at once: read every recipe, add up the same ingredient across meals, convert notes like "1 kg bag, half used", and subtract. A single model call gets about half of our test cases right. When we then ask "is this list completely correct?", it usually says yes.

## The harness

The model reads. Code checks. Code counts.

1. **Ledger, not a list.** The model is not allowed to do any maths. For each ingredient it fills in one ledger line and must copy the exact lines it found, from the meal plan and from the pantry notes.
2. **Verify against the source.** Code checks the ledger. Problems are sent back to the model, for up to 3 rounds.
3. **Code does the arithmetic.** Add the uses, subtract the stock.

The six checks only need the source text, never the right answer, so they work on any meal plan:

- every quote is a real line in the meal plan
- every ingredient line in the plan is used exactly once
- the number claimed is the number in the quote
- no ingredient appears twice
- a pantry note that names the ingredient is not ignored
- a pantry note with no amount in it ("almost out") counts as zero

## Results

Ten meal plans per model, one run each, all served by ai& Inference. The prompt rules are identical with and without the harness.

| Model | Says "it's correct" | Actually correct | With the harness |
| --- | --- | --- | --- |
| google/gemma-4-31b-it | 7/10 | 5/10 | 10/10 |
| openai/gpt-oss-120b | 7/10 | 7/10 | 10/10 |
| qwen/qwen3.6-27b | 10/10 | 9/10 | 10/10 |
| deepseek-ai/deepseek-v4.1-flash-1017 | 10/10 | 10/10 | 10/10 |
| zai-org/glm-5.3-flash | 10/10 | 10/10 | 9/10 |

Things to know when reading this table:

- Bare scores move between runs. On gemma we saw 4/6, 6/10 and 5/10 on separate runs.
- The gain comes from taking the arithmetic away from the model. The retry loop rarely fires: once the model only has to read, its ledger almost always passes the checks first time.
- The one harness miss (glm) was a pantry conversion: the model quoted "eggs: half a dozen" correctly but wrote the wrong stock number. The verifier checks that quotes are real, not that conversions are right.

## Run it

```sh
npm install
cp .env.example .env    # then fill in the values below
npm run grocery         # all 10 cases, writes out/report.html
```

`.env` for ai& (or any OpenAI-compatible API):

```
LLM_BASE_URL=https://api.aiand.com/v1
LLM_API_KEY=your_key
MODEL=google/gemma-4-31b-it
```

Other commands:

```sh
npm run grocery baking-weekend      # one case
MODEL=qwen/qwen3.6-27b OUT_DIR=out/models/qwen npm run grocery
npx tsx grocery/compare.ts          # out/models.html from every out/models/*/results.json
```

## Files

| File | What it does |
| --- | --- |
| `grocery/cases.ts` | The eval set. Each case is structured data; the text the model sees and the answer key are both generated from it. |
| `grocery/agents.ts` | The three model calls: bare list, self-report, ledger. |
| `grocery/verify.ts` | The harness: the six checks, the arithmetic, and the scorer. |
| `grocery/run.ts` | Runs bare and harnessed side by side for each case. |
| `grocery/report.ts`, `grocery/compare.ts` | The HTML report pages. |
| `slides.html`, `demo-script.md` | The 3-minute presentation. |

## What's next

- Check pantry conversions in code too
- A photo of the fridge instead of pantry notes
- When a pantry note is vague, ask the human instead of assuming zero

## Credits

Forked from [basically-ai-harness](https://github.com/TejasQ/basically-ai-harness) by Tejas Kumar, the starter repo for the event. The `agent/` and `eval/` folders are the original starter code. MIT licensed.
