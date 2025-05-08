// override built-in types to accept all strings instead of just string literal types as the latter are just too hard to come by
declare namespace Intl {
  interface NumberFormat {
    format(value: number | bigint | string): string;
    formatToParts(value: number | bigint | string): NumberFormatPart[];
    formatRange(start: number | bigint | string, end: number | bigint | StringNumericLiteral): string;
    formatRangeToParts(
      start: number | bigint | string,
      end: number | bigint | StringNumericLiteral,
    ): NumberRangeFormatPart[];
  }
}

type MaybePromise<T> = T | Promise<T>;
