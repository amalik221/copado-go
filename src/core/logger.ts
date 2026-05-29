import * as vscode from 'vscode';

/**
 * Log levels in order of severity (lowest to highest).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Centralized logger for Copado Go.
 *
 * Writes to a dedicated VS Code Output Channel so users can view logs via
 * `View → Output → Copado Go`. Respects the `copadoGo.logLevel` setting.
 *
 * Usage:
 *   logger.info('Story loaded', { id: 'US-1234' });
 *   logger.error('Sign-in failed', error);
 */
export class Logger {
  private readonly channel: vscode.OutputChannel;
  private level: LogLevel;

  constructor(channelName: string = 'Copado Go') {
    this.channel = vscode.window.createOutputChannel(channelName);
    this.level = this.readLevelFromSettings();

    // Re-read setting if user changes it
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('copadoGo.logLevel')) {
        this.level = this.readLevelFromSettings();
        this.info(`Log level changed to: ${this.level}`);
      }
    });
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, error?: unknown): void {
    this.write('error', message, error);
  }

  /** Reveals the output panel with our channel selected. */
  show(): void {
    this.channel.show(true);
  }

  /** Disposes the channel — called during extension deactivation. */
  dispose(): void {
    this.channel.dispose();
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return; // Below threshold — skip
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    let line = `${prefix} ${message}`;

    if (data !== undefined) {
      try {
        const formatted = data instanceof Error
          ? `${data.name}: ${data.message}\n${data.stack ?? ''}`
          : JSON.stringify(data, null, 2);
        line += `\n${formatted}`;
      } catch {
        line += ` (unserializable data)`;
      }
    }

    this.channel.appendLine(line);
  }

  private readLevelFromSettings(): LogLevel {
    const config = vscode.workspace.getConfiguration('copadoGo');
    const value = config.get<string>('logLevel', 'info');
    return (['debug', 'info', 'warn', 'error'].includes(value) ? value : 'info') as LogLevel;
  }
}