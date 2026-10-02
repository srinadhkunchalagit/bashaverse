/**
 * Speech Deduplication & Normalization Utility
 * Specifically targets mobile browser speech-recognition quirks (especially Mobile Chrome/Android)
 * where the recognizer repeats tokens or emits duplicate clauses (e.g. "welcome welcome welcome").
 */

export function cleanSpeechDuplicates(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // Normalize multiple spaces
  text = text.replace(/\s+/g, ' ');

  // 1. Remove immediate consecutive duplicate words (case-insensitive)
  // e.g. "welcome welcome welcome" -> "welcome"
  // e.g. "hello hello world" -> "hello world"
  const words = text.split(' ');
  const dedupedWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = dedupedWords[dedupedWords.length - 1];

    if (!prev || current.toLowerCase() !== prev.toLowerCase()) {
      dedupedWords.push(current);
    }
  }

  let result = dedupedWords.join(' ');

  // 2. Remove repeated multi-word phrases (2-word, 3-word, 4-word, and 5-word phrases)
  // e.g. "welcome to my app welcome to my app" -> "welcome to my app"
  // e.g. "how are you how are you" -> "how are you"
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    const tokens = result.split(' ');
    if (tokens.length < phraseLen * 2) continue;

    const cleanedTokens: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (i + phraseLen * 2 <= tokens.length) {
        const firstPhrase = tokens.slice(i, i + phraseLen).join(' ').toLowerCase();
        const nextPhrase = tokens.slice(i + phraseLen, i + phraseLen * 2).join(' ').toLowerCase();

        if (firstPhrase === nextPhrase) {
          // Push only the first phrase, skip the duplicate
          for (let k = 0; k < phraseLen; k++) {
            cleanedTokens.push(tokens[i + k]);
          }
          i += phraseLen * 2;
          continue;
        }
      }
      cleanedTokens.push(tokens[i]);
      i++;
    }
    result = cleanedTokens.join(' ');
  }

  // 3. Final cleanup: trim punctuation repeats like " , ," or extra spaces
  result = result.replace(/\s+([.,!?;:])/g, '$1').trim();

  // Capitalize first letter if it was lower
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Safely appends a new speech segment to an existing transcript without repeating overlapping words
 */
export function appendWithoutDuplicate(existing: string, incoming: string): string {
  const cleanExisting = existing.trim();
  const cleanIncoming = incoming.trim();

  if (!cleanExisting) return cleanSpeechDuplicates(cleanIncoming);
  if (!cleanIncoming) return cleanSpeechDuplicates(cleanExisting);

  // If incoming already equals existing or is contained in existing
  if (cleanExisting.toLowerCase().endsWith(cleanIncoming.toLowerCase())) {
    return cleanSpeechDuplicates(cleanExisting);
  }

  // If existing is contained at the start of incoming
  if (cleanIncoming.toLowerCase().startsWith(cleanExisting.toLowerCase())) {
    return cleanSpeechDuplicates(cleanIncoming);
  }

  // Check word overlap at boundary (up to 4 words)
  const existingWords = cleanExisting.split(/\s+/);
  const incomingWords = cleanIncoming.split(/\s+/);

  for (let overlap = Math.min(4, existingWords.length, incomingWords.length); overlap > 0; overlap--) {
    const endOfExisting = existingWords.slice(-overlap).join(' ').toLowerCase();
    const startOfIncoming = incomingWords.slice(0, overlap).join(' ').toLowerCase();

    if (endOfExisting === startOfIncoming) {
      const remainder = incomingWords.slice(overlap).join(' ');
      const joined = remainder ? `${cleanExisting} ${remainder}` : cleanExisting;
      return cleanSpeechDuplicates(joined);
    }
  }

  return cleanSpeechDuplicates(`${cleanExisting} ${cleanIncoming}`);
}
