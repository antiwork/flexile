interface TableRowSelector {
  query(root: Element | Document, selector: string): Element | null;
  queryAll(root: Element | Document, selector: string): Element[];
}

export function serializeColumnValues(columnValues: Record<string, string | RegExp>): string {
  const regexPrefix = "__REGEX__";
  const regexSeparator = "||";
  const defaultFlags = "u";

  return JSON.stringify(
    Object.entries(columnValues).reduce<Record<string, string>>(
      (result, [columnName, columnValue]) => ({
        ...result,
        [columnName]:
          columnValue instanceof RegExp
            ? `${regexPrefix}${columnValue.source}${regexSeparator}${Array.from(new Set(`${defaultFlags}${columnValue.flags}`)).join("")}`
            : columnValue,
      }),
      {},
    ),
  );
}

export function createTableRowEngine(): TableRowSelector {
  const regexPrefix = "__REGEX__";
  const regexSeparator = "||";
  const defaultFlags = "u";

  const compiledRegexCache = new Map<string, RegExp>();
  const tableHeaderCache = new WeakMap<HTMLTableElement, Map<string, number>>();

  function findMatchingRows(root: Element | Document, selector: string, options: { findAll: false }): Element | null;
  function findMatchingRows(root: Element | Document, selector: string, options: { findAll: true }): Element[];
  function findMatchingRows(
    root: Element | Document,
    selector: string,
    options: { findAll: boolean },
  ): Element | Element[] | null {
    try {
      const parsedSelector: unknown = JSON.parse(selector);

      const isValidStringRecord = (value: unknown): value is Record<string, string> =>
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((v) => typeof v === "string");

      if (!isValidStringRecord(parsedSelector)) {
        throw new Error("Invalid selector: expected object with string values");
      }

      const searchCriteria = parsedSelector;

      const isTableElement = (element: Element | null): element is HTMLTableElement =>
        element !== null && element.tagName === "TABLE";

      let targetTable: HTMLTableElement | null = null;
      if (root instanceof Element && isTableElement(root)) {
        targetTable = root;
      } else {
        const foundTable = root.querySelector("table");
        if (isTableElement(foundTable)) {
          targetTable = foundTable;
        }
      }

      if (!targetTable) return options.findAll ? [] : null;

      let columnNameToIndexMap: Map<string, number>;
      if (tableHeaderCache.has(targetTable)) {
        const cachedMap = tableHeaderCache.get(targetTable);
        if (!cachedMap) throw new Error("Failed to get cached header index");
        columnNameToIndexMap = cachedMap;
      } else {
        columnNameToIndexMap = new Map();
        const headerCells = Array.from(targetTable.querySelectorAll("thead th, th"));
        headerCells.forEach((headerCell, columnIndex) => {
          const headerText = (headerCell.textContent || "").trim();
          if (headerText) columnNameToIndexMap.set(headerText, columnIndex);
        });
        tableHeaderCache.set(targetTable, columnNameToIndexMap);
      }

      const tbodyRows = targetTable.querySelectorAll("tbody tr");
      const rowsToCheck = options.findAll
        ? targetTable.querySelectorAll("tr")
        : tbodyRows.length > 0
          ? tbodyRows
          : targetTable.querySelectorAll("tr");

      const matchingRows = Array.from(rowsToCheck).filter((tableRow) => {
        const rowCells = tableRow.querySelectorAll("td");
        return Object.entries(searchCriteria).every(([columnName, expectedValue]) => {
          const columnIndex = columnNameToIndexMap.get(columnName);
          if (columnIndex === undefined) return true;

          const cell = rowCells[columnIndex];
          if (!cell) return false;

          const actualCellValue = (cell.textContent || "").trim();

          if (expectedValue.startsWith(regexPrefix)) {
            const regexContent = expectedValue.slice(regexPrefix.length);
            const regexParts = regexContent.includes(regexSeparator)
              ? regexContent.split(regexSeparator, 2)
              : [regexContent];
            const regexPattern = regexParts[0] ?? "";
            const regexFlags = regexParts[1] || defaultFlags;

            const cacheKey = `${regexPattern}|${regexFlags}`;
            if (!compiledRegexCache.has(cacheKey)) {
              compiledRegexCache.set(cacheKey, new RegExp(regexPattern, regexFlags));
            }
            const compiledRegex = compiledRegexCache.get(cacheKey);
            if (!compiledRegex) throw new Error(`Failed to get cached regex for key: ${cacheKey}`);

            return compiledRegex.test(actualCellValue);
          }

          return actualCellValue.includes(expectedValue);
        });
      });

      return options.findAll ? matchingRows : matchingRows[0] || null;
    } catch {
      return options.findAll ? [] : null;
    }
  }

  return {
    query(root: Element | Document, selector: string): Element | null {
      return findMatchingRows(root, selector, { findAll: false });
    },
    queryAll(root: Element | Document, selector: string): Element[] {
      return findMatchingRows(root, selector, { findAll: true });
    },
  };
}
