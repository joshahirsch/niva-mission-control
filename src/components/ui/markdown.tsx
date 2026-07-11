import type { ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown renderer for Trello card descriptions.
 * Supports: headings, bullet + numbered lists, bold, italic, inline code, links,
 * and paragraph breaks. Intentionally small — not a full CommonMark implementation.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>,
      );
    } else if (tok.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) {
        nodes.push(
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p-${key++}`} className="leading-relaxed">
          {renderInline(para.join(" "), `p${key}`)}
        </p>,
      );
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      blocks.push(
        <p key={`h-${key++}`} className="font-semibold text-foreground">
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `oli${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (trimmed === "") {
      flushPara();
      i++;
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();

  return <div className="space-y-3 text-sm text-foreground/90">{blocks}</div>;
}
