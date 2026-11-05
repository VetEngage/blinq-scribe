// The lint rule that keeps type to the roles in src/index.ts (`type`) and spacing to the six steps.
// Type comes from roles only: text-display, text-title, text-section, text-body, text-body-strong,
// text-meta, text-label, the left rail's own nine (text-rail-title, text-rail-meta, text-rail-time,
// text-rail-group, text-rail-tag, text-rail-name, text-rail-sub, text-rail-reason, text-rail-caution)
// and font-num for numerals (the text font, tabular). Mono is flagged
// everywhere. Spacing is 4, 8, 12, 16, 24 or 32: nothing between.
// Plain JS so every package's eslint.config.js can load it as is.

const typeMessage =
  "Use a type role (text-display, text-title, text-section, text-body, text-body-strong, text-meta, text-label; in the rail, text-rail-title, text-rail-meta, text-rail-time, text-rail-group, text-rail-tag, text-rail-name, text-rail-sub, text-rail-reason, text-rail-caution) and font-num for numerals.";
const spaceMessage = "Spacing is 4, 8, 12, 16, 24 or 32 (steps 1, 2, 3, 4, 6, 8): nothing between.";

/**
 * Retired sizes, Tailwind's own sizes, arbitrary sizes and weights, and mono (font-mono, and the
 * retired font-time): a role's job. Checked in every string, since class lists also live in constants
 * (a button's variants).
 */
const retiredType =
  /^(text-(xs|sm|base|lg|[2-9]?xl|card-title|body-lg|body-xl|small|eyebrow|micro|header-[a-z]+)|text-\[\d[^\]]*\]|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|mono|time))$/;
/** The steps between the six: 2, 6, 10, 14, 20 and 28 px. */
const offScale = /^-?(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-(0\.5|1\.5|2\.5|3\.5|5|7)$/;
/**
 * Line, tracking and case, and the old helper classes (small, mono, lead, eyebrow): checked only where
 * a word is surely a class, since "leading" and "small" are also English.
 */
const classOnly = /^(leading-.+|tracking-.+|uppercase|small|mono|lead|eyebrow)$/;
const styleType = /^(fontSize|fontWeight|lineHeight|letterSpacing|fontFamily|textTransform)$/;

/** `md:hover:!p-5` is checked as `p-5`. */
const bare = (token) => token.split(":").pop().replace(/^!/, "");

/** Inside a className (or iconClassName, ...) attribute, or a cx/clsx call: where a bare word is a class. */
function inClassContext(ancestors) {
  return ancestors.some(
    (a) =>
      (a.type === "JSXAttribute" && /className$/i.test(a.name.name)) ||
      (a.type === "CallExpression" && a.callee.type === "Identifier" && /^(cx|clsx)$/.test(a.callee.name)),
  );
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Type comes from the seven roles, the nine rail roles and font-num; spacing from the six steps." },
    schema: [],
    messages: { type: `{{token}}: ${typeMessage}`, space: `{{token}}: ${spaceMessage}` },
  },
  create(context) {
    const check = (node, text) => {
      if (!text || !/[a-z]/.test(text)) return;
      const classes = inClassContext(context.sourceCode.getAncestors(node));
      for (const raw of text.split(/\s+/)) {
        const token = bare(raw);
        if (!token) continue;
        if (retiredType.test(token) || (classes && classOnly.test(token)))
          context.report({ node, messageId: "type", data: { token } });
        else if (offScale.test(token)) context.report({ node, messageId: "space", data: { token } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
      // style={{ fontSize: 22 }}: type set by hand.
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (typeof key !== "string" || !styleType.test(key)) return;
        const attr = context.sourceCode.getAncestors(node).find((a) => a.type === "JSXAttribute");
        if (attr && attr.name.name === "style") context.report({ node, messageId: "type", data: { token: key } });
      },
    };
  },
};

/** The plugin: `plugins: { blinq: typeRoles }`, then `"blinq/type-roles": "error"`. */
export default { rules: { "type-roles": rule } };
