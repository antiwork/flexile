import React from "react";

function extractUrls(text: string): { url: string; cleanUrl: string; start: number; end: number }[] {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/giu;
  const urls: { url: string; cleanUrl: string; start: number; end: number }[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const start = match.index;

    const trailingPunctuationRegex = /[,;!?)]+$/u;
    const cleanUrl = url.replace(trailingPunctuationRegex, "");

    if (cleanUrl.endsWith(".") && !/\.[a-z]{2,4}$/iu.exec(cleanUrl)) {
      urls.push({
        url,
        cleanUrl: cleanUrl.slice(0, -1),
        start,
        end: start + cleanUrl.length - 1,
      });
    } else {
      urls.push({
        url,
        cleanUrl,
        start,
        end: start + cleanUrl.length,
      });
    }
  }

  return urls;
}

export function parseTextLinks(text: string): React.ReactNode {
  if (!text) return text;

  const urls = extractUrls(text);

  if (urls.length === 0) {
    return text;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  urls.forEach((urlInfo, idx) => {
    if (urlInfo.start > lastIndex) {
      elements.push(text.substring(lastIndex, urlInfo.start));
    }

    const href = urlInfo.cleanUrl.startsWith("www.") ? `https://${urlInfo.cleanUrl}` : urlInfo.cleanUrl;

    elements.push(
      <a
        key={`link-${idx}-${urlInfo.start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        onClick={(e) => e.stopPropagation()}
      >
        {urlInfo.cleanUrl}
      </a>,
    );

    const trailingPunctuation = urlInfo.url.slice(urlInfo.cleanUrl.length);
    if (trailingPunctuation) {
      elements.push(trailingPunctuation);
    }

    lastIndex = urlInfo.start + urlInfo.url.length;
  });

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

export function hasLinks(text: string): boolean {
  if (!text) return false;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/giu;
  return urlRegex.test(text);
}
