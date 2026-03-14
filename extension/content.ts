import { Readability } from '@mozilla/readability';

type ExtractionResponse = {
  content: string;
  title: string;
  url: string;
};

/** Strip any remaining HTML tags and control characters from text */
function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

function getVisibleFallbackText() {
  const focusedRoot = document.querySelector<HTMLElement>('article, main, [role="main"], .markdown-body, .post-text, .answer, .question');
  const text = focusedRoot?.innerText?.trim() || document.body.innerText.trim();
  return text.replace(/\n{3,}/g, '\n\n').slice(0, 8000);
}

function extractContent(): ExtractionResponse {
  const documentClone = document.cloneNode(true) as Document;

  documentClone.querySelectorAll('script, style, noscript, iframe, svg').forEach((node) => {
    node.remove();
  });

  const article = new Readability(documentClone).parse();
  const codeSnippets = Array.from(document.querySelectorAll('pre, code'))
    .map((node) => node.textContent?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8)
    .join('\n\n');

  const headingText = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((node) => node.textContent?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 12)
    .join('\n');

  const mainText = article?.textContent?.trim() || getVisibleFallbackText();
  const combined = sanitizeText(
    [headingText, mainText, codeSnippets].filter(Boolean).join('\n\n').slice(0, 8000)
  );

  return {
    content: combined || sanitizeText(getVisibleFallbackText()),
    title: sanitizeText(article?.title || document.title),
    url: window.location.href
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'extract_content') {
    return undefined;
  }

  try {
    sendResponse(extractContent());
  } catch {
    sendResponse({
      content: sanitizeText(getVisibleFallbackText()),
      title: sanitizeText(document.title),
      url: window.location.href
    });
  }

  return true;
});