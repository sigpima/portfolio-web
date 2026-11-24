import { useMemo, type ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITE_SCHEME, linkCitations, parseCitationHref, type Citation } from "@/lib/citations";

/**
 * Element styles for a bot answer. No raw HTML is ever rendered (react-markdown escapes it),
 * images are dropped and links open in a new tab with `noopener`.
 */
const components: Components = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-on-surface" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  h1: (props) => <h4 className="mt-3 mb-1.5 text-headline-md font-semibold text-on-surface first:mt-0" {...props} />,
  h2: (props) => <h4 className="mt-3 mb-1.5 text-headline-md font-semibold text-on-surface first:mt-0" {...props} />,
  h3: (props) => <h5 className="mt-3 mb-1 font-semibold text-on-surface first:mt-0" {...props} />,
  h4: (props) => <h5 className="mt-3 mb-1 font-semibold text-on-surface first:mt-0" {...props} />,
  h5: (props) => <h5 className="mt-3 mb-1 font-semibold text-on-surface first:mt-0" {...props} />,
  h6: (props) => <h5 className="mt-3 mb-1 font-semibold text-on-surface first:mt-0" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-secondary" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-secondary" {...props} />,
  li: (props) => <li className="pl-0.5" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 border-secondary/60 pl-3 text-on-surface-variant" {...props} />
  ),
  hr: () => <hr className="my-3 border-outline-variant" />,
  a: ({ href, children }: ComponentProps<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-secondary underline underline-offset-2 hover:text-secondary-fixed"
    >
      {children}
    </a>
  ),
  // Inline code vs. fenced block: a block's <code> sits inside a <pre>, styled there.
  code: ({ className, children }: ComponentProps<"code">) => (
    <code
      className={`rounded bg-surface-container-lowest px-1 py-0.5 font-mono text-[0.9em] text-secondary ${className ?? ""}`}
    >
      {children}
    </code>
  ),
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3 font-mono text-[13px] leading-5 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-on-surface"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-outline-variant">
      <table className="w-full border-collapse text-left text-[0.95em]" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-surface-container-high text-on-surface" {...props} />,
  th: (props) => <th className="min-w-[7rem] border-b border-outline-variant px-3 py-1.5 font-semibold" {...props} />,
  td: (props) => <td className="min-w-[7rem] border-t border-outline-variant/60 px-3 py-1.5 align-top" {...props} />,
  img: () => null,
};

const CHIP = "rounded border border-secondary/60 px-1.5 py-0.5 font-mono text-[0.85em] text-secondary";

/** Keeps our `cite:` links (react-markdown would drop an unknown scheme) and sanitizes everything else. */
const urlTransform = (url: string) => (url.startsWith(CITE_SCHEME) ? url : defaultUrlTransform(url));

export interface MarkdownProps {
  children: string;
  /** Called when a citation chip is clicked; without it chips are plain labels. */
  onCite?: (citation: Citation) => void;
  /** Says whether a citation points at something that can be opened; false keeps the chip a plain label. */
  isCiteable?: (citation: Citation) => boolean;
}

/** A Markdown (GitHub flavoured) text rendered with the site's styles; `[slug › section]` becomes a chip. */
export function Markdown({ children, onCite, isCiteable }: MarkdownProps) {
  const text = useMemo(() => linkCitations(children), [children]);
  const withCitations = useMemo<Components>(
    () => ({
      ...components,
      a: (props: ComponentProps<"a">) => {
        const citation = parseCitationHref(props.href);
        if (citation === null) return (components.a as (p: ComponentProps<"a">) => React.ReactNode)(props);
        if (onCite !== undefined && isCiteable?.(citation) !== false) {
          return (
            <button
              type="button"
              data-role="citation"
              onClick={() => onCite(citation)}
              className={`${CHIP} cursor-pointer hover:bg-secondary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary`}
            >
              {props.children}
            </button>
          );
        }
        return (
          <span data-role="citation" className={CHIP}>
            {props.children}
          </span>
        );
      },
    }),
    [onCite, isCiteable],
  );
  return (
    <div data-role="markdown" className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={withCitations} urlTransform={urlTransform} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
