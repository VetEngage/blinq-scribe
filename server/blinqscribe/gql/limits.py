"""Request limits beyond depth and aliases: one model call per request."""

from __future__ import annotations

from typing import Any

from graphql import (
    FieldNode,
    FragmentSpreadNode,
    GraphQLError,
    InlineFragmentNode,
    OperationDefinitionNode,
    OperationType,
    SelectionSetNode,
    ValidationRule,
)

# Mutations that call the model, which costs money per call. Documents' key points
# are a model call too, but outside records upload over REST only.
PAID = frozenset({"draft_note", "ask_assistant", "assist", "draft_letter"})


class OnePaidCall(ValidationRule):
    """At most one model-calling mutation per request, however it is spelled:
    aliases, fragments or repeats of the same field."""

    def enter_operation_definition(
        self, node: OperationDefinitionNode, *_: Any
    ) -> None:
        if node.operation != OperationType.MUTATION:
            return
        paid = [f for f in self._top_fields(node.selection_set, set()) if f in PAID]
        if len(paid) > 1:
            self.report_error(
                GraphQLError(
                    "Ask for one AI step at a time: send draft_note, ask_assistant, "
                    "assist and draft_letter as separate requests.",
                    node,
                    extensions={"code": "BAD_INPUT", "status": 400},
                )
            )

    def _top_fields(self, selections: SelectionSetNode, seen: set[str]) -> list[str]:
        out: list[str] = []
        for sel in selections.selections:
            if isinstance(sel, FieldNode):
                out.append(sel.name.value)
            elif isinstance(sel, InlineFragmentNode):
                out += self._top_fields(sel.selection_set, seen)
            elif isinstance(sel, FragmentSpreadNode) and sel.name.value not in seen:
                seen.add(sel.name.value)
                fragment = self.context.get_fragment(sel.name.value)
                if fragment:
                    out += self._top_fields(fragment.selection_set, seen)
        return out
