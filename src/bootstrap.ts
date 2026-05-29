import * as vscode from 'vscode';
import { Logger } from './core/logger';

/**
 * Application context — shared dependencies passed to features.
 *
 * As we add services (auth, stories, etc.), they'll be registered here
 * and made available to features that need them.
 */
export interface AppContext {
  vscodeContext: vscode.ExtensionContext;
  logger: Logger;
}

/**
 * Bootstraps the extension.
 *
 * 1. Creates core dependencies (logger, services)
 * 2. Registers features (commands, tree views, status bar)
 * 3. Returns the AppContext so extension.ts can manage disposal
 */
export async function bootstrap(
  vscodeContext: vscode.ExtensionContext
): Promise<AppContext> {
  // 1. Core dependencies
  const logger = new Logger('Copado Go');
  vscodeContext.subscriptions.push({ dispose: () => logger.dispose() });

  logger.info('Copado Go starting up...');
  logger.debug('Extension path:', vscodeContext.extensionPath);

  // 2. AppContext — passed to features
  const appContext: AppContext = {
    vscodeContext,
    logger,
  };

  // 3. Register features
  // (We'll add real features here in upcoming steps)
  registerPlaceholderCommands(appContext);

  logger.info('Copado Go is ready ✨');

  return appContext;
}

/**
 * Temporary: registers placeholder handlers for our 18 commands so
 * clicking them in the UI shows a helpful message instead of "command not found".
 *
 * Each will be replaced by a real implementation as we build features.
 */
function registerPlaceholderCommands(ctx: AppContext): void {
  const placeholderCommands = [
    'copado.signIn',
    'copado.signOut',
    'copado.refresh',
    'copado.stories.create',
    'copado.stories.delete',
    'copado.stories.select',
    'copado.stories.commit',
    'copado.stories.validate',
    'copado.stories.promote',
    'copado.tests.run',
    'copado.tests.rerunFailed',
    'copado.tests.viewResults',
    'copado.ai.askPlan',
    'copado.ai.askBuild',
    'copado.ai.askTest',
    'copado.ai.askRelease',
    'copado.ai.askOperate',
  ];

  for (const commandId of placeholderCommands) {
    const disposable = vscode.commands.registerCommand(commandId, () => {
      ctx.logger.info(`Command invoked: ${commandId}`);
      vscode.window.showInformationMessage(
        `🚧 ${commandId} — coming soon!`
      );
    });
    ctx.vscodeContext.subscriptions.push(disposable);
  }

  // Special: showOutput actually works (no placeholder needed)
  ctx.vscodeContext.subscriptions.push(
    vscode.commands.registerCommand('copado.showOutput', () => {
      ctx.logger.show();
    })
  );

  ctx.logger.debug(`Registered ${placeholderCommands.length + 1} command handlers`);
}