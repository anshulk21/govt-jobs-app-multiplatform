// lucide-react ships one file per icon but no type declarations for them.
declare module 'lucide-react/dist/esm/icons/*.mjs' {
  import type { LucideIcon } from 'lucide-react';
  const Icon: LucideIcon;
  export default Icon;
}
