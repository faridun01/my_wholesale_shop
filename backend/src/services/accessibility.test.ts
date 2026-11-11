import { describe, expect, it } from 'vitest';
const frontend = (file: string) => import(/* @vite-ignore */ new URL(`../../../frontend/${file}`, import.meta.url).href);
describe('accessible shared form controls', () => {
  it.each(['Input', 'Textarea', 'Select'])('%s associates label and error with the control', async name => {
    const React = await frontend('node_modules/react/index.js');
    const { renderToStaticMarkup } = await frontend('node_modules/react-dom/server.node.js');
    const components = await frontend('src/components/UI.tsx');
    const html = renderToStaticMarkup(React.createElement(components[name], { id: 'amount', label: 'Amount', error: 'Required', 'aria-describedby': 'hint' }));
    expect(html).toContain('for="amount"');
    expect(html).toContain('id="amount"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="hint amount-error"');
    expect(html).toContain('id="amount-error"');
  });
});
