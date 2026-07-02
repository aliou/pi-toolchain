import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNixShellRewriter, detectNixShell } from "./nix-shell";

describe("detectNixShell", () => {
  it("returns null when no nix files exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    expect(detectNixShell(dir)).toBeNull();
  });

  it("detects shell.nix", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "shell.nix"),
      "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell {}",
    );
    expect(detectNixShell(dir)).toBe("shell");
  });

  it("detects flake.nix with devShell", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "flake.nix"),
      '{ inputs.nixpkgs.url = "github:NixOS/nixpkgs"; outputs = { self, nixpkgs }: { devShells.default = nixpkgs.legacyPackages.mkShell {}; }; }',
    );
    expect(detectNixShell(dir)).toBe("flake");
  });

  it("detects flake.nix with devShells", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "flake.nix"),
      '{ inputs.nixpkgs.url = "github:NixOS/nixpkgs"; outputs = { self, nixpkgs }: { devShells = { default = nixpkgs.legacyPackages.mkShell {}; }; }; }',
    );
    expect(detectNixShell(dir)).toBe("flake");
  });

  it("ignores flake.nix without devShell", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "flake.nix"),
      '{ inputs.nixpkgs.url = "github:NixOS/nixpkgs"; outputs = { self, nixpkgs }: { packages.default = nixpkgs.legacyPackages.hello; }; }',
    );
    expect(detectNixShell(dir)).toBeNull();
  });

  it("prefers flake over shell.nix when both exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "flake.nix"),
      "{ outputs = { self, nixpkgs }: { devShells.default = nixpkgs.legacyPackages.mkShell {}; }; }",
    );
    writeFileSync(
      join(dir, "shell.nix"),
      "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell {}",
    );
    expect(detectNixShell(dir)).toBe("flake");
  });
});

describe("createNixShellRewriter", () => {
  it("returns command unchanged when no nix files exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();
      const result = rewriter({ command: "node --version" });
      expect(result.command).toBe("node --version");
      expect(result.notices).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("wraps command with nix-shell when shell.nix exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();
      const result = rewriter({ command: "node --version" });
      expect(result.command).toBe("nix-shell --run 'node --version'");
      expect(result.notices).toHaveLength(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("uses input cwd before process cwd", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");

    const rewriter = createNixShellRewriter();
    const result = rewriter({ command: "node --version", cwd: dir });

    expect(result.command).toBe("nix-shell --run 'node --version'");
    expect(result.notices).toHaveLength(1);
  });

  it("wraps command with nix develop when flake.nix with devShell exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(
      join(dir, "flake.nix"),
      "{ outputs = { self, nixpkgs }: { devShells.default = nixpkgs.legacyPackages.mkShell {}; }; }",
    );
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();
      const result = rewriter({ command: "cargo build" });
      expect(result.command).toBe("nix develop --command sh -c 'cargo build'");
      expect(result.notices).toHaveLength(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rewrites even when the parent process is inside a nix shell", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();
      const result = rewriter({
        command: "node --version",
        env: { IN_NIX_SHELL: "1" },
      });
      expect(result.command).toBe("nix-shell --run 'node --version'");
      expect(result.notices).toHaveLength(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("does not rewrite nix commands", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();

      const nixShellResult = rewriter({ command: "nix-shell --run 'make'" });
      expect(nixShellResult.command).toBe("nix-shell --run 'make'");

      const nixDevelopResult = rewriter({
        command: "nix develop --command make",
      });
      expect(nixDevelopResult.command).toBe("nix develop --command make");

      const nixBuildResult = rewriter({ command: "nix build" });
      expect(nixBuildResult.command).toBe("nix build");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("escapes single quotes in the command", () => {
    const dir = mkdtempSync(join(tmpdir(), "toolchain-nix-"));
    writeFileSync(join(dir, "shell.nix"), "{}");
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const rewriter = createNixShellRewriter();
      const result = rewriter({ command: "echo 'hello world'" });
      expect(result.command).toBe(
        "nix-shell --run 'echo '\"'\"'hello world'\"'\"''",
      );
    } finally {
      process.chdir(originalCwd);
    }
  });
});
