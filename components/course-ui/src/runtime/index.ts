/** Runtime entry bundled by esbuild into the course HTML as an IIFE. */
import { boot } from './app.js';

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(document));
else boot(document);
