/** Public API of the course UI library (build-time render functions; browser-safe, no Node imports). */
export {
  type CompiledTheme,
  type ContrastResult,
  compileTheme,
  defaultDirection,
  familyTokens,
  type ResolvedTokens,
} from '../tokens/compile.js';
export { contrastRatio, oklchToHex, relativeLuminance } from '../tokens/contrast.js';
export { Figure, type FigureProps, type VisualRender } from './components/figure.js';
export { correctAnswerHtml, domId, initialOrder, Question, type QuestionProps } from './components/question.js';
export {
  type CourseContext,
  createContext,
  Results,
  SCREEN_COMPONENTS,
  ScreenView,
} from './components/screens.js';
export {
  Announcer,
  AppShell,
  ConfirmDialog,
  courseData,
  dataScript,
  GlossaryDialog,
  Header,
  NavDrawer,
  Pager,
  ReferencesDialog,
  SourceDialog,
} from './components/shell.js';
export { attrs, blockAttrs, type CfComponent, esc, ICONS, type IconName, icon, iconSprite, md } from './contract.js';
export { grade, summarize } from './runtime/grade.js';
export type { CfData, CfItem, CfResponse } from './runtime/types.js';
