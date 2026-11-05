import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible } from "../test/axe";
import { DataTable, type TableColumn } from "../index";

type Row = { id: string; name: string; total: string; items: { name: string; qty: number; price: string }[] };
const rows: Row[] = [
  { id: "a", name: "Sick exam", total: "$86.90", items: [{ name: "Exam", qty: 1, price: "$68.00" }] },
  { id: "b", name: "Wellness", total: "$757.50", items: [] },
];
const columns: TableColumn<Row>[] = [
  { key: "name", header: "Visit", cell: (r) => r.name },
  { key: "qty", header: <span className="sr-only">Quantity</span>, num: true, cell: () => null },
  { key: "total", header: "Total", num: true, cell: (r) => r.total },
  { key: "status", header: "Status", cell: () => "Paid" },
];

function show() {
  return render(
    <DataTable
      aria-label="Invoices"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      expand={{
        column: "name",
        children: (r) => r.items.map((x, n) => ({ key: String(n), cells: { name: x.name, qty: `× ${x.qty}`, total: x.price } })),
        note: () => "Paid by Card",
      }}
    />,
  );
}

const col = (cell: HTMLElement) => [...cell.parentElement!.children].indexOf(cell);

describe("DataTable", () => {
  it("is a real table with Label headers, tabular right-aligned numbers and zebra rows", async () => {
    show();
    const table = screen.getByRole("table", { name: "Invoices" });
    const total = within(table).getByRole("columnheader", { name: "Total" });
    expect(total).toHaveClass("text-label", "text-right", "font-num");
    const status = within(table).getByRole("columnheader", { name: "Status" });
    expect(col(status)).toBe(col(total) + 1);
    const cell = within(table).getByText("$86.90");
    expect(cell).toHaveClass("text-right", "font-num", "whitespace-nowrap", "px-3");
    const [, first, second] = within(table).getAllByRole("row");
    expect(first).not.toHaveClass("bg-surface-muted");
    expect(second).toHaveClass("bg-surface-muted");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
    await expectAccessible();
  });

  it("opens a row into child rows in the same columns, with a button that says so", async () => {
    show();
    const toggle = screen.getByRole("button", { name: /Sick exam/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Exam")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const amount = screen.getByText("$68.00");
    expect(col(amount)).toBe(col(screen.getByText("$86.90")));
    expect(amount).toHaveClass("text-right", "font-num");
    expect(col(screen.getByText("Exam"))).toBe(col(screen.getByRole("columnheader", { name: "Visit" })));
    const note = screen.getByText("Paid by Card");
    for (const id of toggle.getAttribute("aria-controls")!.split(" ")) expect(document.getElementById(id)).toBeInTheDocument();
    expect(note.closest("tr")).toHaveClass("text-meta");
    await expectAccessible();
    await userEvent.click(toggle);
    expect(screen.queryByText("Exam")).not.toBeInTheDocument();
  });
});
