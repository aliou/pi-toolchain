import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolvedToolchainConfig } from "../config";
import { resolveToolchainConfig } from "../config";
import type { ToolchainConfig } from "../config/types";
import { analyzeRewrite } from "./index";

function withConfig(partial: ToolchainConfig): ResolvedToolchainConfig {
  return resolveToolchainConfig(partial);
}

describe("analyzeRewrite", () => {
  it("prefixes git rebase editor env vars for nonInteractiveGitRebase", () => {
    const config = withConfig({
      features: { nonInteractiveGitRebase: "mutate" },
    });

    const result = analyzeRewrite(
      { command: "git rebase -i HEAD~1", env: {} },
      config,
    );

    expect(result.command).toBe(
      "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=:; git rebase -i HEAD~1",
    );
  });

  it("does not prefix git rebase when editor env already exists", () => {
    const config = withConfig({
      features: { nonInteractiveGitRebase: "mutate" },
    });

    const result = analyzeRewrite(
      {
        command: "git rebase -i HEAD~1",
        env: { GIT_EDITOR: "vim" },
      },
      config,
    );

    expect(result.command).toBe("git rebase -i HEAD~1");
  });

  it("mutates node package manager commands", () => {
    const config = withConfig({
      features: { nodePackageManager: "mutate" },
      nodePackageManager: { selected: "pnpm" },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("pnpm install");
    expect(result.notices).toHaveLength(1);
  });

  it("mutates bare python commands to python3", () => {
    const config = withConfig({
      features: { pythonToPython3: "mutate" },
    });

    const result = analyzeRewrite({ command: "python script.py" }, config);

    expect(result.command).toBe("python3 script.py");
    expect(result.notices).toHaveLength(1);
  });

  it("mutates bare python commands inside full commands", () => {
    const config = withConfig({
      features: { pythonToPython3: "mutate" },
    });

    const result = analyzeRewrite(
      {
        command:
          "rm -rf tmp && python - <<'PY'\nprint('python should stay in heredoc')\nPY",
      },
      config,
    );

    expect(result.command).toBe(
      "rm -rf tmp && python3 - <<'PY'\nprint('python should stay in heredoc')\nPY",
    );
    expect(result.notices).toHaveLength(1);
  });

  it("mutates python commands to uv after python3 when both features are enabled", () => {
    const config = withConfig({
      features: { pythonToPython3: "mutate", pythonToUv: "mutate" },
    });

    const result = analyzeRewrite({ command: "python script.py" }, config);

    expect(result.command).toBe("uv run python3 script.py");
    expect(result.notices).toHaveLength(2);
  });

  it("mutates nix shell commands when shell.nix exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const config = withConfig({
        features: { nixShell: "mutate" },
      });

      const result = analyzeRewrite({ command: "node --version" }, config);

      expect(result.command).toBe("nix-shell --run 'node --version'");
      expect(result.notices).toHaveLength(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("does not mutate nix shell commands when no nix files exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const config = withConfig({
        features: { nixShell: "mutate" },
      });

      const result = analyzeRewrite({ command: "node --version" }, config);

      expect(result.command).toBe("node --version");
      expect(result.notices).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("returns command unchanged when no mutate features enabled", () => {
    const config = withConfig({
      features: {
        nodePackageManager: "disabled",
        pythonToPython3: "disabled",
        pythonToUv: "disabled",
        nonInteractiveGitRebase: "disabled",
        nixShell: "disabled",
      },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("npm install");
    expect(result.notices).toHaveLength(0);
  });
});
