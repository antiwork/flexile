export const pluralize = (word: string, count: number, includeCount?: boolean) => {
  const pluralizedWord = count === 1 ? word : `${word}s`;
  return includeCount ? `${count} ${pluralizedWord}` : pluralizedWord;
};
