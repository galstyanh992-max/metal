// Ambient declaration for bwip-js conditional exports that TypeScript's
// bundler moduleResolution sometimes fails to resolve under Next.js.
declare module "bwip-js" {
  export interface BwipOptions {
    bcid: string;
    text?: string;
    [key: string]: unknown;
  }
  export function toBuffer(options: BwipOptions): Promise<Buffer>;
  export function toCanvas(canvas: unknown, options: BwipOptions): void;
  const _default: { toBuffer: (options: BwipOptions) => Promise<Buffer> };
  export default _default;
}