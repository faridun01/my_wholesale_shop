// Isolated into its own module so Rollup can split it into its own chunk,
// fetched only when LazyMotion's dynamic `features` loader (see App.tsx) is
// invoked — not bundled into the always-loaded main chunk.
export { domAnimation } from 'motion/react';
