import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownMessageRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          return !inline && match ? (
            <pre className="message-code-block" data-language={language}>
              <code className={className} {...props}>
                {String(children).replace(/\n$/, '')}
              </code>
            </pre>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        a({ children, ...props }) {
          return (
            <a {...props} target="_blank" rel="noopener noreferrer" className="message-link">
              {children}
            </a>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default React.memo(MarkdownMessageRenderer);
