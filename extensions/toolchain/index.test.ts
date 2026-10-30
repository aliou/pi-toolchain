import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ExtensionAPI, initTheme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { configLoader, type ToolchainConfig } from "../../src/config";
import extension from "./index";

const agentDir = vi.hoisted(() => {
  const fs = process.getBuiltinModule("node:fs");
  const os = process.getBuiltinModule("node:os");
  const path = process.getBuiltinModule("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "toolchain-agent-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", dir);
  return dir;
});

beforeAll(() => initTheme("dark", false));

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(agentDir, { recursive: true, force: true });
});

let root: string;
let project: string;
let localPath: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "toolchain-"));
  project = join(root, "project");
  localPath = join(project, ".pi/extensions/toolchain.json");
  mkdirSync(join(project, ".pi/extensions"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(project);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(join(agentDir, "extensions"), { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
});

function writeGlobal(config: ToolchainConfig) {
  mkdirSync(join(agentDir, "extensions"), { recursive: true });
  writeFileSync(
    join(agentDir, "extensions/toolchain.json"),
    JSON.stringify(config),
  );
}

async function setup(trusted: boolean) {
  const handlers = new Map<string, Array<Parameters<ExtensionAPI["on"]>[1]>>();
  const commands = new Map<
    string,
    Parameters<ExtensionAPI["registerCommand"]>[1]
  >();
  const pi = {
    on(name: string, handler: Parameters<ExtensionAPI["on"]>[1]) {
      const registered = handlers.get(name) ?? [];
      registered.push(handler);
      handlers.set(name, registered);
    },
    registerCommand(
      name: string,
      command: Parameters<ExtensionAPI["registerCommand"]>[1],
    ) {
      commands.set(name, command);
    },
  } as unknown as ExtensionAPI;
  await extension(pi);
  const notify = vi.fn();
  const ctx = { cwd: project, isProjectTrusted: () => trusted, ui: { notify } };
  return {
    configLoader,
    notify,
    async settings(scope = "local") {
      let panel: Component | undefined;
      const command = commands.get("toolchain:settings");
      if (!command) throw new Error("Settings command is not registered");
      await command.handler(scope, {
        hasUI: true,
        ui: {
          notify,
          custom(factory: (...args: unknown[]) => Component) {
            panel = factory(
              { requestRender() {} },
              {
                fg: (_color: string, text: string) => text,
                bg: (_color: string, text: string) => text,
                bold: (text: string) => text,
              },
              undefined,
              () => {},
            );
          },
        },
      } as never);
      if (!panel) throw new Error("Settings panel was not created");
      return panel;
    },
    async start() {
      for (const handler of handlers.get("session_start") ?? []) {
        await handler({} as never, ctx as never);
      }
    },
    async call(command = "npm install") {
      const event = { toolName: "bash", input: { command } };
      let result: unknown;
      for (const handler of handlers.get("tool_call") ?? []) {
        result = await handler(event as never, ctx as never);
      }
      return { command: event.input.command, result };
    },
  };
}

describe("project configuration", () => {
  it("leaves untrusted project files unchanged during setup", async () => {
    const source = JSON.stringify({
      features: { nodePackageManager: "mutate" },
    });
    writeFileSync(localPath, source);
    await setup(false);
    expect(readFileSync(localPath, "utf8")).toBe(source);
  });

  it("ignores untrusted project mutations without changing the file", async () => {
    const source = JSON.stringify({
      features: { nodePackageManager: "mutate" },
    });
    writeFileSync(localPath, source);
    const app = await setup(false);
    await app.start();
    expect(await app.call()).toEqual({
      command: "npm install",
      result: undefined,
    });
    expect(readFileSync(localPath, "utf8")).toBe(source);
    expect(app.notify).toHaveBeenCalledWith(
      expect.stringContaining("project not trusted"),
      "warning",
    );
    expect(app.notify.mock.calls[0][0]).not.toContain("was migrated");
    const panel = await app.settings();
    const rendered = panel.render(100).join("\n");
    expect(rendered).toContain("Project not trusted");
    expect(rendered).not.toContain("Ctrl+S save");
    expect(rendered).not.toContain("Node package manager");
    panel.handleInput?.("\r");
    panel.handleInput?.("\x13");
    await expect(app.configLoader.save("local", {})).rejects.toThrow(
      "not trusted",
    );
    expect(readFileSync(localPath, "utf8")).toBe(source);
  });

  it("loads trusted project mutations at session start", async () => {
    writeFileSync(
      localPath,
      JSON.stringify({ features: { nodePackageManager: "mutate" } }),
    );
    const app = await setup(true);
    expect((await app.call()).command).toBe("npm install");
    await app.start();
    expect((await app.call()).command).toBe("pnpm install");
    expect(app.configLoader.getProjectState()).toBe("trusted");
    expect((await app.settings()).render(100).join("\n")).toContain(
      "Node package manager",
    );
  });

  it("does not let an untrusted project disable global features", async () => {
    writeGlobal({ features: { nodePackageManager: "block" } });
    const source = JSON.stringify({ enabled: false });
    writeFileSync(localPath, source);
    const app = await setup(false);
    await app.start();
    expect((await app.call()).result).toEqual({
      block: true,
      reason: expect.any(String),
    });
    expect(readFileSync(localPath, "utf8")).toBe(source);
  });

  it("allows trusted project settings to enable globally disabled enforcement", async () => {
    writeGlobal({ enabled: false });
    writeFileSync(
      localPath,
      JSON.stringify({
        enabled: true,
        features: { nodePackageManager: "mutate" },
      }),
    );
    const app = await setup(true);
    await app.start();
    expect((await app.call()).command).toBe("pnpm install");
    expect(app.notify).toHaveBeenCalled();
  });

  it("keeps settings available when enforcement starts disabled", async () => {
    writeGlobal({ enabled: false });
    writeFileSync(
      localPath,
      JSON.stringify({ features: { nodePackageManager: "mutate" } }),
    );
    const app = await setup(false);
    await app.start();
    expect((await app.call("git rebase -i HEAD~1")).command).toBe(
      "git rebase -i HEAD~1",
    );
    expect(app.notify).toHaveBeenCalledWith(
      expect.stringContaining("project not trusted"),
      "warning",
    );
    expect((await app.settings()).render(100).join("\n")).toContain(
      "Project not trusted",
    );
    await app.configLoader.save("memory", {
      enabled: true,
      features: { nodePackageManager: "mutate" },
    });
    expect((await app.call()).command).toBe("pnpm install");
  });

  it("applies saved settings from the settings panel to the next call", async () => {
    writeGlobal({ features: { nonInteractiveGitRebase: "disabled" } });
    const app = await setup(true);
    await app.start();
    const panel = await app.settings();
    panel.handleInput?.("\r");
    panel.handleInput?.("\x13");
    await vi.waitFor(() =>
      expect(app.notify).toHaveBeenCalledWith("toolchain: saved", "info"),
    );
    expect((await app.call()).command).toBe("pnpm install");
  });

  it("uses settings changes on the next call", async () => {
    const app = await setup(true);
    await app.start();
    expect((await app.call()).command).toBe("npm install");
    await app.configLoader.save("memory", {
      features: { nodePackageManager: "mutate" },
    });
    expect((await app.call()).command).toBe("pnpm install");
    await app.configLoader.save("memory", {
      features: { nodePackageManager: "block" },
    });
    expect((await app.call()).result).toEqual({
      block: true,
      reason: expect.any(String),
    });
    await app.configLoader.save("memory", { enabled: false });
    expect((await app.call("git rebase -i HEAD~1")).command).toBe(
      "git rebase -i HEAD~1",
    );
  });
});
