/**
 * Stable Pi extension entry point.
 * Forwards to the implementation in src/ — the shim exists so
 * pi.extensions can point here while src/ layout changes in later phases.
 */
export { default } from "../../src/index";
