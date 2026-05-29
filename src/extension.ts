import * as vscode from 'vscode';
import { bootstrap } from './bootstrap';

/**
 * Extension entry point. Called by VS Code when the extension activates.
 *
 * Keep this file tiny — all real logic lives in bootstrap.ts and beyond.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await bootstrap(context);
}

/**
 * Called by VS Code when the extension deactivates (e.g., window closed).
 *
 * Note: Most cleanup happens automatically via context.subscriptions.
 * Only put cleanup here that can't be a Disposable.
 */
export function deactivate(): void {
  // Intentionally empty — disposables registered in subscriptions handle cleanup.
}