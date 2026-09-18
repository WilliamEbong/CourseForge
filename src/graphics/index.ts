export { type BrowserLib, GraphicsBrowser, libPath } from './browser.js';
export { renderD3 } from './d3.js';
export { hasIcon, iconSvg } from './lucide.js';
export { mermaidLabel, mermaidSource, mermaidThemeVariables, renderMermaid } from './mermaid.js';
export { NATIVE_ARCHETYPES, NATIVE_BUILDERS, renderNative } from './native/index.js';
export { idPrefix, type PostprocessOptions, parseColor, postprocessSvg, rewritePalette, UnsafeSvgError } from './postprocess.js';
export { checkSvgInBrowser, checkSvgStatic, type QualityIssue } from './quality.js';
export {
  type RenderAttempt,
  type RenderContext,
  type RenderedVisual,
  renderAll,
  renderRaw,
  renderVisual,
  textEquivalentFigure,
  type VisualRoute,
} from './render.js';
export { renderSvgJs } from './svgjs.js';
export { textWidth, wrapText } from './text.js';
export { cssVar, type FigureStyle, FONT_FAMILY, type GraphicsTheme, PALETTE, type PaletteSlot } from './theme.js';
export { chartData, renderVegaLite, vegaLiteSpec } from './vega.js';
