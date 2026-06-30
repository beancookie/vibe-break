import { getDict, type Dict, type StatusDict, type ErrorDict, type UiDict } from "$lib/i18n.svelte";

type DictSection = keyof Dict;

let _appState: { locale: string } | null = null;

export function initStrings(appStateRef: { locale: string }) {
  _appState = appStateRef;
}

function getLocale() {
  return _appState?.locale ?? "en";
}

function createReactiveProxy<S extends DictSection>(section: S): Dict[S] {
  return new Proxy({} as Dict[S], {
    get(_target, key: string | symbol) {
      if (typeof key === "symbol") return undefined;
      const val = getDict(getLocale())[section][key as keyof Dict[S]];
      if (typeof val === "function") {
        return (...args: unknown[]) => (val as (...a: unknown[]) => unknown)(...args);
      }
      return val;
    },
    ownKeys() {
      return Reflect.ownKeys(getDict(getLocale())[section]);
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });
}

export const STATUS = createReactiveProxy("STATUS") as StatusDict;
export const ERROR = createReactiveProxy("ERROR") as ErrorDict;
export const UI = createReactiveProxy("UI") as UiDict;
