import { EventEmitter, requireNativeModule } from 'expo-modules-core';

let nativeModule;
try { nativeModule = requireNativeModule('AppleSearchCompleter'); } catch { nativeModule = null; }
const emitter = nativeModule ? new EventEmitter(nativeModule) : null;

export function search(query) {
  nativeModule?.search(query);
}

export function resolve(title, subtitle) {
  return nativeModule?.resolve(title, subtitle);
}

export function addResultsListener(listener) {
  return emitter?.addListener('onSearchResults', listener);
}

export const isAvailable = Boolean(nativeModule);
