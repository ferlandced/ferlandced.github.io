// Globals that decap-cms.js defines for preview scripts. Only what admin/preview.ts uses.

interface DecapEntry {
  getIn(path: readonly string[]): unknown;
}

interface DecapList {
  size: number;
  map<T>(callback: (value: unknown, index: number) => T): { toArray(): T[] };
}

interface DecapMap {
  get(key: string): unknown;
}

interface DecapPreviewProperties {
  entry: DecapEntry;
  /** Bound by Decap: safe to pass around. */
  getAsset: (path: string) => { toString(): string };
  widgetFor(name: string): unknown;
}

declare const CMS: {
  registerPreviewStyle(url: string): void;
  registerPreviewTemplate(name: string, component: unknown): void;
};

declare function h(
  type: string,
  properties: Record<string, unknown>,
  ...children: unknown[]
): unknown;

declare function createClass(spec: {
  render(this: { props: DecapPreviewProperties }): unknown;
}): unknown;
