import { parse, type Word } from "@aliou/sh";
import { describe, expect, it } from "vitest";
import { wordToString } from "./word-to-string";

function wordsOf(command: string): Word[] {
  const { ast } = parse(command, { dialect: "bash" });
  const stmt = ast.body[0];
  if (stmt.command.type !== "SimpleCommand") {
    throw new Error(`Expected a SimpleCommand, got ${stmt.command.type}`);
  }
  return stmt.command.words ?? [];
}

describe("wordToString", () => {
  it("resolves ANSI-C quoted words to their decoded value", () => {
    const words = wordsOf("rm $'-rf /important'");
    expect(words.map(wordToString)).toEqual(["rm", "-rf /important"]);
  });

  it("decodes ANSI-C escape sequences", () => {
    const words = wordsOf("echo $'a\\tb'");
    expect(words.map(wordToString)).toEqual(["echo", "a\tb"]);
  });

  it("resolves locale strings like double-quoted words", () => {
    const words = wordsOf('echo $"hello"');
    expect(words.map(wordToString)).toEqual(["echo", "hello"]);
  });

  it("keeps expansions inside locale strings", () => {
    const words = wordsOf('echo $"hello $USER"');
    expect(words.map(wordToString)).toEqual(["echo", "hello $USER"]);
  });

  it("renders extglob patterns from the raw pattern when no word is parsed", () => {
    const words = wordsOf("ls @(foo|bar)");
    expect(words.map(wordToString)).toEqual(["ls", "@(foo|bar)"]);
  });

  it("renders extglob patterns through the structural word when present", () => {
    const words = wordsOf("ls @(foo|$BAR)");
    expect(words.map(wordToString)).toEqual(["ls", "@(foo|$BAR)"]);
  });

  it("throws on an unknown word part instead of dropping it", () => {
    const word = {
      type: "Word",
      parts: [{ type: "FuturePart", value: "x" }],
    } as unknown as Word;
    expect(() => wordToString(word)).toThrow("Unknown word part");
  });
});
