// Entry point (architecture.md 5): boot the app once the DOM is ready.
import './styles.css';
import { boot, reportBootFailure } from './app/boot.ts';

boot(document).catch((err: unknown) => {
  reportBootFailure(document);
  // Boot failures are fatal and must be visible in the console and to e2e tests (pageerror).
  queueMicrotask(() => {
    throw err;
  });
});
