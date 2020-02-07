// todo: get these on DT or something?
declare module 'kap' {
  import * as ElectronStore from 'electron-store';
  import got from 'got';
  import { JSONSchema7 } from 'json-schema';

  export interface KapContext<T> {
    format: string;
    defaultFileName: string;
    filePath(): Promise<string>;
    config: { get<K extends keyof T>(key: K): T[K] };
    request: typeof got;
    copyToClipboard(text: string): void;
    notify(text: string): void;
    setProgress(text: string, percentage: number): void;
    openConfigFile(): void;
    cancel(): void;
  }

  export interface KapShareService {
    action(context: KapContext): Promise<void>;
    title: string;
    formats: ReadonlyArray<string>;
    config: { [key: string]: Omit<JSONSchema7, 'required'> & { required?: boolean } };
  }
}
