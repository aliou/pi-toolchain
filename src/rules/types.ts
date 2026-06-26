export interface RewriteNotice {
  message: string;
}

export interface RewriteInput {
  command: string;
  /** Working directory to evaluate project-local toolchain files from. */
  cwd?: string;
  /**
   * Optional env snapshot.
   * Needed to preserve current git-rebase behavior which skips
   * injection when GIT_EDITOR/GIT_SEQUENCE_EDITOR is already set.
   */
  env?: Readonly<Record<string, string | undefined>>;
}

export interface RewriteResult {
  command: string;
  notices: RewriteNotice[];
}

export type Rewriter = (input: RewriteInput) => RewriteResult;
