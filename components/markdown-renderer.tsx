"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// 테마는 아무거나 취향대로
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div
      className={
        className ??
        "prose prose-sm max-w-none text-gray-800 " +
          "prose-p:my-1 prose-li:my-0 prose-code:rounded " +
          "prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 " +
          "prose-pre:bg-gray-900 prose-pre:text-gray-50"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // 테이블, 체크박스, ~취소선~, 리스트 등
        rehypePlugins={[rehypeRaw]} // 간단한 HTML 허용 (필요 없으면 제거)
        components={{
          h1: ({ node, ...props }) => (
            <h1
              {...props}
              className="mt-4 mb-3 text-xl font-bold text-gray-900 border-b border-gray-200 pb-1"
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              {...props}
              className="mt-4 mb-2 text-lg font-semibold text-gray-900"
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              {...props}
              className="mt-3 mb-1 text-base font-semibold text-gray-900"
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              target="_blank"
              rel="noreferrer"
            />
          ),
          img: ({ node, ...props }) => (
            <img
              {...props}
              className="my-3 max-h-80 w-auto rounded-xl border border-gray-200 object-contain"
            />
          ),
          code({ node, className, children, ...props }) {
            const inline = (props as any).inline;
            const match = /language-(\w+)/.exec(className || "");
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  style={oneDark as any}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    borderRadius: "0.75rem",
                    padding: "0.75rem 0.9rem",
                    fontSize: "0.8rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }
            // 인라인 코드
            return (
              <code
                className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
