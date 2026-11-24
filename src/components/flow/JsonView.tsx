import type { ReactNode } from "react";

const INDENT = "  ";

/** Longest array/object printed on one line; anything bigger breaks into one entry per line. */
const INLINE_MAX_CHARS = 60;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Punct({ children }: { children: ReactNode }) {
  return <span className="text-outline">{children}</span>;
}

function Scalar({ value }: { value: unknown }) {
  if (typeof value === "string") {
    return <span className="text-syntax-string">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number") return <span className="text-syntax-number">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="text-syntax-boolean">{String(value)}</span>;
  if (value === null || value === undefined) return <span className="text-outline italic">null</span>;
  return <span className="text-on-surface-variant">{JSON.stringify(value) ?? String(value)}</span>;
}

function Node({ value, depth }: { value: unknown; depth: number }): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <Punct>[]</Punct>;
    const flat = JSON.stringify(value);
    const inline = flat.length <= INLINE_MAX_CHARS && value.every((v) => typeof v !== "object" || v === null);
    if (inline) {
      return (
        <>
          <Punct>[</Punct>
          {value.map((item, i) => (
            <span key={i}>
              {i > 0 ? <Punct>, </Punct> : null}
              <Scalar value={item} />
            </span>
          ))}
          <Punct>]</Punct>
        </>
      );
    }
    return (
      <>
        <Punct>[</Punct>
        {"\n"}
        {value.map((item, i) => (
          <span key={i}>
            {INDENT.repeat(depth + 1)}
            <Node value={item} depth={depth + 1} />
            {i < value.length - 1 ? <Punct>,</Punct> : null}
            {"\n"}
          </span>
        ))}
        {INDENT.repeat(depth)}
        <Punct>]</Punct>
      </>
    );
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <Punct>{"{}"}</Punct>;
    return (
      <>
        <Punct>{"{"}</Punct>
        {"\n"}
        {entries.map(([key, item], i) => (
          <span key={key}>
            {INDENT.repeat(depth + 1)}
            <span className="text-secondary">{JSON.stringify(key)}</span>
            <Punct>: </Punct>
            <Node value={item} depth={depth + 1} />
            {i < entries.length - 1 ? <Punct>,</Punct> : null}
            {"\n"}
          </span>
        ))}
        {INDENT.repeat(depth)}
        <Punct>{"}"}</Punct>
      </>
    );
  }
  return <Scalar value={value} />;
}

/** Pretty-printed, colour-highlighted JSON. Purely presentational: no parsing, no HTML injection. */
export function JsonView({ value, className = "" }: { value: unknown; className?: string }) {
  return (
    <pre
      data-role="json"
      className={`m-0 overflow-auto font-mono text-[13px] leading-5 break-words whitespace-pre-wrap text-on-surface ${className}`}
    >
      <code>
        <Node value={value} depth={0} />
      </code>
    </pre>
  );
}
