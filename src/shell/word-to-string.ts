import type { ArithExpr, Word, WordPart } from "@aliou/sh";

/**
 * Resolve a Word node to its literal string value.
 * Concatenates Literal, SglQuoted, and simple DblQuoted parts.
 * For parts containing parameter expansions, command substitutions, etc.,
 * includes the raw text representation (e.g. `$VAR`).
 */
export function wordToString(word: Word): string {
  return word.parts.map(partToString).join("");
}

function partToString(part: WordPart): string {
  switch (part.type) {
    case "Literal":
      return part.value;
    case "SglQuoted":
      return part.value;
    case "DblQuoted":
      return part.parts.map(partToString).join("");
    case "ParamExp": {
      if (part.short) return `$${part.param.value}`;
      let inner = part.param.value;
      if (part.exp) {
        inner += part.exp.op;
        if (part.exp.word) inner += wordToString(part.exp.word);
      }
      return `\${${inner}}`;
    }
    case "CmdSubst":
      return "$(...)";
    case "ArithExp":
      return `$((${arithExprToString(part.x)}))`;
    case "ProcSubst":
      return `${part.op}(...)`;
    case "BraceExp":
      return `{${part.elems.map(wordToString).join(",")}}`;
    case "ExtGlob":
      return `${part.op}${part.pattern})`;
  }
}

function arithExprToString(expr: ArithExpr): string {
  switch (expr.type) {
    case "ArithLit":
      return expr.value;
    case "ParamExp":
      return expr.short ? `$${expr.param.value}` : `\${${expr.param.value}}`;
    case "BinaryArithm":
      return `${arithExprToString(expr.x)}${expr.op}${arithExprToString(expr.y)}`;
    case "UnaryArithm":
      return expr.post
        ? `${arithExprToString(expr.x)}${expr.op}`
        : `${expr.op}${arithExprToString(expr.x)}`;
    case "ParenArithm":
      return `(${arithExprToString(expr.x)})`;
  }
}
