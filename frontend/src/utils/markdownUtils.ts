// frontend/src/utils/markdownUtils.ts
// @ts-ignore
import rehypeFigure from 'rehype-figure';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

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