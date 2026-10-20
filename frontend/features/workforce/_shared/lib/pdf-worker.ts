// The pdfjs worker as its own webpack entry: `new Worker(new URL('./pdf-worker.ts', import.meta.url))` bundles and minifies it as a
// worker script (pointing pdfjs at the raw .mjs file fails Next's production minifier). Importing it starts the message handler.
import 'pdfjs-dist/build/pdf.worker.mjs';
