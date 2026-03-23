import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <div className="article-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
