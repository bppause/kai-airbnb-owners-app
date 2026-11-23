// Unit inventory — translation between Spanish and English for the
// owner's item form, so the two languages of an item's area, description
// and note stay in sync. Uses the Claude API; switched off (and nothing
// else affected) when ANTHROPIC_API_KEY is not set.
//
// Only the owner calls this, one short field at a time, while editing.
// Results are cached in memory so retyping the same text costs nothing.

const Anthropic = require('@anthropic-ai/sdk').default;

const MODEL = 'claude-opus-5-5';
const MAX_INPUT = { area: 120, name: 300, note: 1000 };
const CACHE_MAX = 500;

const KIND_WORDS = {
  area: 'the name of an area or room of the apartment (e.g. "Kitchen – Appliances")',
  name: 'the description of one item in the inventory (e.g. "Bath towel, white")',
  note: "the owner's note about one item (where it is kept, what it looks like)",
};

const SYSTEM = [
  'You translate short entries in the household inventory of a furnished vacation-rental apartment in Colombia.',
  'The owner reads English; the cleaning service reads Spanish, so use the everyday Spanish of Colombia (e.g. "mesón", "nevera", "olla", "toalla de mano").',
  'Reply with only the translation: no quotes, no alternatives, no explanation.',
  'Keep brand names, model names, numbers, measurements and emoji exactly as they are.',
  'Keep the same punctuation style and keep it about as short as the original. Do not add words that are not implied by the original.',
  'If the text is already in the target language, or is only a brand or model name, return it unchanged.',
].join(' ');

let client = null;
let clientFor = '';
const enabled = () => !!process.env.ANTHROPIC_API_KEY;
// One client, made again if the key (or API address) it was made with changes.
const getClient = () => {
  const settings = `${process.env.ANTHROPIC_API_KEY || ''}|${process.env.ANTHROPIC_BASE_URL || ''}`;
  if (!client || clientFor !== settings) { client = new Anthropic(); clientFor = settings; }
  return client;
};

// Least-recently-used cache of finished translations.
const cache = new Map();
const remember = (key, value) => {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
};

class TranslateError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// translate({ text, to: 'es' | 'en', kind: 'area' | 'name' | 'note' }) →
// the translated text. Throws TranslateError with an HTTP status.
async function translate({ text, to, kind }) {
  if (!enabled()) throw new TranslateError('Automatic translation is not set up.', 503);
  const source = String(text == null ? '' : text).trim();
  if (!['es', 'en'].includes(to)) throw new TranslateError('Unknown language.', 400);
  if (!KIND_WORDS[kind]) throw new TranslateError('Unknown field.', 400);
  if (!source) return '';
  if (source.length > MAX_INPUT[kind]) throw new TranslateError('The text is too long to translate.', 400);

  const key = `${kind}|${to}|${source}`;
  if (cache.has(key)) {
    const hit = cache.get(key);
    remember(key, hit);
    return hit;
  }

  const target = to === 'es' ? 'Spanish (Colombia)' : 'English (US)';
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // Short, simple work: the least effort, so it answers quickly.
      output_config: { effort: 'low' },
      // If the model declines, the API retries on a fallback model itself.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Translate into ${target}. The text is ${KIND_WORDS[kind]}.\n\n<text>\n${source}\n</text>`,
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new TranslateError('Automatic translation is not available: the API key was refused.', 503);
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new TranslateError('Too many translations right now. Try again in a minute.', 429);
    }
    if (e instanceof Anthropic.APIError) {
      throw new TranslateError('The translation service did not answer. Type it yourself or try again.', 502);
    }
    throw new TranslateError('The translation service could not be reached. Type it yourself or try again.', 502);
  }
  if (response.stop_reason === 'refusal') {
    throw new TranslateError('This text could not be translated automatically. Type it yourself.', 422);
  }
  const out = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .replace(/^<text>\s*|\s*<\/text>$/g, '')
    .replace(/^"(.*)"$/s, '$1')
    .trim()
    .slice(0, MAX_INPUT[kind]);
  if (!out) throw new TranslateError('The translation came back empty. Type it yourself.', 502);
  remember(key, out);
  return out;
}

module.exports = { translate, translateEnabled: enabled, TranslateError, getClient, MODEL };
