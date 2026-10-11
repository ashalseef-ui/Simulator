import { CliMode, CommandNode, CommandContext, CliExecutionResult } from './types';

export class CommandTrie {
  private rootNodes: CommandNode[] = [];

  public register(node: CommandNode): void {
    this.rootNodes.push(node);
  }

  public registerAll(nodes: CommandNode[]): void {
    nodes.forEach((n) => this.register(n));
  }

  /**
   * Generates contextual "?" help for the current mode.
   */
  public getHelp(currentMode: CliMode, partialTokens: string[] = []): string {
    const applicable = this.rootNodes.filter((n) => n.modes.includes(currentMode));

    if (partialTokens.length === 0) {
      const lines = applicable
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => `  ${n.name.padEnd(20)} ${n.description}`);
      return lines.length > 0 ? lines.join('\n') : '% No commands available in this mode';
    }

    // Help for subcommands
    const firstToken = partialTokens[0].toLowerCase();
    const match = this.matchNode(firstToken, applicable);
    if (!match.node || !match.node.children) {
      return `% No subcommands available for "${firstToken}"`;
    }

    const subLines = match.node.children
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `  ${c.name.padEnd(20)} ${c.description}`);
    return subLines.join('\n');
  }

  /**
   * Matches a string token against a list of candidate command nodes using prefix matching.
   */
  public matchNode(
    token: string,
    candidates: CommandNode[]
  ): { node?: CommandNode; isAmbiguous?: boolean; matches?: string[] } {
    const lower = token.toLowerCase();

    // 1. Exact name match
    const exact = candidates.find(
      (c) => c.name.toLowerCase() === lower || c.aliases?.some((a) => a.toLowerCase() === lower)
    );
    if (exact) return { node: exact };

    // 2. Prefix matching (e.g. "sh" -> "show", "conf" -> "configure")
    const matched = candidates.filter(
      (c) =>
        c.name.toLowerCase().startsWith(lower) ||
        c.aliases?.some((a) => a.toLowerCase().startsWith(lower))
    );

    if (matched.length === 1) {
      return { node: matched[0] };
    }
    if (matched.length > 1) {
      return {
        isAmbiguous: true,
        matches: matched.map((m) => m.name),
      };
    }

    return {};
  }

  /**
   * Dispatches and executes a command string against the command tree in the active mode.
   */
  public dispatch(tokens: string[], ctx: CommandContext): CliExecutionResult | null {
    if (tokens.length === 0) return null;

    const currentMode = ctx.session.mode;
    const applicable = this.rootNodes.filter((n) => n.modes.includes(currentMode));

    const firstToken = tokens[0];
    const match = this.matchNode(firstToken, applicable);

    if (match.isAmbiguous) {
      return {
        output: `% Ambiguous command: "${firstToken}"`,
        newSession: ctx.session,
      };
    }

    if (!match.node) {
      return null; // Not found in registered tree; fall through to legacy handlers
    }

    // If node has an executor, run it
    if (match.node.execute) {
      return match.node.execute(tokens.slice(1), ctx);
    }

    return null;
  }
}
