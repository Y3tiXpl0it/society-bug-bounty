// frontend/src/utils/markdownUtils.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import type { Root, Image } from 'mdast';
// @ts-ignore
import rehypeFigure from 'rehype-figure';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Replaces data URLs in image sources within Markdown text with real URLs.
 * Uses AST parsing to target only <img> tags, avoiding false positives in code or links.
 *
 * @param markdown - The Markdown string to process.
 * @param urlMap - A record mapping data URLs to real URLs.
 * @returns The processed Markdown string with replacements applied.
 */
export function replaceDataUrlsInMarkdown(
  markdown: string,
  urlMap: Record<string, string>
): string {
  if (!markdown || Object.keys(urlMap).length === 0) {
    return markdown;
  }

  // First, try to replace using AST parsing for proper markdown images
  const processor = unified()
    .use(remarkParse)
    .use(() => (tree: Root) => {
      visit(tree, (node) => {
        if (node.type === 'image' && (node as Image).url && urlMap[(node as Image).url]) {
          (node as Image).url = urlMap[(node as Image).url];
        }
      });
    })
    .use(remarkStringify);

  try {
    let result = processor.processSync(markdown);
    let resultString = result.toString();

    // Additionally, replace any remaining filename references that might not be proper markdown images
    // This handles cases where users manually type ![alt](filename.png)
    Object.keys(urlMap).forEach(filename => {
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      resultString = resultString.replace(regex, urlMap[filename]);
    });

    return resultString;
  } catch (error) {
    console.error('Error processing Markdown for URL replacement:', error);
    return markdown; // Return original on error
  }
}

/**
 * Visits all nodes in the AST tree recursively.
 */
function visit(node: any, callback: (node: any) => void): void {
  callback(node);
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => visit(child, callback));
  }
}

/**
  * Common rehype plugins for Markdown processing across the application.
 */
export const rehypePlugins = [
    rehypeFigure,
    rehypeRaw,
    [rehypeSanitize, {
        ...defaultSchema,
        tagNames: [...(defaultSchema.tagNames || []), 'u', 'del'],
        attributes: {
            ...defaultSchema.attributes,
            u: ['className'],
            del: ['className']
        }
    }]
];