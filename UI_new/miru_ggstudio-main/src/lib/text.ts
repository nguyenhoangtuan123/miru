const MOJIBAKE_PATTERN = /Ã.|Â.|Ä.|Æ.|á»|áº|â€|â€¦|â€™|â€œ|â€/;

export function repairMojibake(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  if (!MOJIBAKE_PATTERN.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return decoded.includes('\uFFFD') ? text : decoded;
  } catch {
    return text;
  }
}
