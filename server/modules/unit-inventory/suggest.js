// Unit inventory — which item a damage report is about. From the photo
// of something damaged and/or the description the cleaning service
// typed, this asks Claude which of the unit's inventory items it most
// likely is, so they can link the report to it with one tap. Only a
// suggestion: the person picks (or picks none).
//
// Uses the same Claude API client and switch as translation
// (ANTHROPIC_API_KEY; off without it).

const Anthropic = require('@anthropic-ai/sdk').default;
const { getClient, translateEnabled, MODEL } = require('./translate');

const MAX_ITEMS = 1500;
const MAX_MATCHES = 3;
const MAX_DESCRIPTION = 1000;

const SYSTEM = [
  'You help the cleaning service of a furnished vacation-rental apartment in Colombia report damage.',
  'You get a photo of something damaged, worn or missing, or the cleaning service\'s short description of it (often in Spanish), or both, and the apartment\'s inventory list (one item per line: id | area | description in Spanish / English | owner note).',
  'Pick up to three items from the list that the report is most likely about, best match first. Judge by what the object is (and its colour, material, shape and place when given) — not by the damage itself. When there is both a photo and a description, use both.',
  'Only pick items that fit. If nothing on the list fits (a wall, floor, door, ceiling, or an object not on the list), return no matches.',
  '`seen_es` / `seen_en` say in a few words what the report is about, in Spanish and English (e.g. "Vaso de vidrio con el borde roto" / "Glass with a chipped rim").',
].join(' ');

const SCHEMA = {
  type: 'object',
  properties: {
    seen_es: { type: 'string' },
    seen_en: { type: 'string' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['itemId', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['seen_es', 'seen_en', 'matches'],
  additionalProperties: false,
};

class SuggestError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const line = (r) => [
  r.id,
  [clip(r.area_es, 80), clip(r.area_en, 80)].filter(Boolean).join(' / ') || '-',
  [clip(r.name_es, 160), clip(r.name_en, 160)].filter(Boolean).join(' / '),
  clip(r.note_es || r.note_en, 120),
].join(' | ');

// suggestItems({ photo: 'data:image/jpeg;base64,…' (optional),
// description (optional), rows }) — at least one of the two — → { seenEs,
// seenEn, matches: [{ itemId, confidence }] } with only ids in `rows`.
// Throws SuggestError with an HTTP status.
async function suggestItems({ photo, description, rows }) {
  if (!translateEnabled()) throw new SuggestError('Suggestions are not set up.', 503);
  const m = photo ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(photo)) : null;
  if (photo && !m) throw new SuggestError('That photo could not be used.', 400);
  const said = clip(description, MAX_DESCRIPTION);
  if (!m && !said) throw new SuggestError('Take a photo or describe the damage first.', 400);
  const list = (rows || []).slice(0, MAX_ITEMS);
  if (!list.length) return { seenEs: '', seenEn: '', matches: [] };

  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // If the model declines, the API retries on a fallback model itself.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          ...(m ? [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }] : []),
          { type: 'text', text: `${said ? `The cleaning service's description:\n<description>\n${said}\n</description>\n\n` : 'No description, only the photo.\n\n'}Inventory list:\n${list.map(line).join('\n')}` },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new SuggestError('Suggestions are not available: the API key was refused.', 503);
    }
    if (e instanceof Anthropic.RateLimitError) throw new SuggestError('Too many requests right now. Try again in a minute.', 429);
    throw new SuggestError('The suggestion service did not answer. Find the item in the list instead.', 502);
  }
  if (response.stop_reason === 'refusal') return { seenEs: '', seenEn: '', matches: [] };
  let parsed;
  try {
    parsed = JSON.parse(response.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  } catch (_e) {
    throw new SuggestError('The suggestion came back unreadable. Find the item in the list instead.', 502);
  }
  const known = new Set(list.map(r => r.id));
  const seenIds = new Set();
  const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
    .filter(x => x && known.has(x.itemId) && !seenIds.has(x.itemId) && seenIds.add(x.itemId))
    .slice(0, MAX_MATCHES)
    .map(x => ({ itemId: x.itemId, confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'low' }));
  return { seenEs: clip(parsed.seen_es, 200), seenEn: clip(parsed.seen_en, 200), matches };
}

module.exports = { suggestItems, SuggestError };
