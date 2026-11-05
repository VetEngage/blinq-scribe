import axe from "axe-core";

/** No accessibility violations in what's rendered. Colors are checked in the browser tests; jsdom has no layout. */
export async function expectAccessible(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
