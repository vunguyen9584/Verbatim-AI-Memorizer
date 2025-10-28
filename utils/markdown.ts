export function basicMarkdownToHtml(input: string): string {
  if (!input) return '';

  // Escape HTML to prevent XSS
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  let html = escapeHtml(input);

  // Bold: **text** or __text__ (no leading/trailing spaces inside)
  html = html.replace(/(\*\*|__)([^\s][\s\S]*?[^\s])\1/g, '<strong>$2</strong>');

  // Italic: *text* or _text_ (no leading/trailing spaces inside)
  html = html.replace(/(\*|_)([^\s][\s\S]*?[^\s])\1/g, '<em>$2</em>');

  // Preserve line breaks
  html = html.replace(/\r?\n/g, '<br/>');

  return html;
}

export function asDangerousHtml(input: string) {
  return { __html: basicMarkdownToHtml(input) };
}
