// Minimal content script: extract headings, main text, and code snippets
(function(){
  /** Strip any remaining HTML tags and control characters from text */
  function sanitizeText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .trim();
  }

  function getVisibleFallbackText(){
    const focused = document.querySelector('article, main, [role="main"], .markdown-body, .post-text, .answer, .question');
    const text = (focused && focused.innerText) || document.body.innerText || '';
    return text.replace(/\n{3,}/g,'\n\n').trim().slice(0,8000);
  }

  function extract(){
    try{
      const clone = document.cloneNode(true);
      clone.querySelectorAll('script, style, noscript, iframe, svg, object, embed').forEach(n=>n.remove());

      const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(n=>n.textContent?.trim()).filter(Boolean).slice(0,12).join('\n');

      const codes = Array.from(document.querySelectorAll('pre, code'))
        .map(n=>n.textContent?.trim()).filter(Boolean).slice(0,8).join('\n\n');

      const article = document.querySelector('article') || document.querySelector('main') || null;
      const mainText = article ? article.innerText.trim() : getVisibleFallbackText();

      const combined = sanitizeText([headings, mainText, codes].filter(Boolean).join('\n\n').slice(0,8000));
      return {
        content: combined || sanitizeText(getVisibleFallbackText()),
        title: sanitizeText(document.title),
        url: location.href
      };
    }catch(e){
      return {
        content: sanitizeText(getVisibleFallbackText()),
        title: sanitizeText(document.title),
        url: location.href
      };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse)=>{
    if (message && message.type === 'extract_content'){
      sendResponse(extract());
    }
  });
})();
