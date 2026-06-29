import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { ResolvedToolchainConfig } from "../../../src/config";
import { resolveToolchainConfig } from "../../../src/config";
import type { ToolchainConfig } from "../../../src/config/types";
import {
  hasMutationFeatures,
  hasToolCallFeatures,
  registerToolCallHandler,
} from "./tool-call";

function createPiStub() {
  const toolCallHandlers: Array<Parameters<ExtensionAPI["on"]>[1]> = [];

  const pi = {
    on(eventName: string, handler: Parameters<ExtensionAPI["on"]>[1]) {
      if (eventName === "tool_call") {
        toolCallHandlers.push(handler);
      }
    },
  } as unknown as ExtensionAPI;

  return { pi, toolCallHandlers };
}

function withConfig(partial: ToolchainConfig): ResolvedToolchainConfig {
  return resolveToolchainConfig(partial);
}

// --- Feature predicates ---

describe("feature predicates", () => {
  it("hasMutationFeatures is true when a feature is in mutate mode", () => {
    const config = withConfig({
      features: { nodePackageManager: "mutate" },
    });
    expect(hasMutationFeatures(config)).toBe(true);
  });

  it("hasMutationFeatures is false when no mutate feature is enabled", () => {
    const config = withConfig({
      features: {
        nodePackageManager: "block",
        pythonToPython3: "disabled",
        pythonToUv: "disabled",
        nonInteractiveGitRebase: "disabled",
        nixShell: "disabled",
      },
    });

    expect(hasMutationFeatures(config)).toBe(false);
  });

  it("hasToolCallFeatures is true when mutation features are enabled", () => {
    const config = withConfig({
      features: { nonInteractiveGitRebase: "mutate" },
      ui: { showMutationNotifications: false },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is true when block features are enabled", () => {
    const config = withConfig({
      features: { nodePackageManager: "block" },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasMutationFeatures is true when nixShell is in mutate mode", () => {
    const config = withConfig({
      features: { nixShell: "mutate" },
    });
    expect(hasMutationFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is true when notifications are enabled", () => {
    const config = withConfig({
      features: { nodePackageManager: "disabled" },
      ui: { showMutationNotifications: true },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is false when nothing is active", () => {
    const config = withConfig({
      features: {
        nodePackageManager: "disabled",
        pythonToPython3: "disabled",
        pythonToUv: "disabled",
        nonInteractiveGitRebase: "disabled",
        nixShell: "disabled",
      },
      ui: { showMutationNotifications: false },
    });

    expect(hasToolCallFeatures(config)).toBe(false);
  });
});

// --- tool_call hook ---

describe("tool_call hook", () => {
  it("mutates event.input.command for nonInteractiveGitRebase", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nonInteractiveGitRebase: "mutate" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "git rebase -i HEAD~1" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toBeUndefined();
    expect(event.input.command).toBe(
      "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=:; git rebase -i HEAD~1",
    );
  });

  it("mutates node package manager commands", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nodePackageManager: "mutate" },
      nodePackageManager: { selected: "pnpm" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("pnpm install");
  });

  it("mutates python commands", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { pythonToUv: "mutate" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "python script.py" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("uv run python script.py");
  });

  it("uses bash cwd param for nix shell mutation", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "toolchain-base-"));
    const projectDir = join(baseDir, "project");
    mkdirSync(projectDir);
    writeFileSync(join(projectDir, "shell.nix"), "{}");

    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nixShell: "mutate" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "node --version", cwd: "project" },
    };

    const originalInNixShell = process.env.IN_NIX_SHELL;
    delete process.env.IN_NIX_SHELL;

    try {
      await toolCallHandlers[0](
        event as never,
        {
          cwd: baseDir,
          ui: { notify() {} },
        } as never,
      );
    } finally {
      if (originalInNixShell === undefined) {
        delete process.env.IN_NIX_SHELL;
      } else {
        process.env.IN_NIX_SHELL = originalInNixShell;
      }
    }

    expect(event.input.command).toBe("nix-shell --run 'node --version'");
  });

  it("does not mutate when no mutate features are enabled", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: {
        nodePackageManager: "disabled",
        pythonToPython3: "disabled",
        pythonToUv: "disabled",
        nonInteractiveGitRebase: "disabled",
        nixShell: "disabled",
      },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("npm install");
    // Note: in production, the handler wouldn't be registered for this config
    // since hasToolCallFeatures returns false. This tests the internal guard.
  });

  it("blocks commands instead of mutating when mode is block", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nodePackageManager: "block" },
      nodePackageManager: { selected: "pnpm" },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toEqual({ block: true, reason: expect.any(String) });
    expect(event.input.command).toBe("npm install"); // not mutated
  });

  it("emits mutation notifications without bash source prefix", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nonInteractiveGitRebase: "mutate" },
      ui: { showMutationNotifications: true },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "git rebase -i HEAD~1" },
    };
    const messages: string[] = [];

    await toolCallHandlers[0](
      event as never,
      {
        ui: {
          notify(message: string) {
            messages.push(message);
          },
        },
      } as never,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0] ?? "").not.toMatch(
      /^\[(override-bash|composed-bash)\] /,
    );
    expect(messages[0]).toContain("GIT_EDITOR");
    expect(event.input.command).toContain("GIT_EDITOR=true");
  });

  it("ignores non-bash tool calls", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { nodePackageManager: "mutate" },
      nodePackageManager: { selected: "pnpm" },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "read",
      input: { command: "npm install" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toBeUndefined();
    expect(event.input.command).toBe("npm install"); // untouched
  });

  it("does not mutate or notify when showMutationNotifications is on but all features disabled", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: {
        nodePackageManager: "disabled",
        pythonToPython3: "disabled",
        pythonToUv: "disabled",
        nonInteractiveGitRebase: "disabled",
        nixShell: "disabled",
      },
      ui: { showMutationNotifications: true },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };
    const messages: string[] = [];

    await toolCallHandlers[0](
      event as never,
      {
        ui: {
          notify(message: string) {
            messages.push(message);
          },
        },
      } as never,
    );

    expect(messages).toHaveLength(0);
    expect(event.input.command).toBe("npm install");
  });
});
