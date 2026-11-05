import { render, screen } from "@testing-library/react";
import type { Appointment } from "../api/types";
import { useRecorder } from "../recorder/store";

vi.mock("../api", () => ({ api: {} }));

import { StatusTag } from "./LeftColumn";

const started = { id: "a1", encounter_id: "enc-1", visit_status: "recording" } as unknown as Appointment;

describe("a visit's status on the schedule", () => {
  afterEach(() => useRecorder.setState({ encounterId: "" }));

  it("says In visit with a green dot, still while no audio comes in", () => {
    const { container } = render(<StatusTag a={started} />);
    expect(screen.getByText("In visit")).toHaveClass("text-primary");
    expect(container.querySelector(".bg-primary")).not.toHaveClass("animate-pulse-dot");
    expect(screen.queryByText(/Recording|In progress/)).not.toBeInTheDocument();
  });

  it("pulses the green dot while this computer records it, never a red one", () => {
    useRecorder.setState({ encounterId: "enc-1" });
    const { container } = render(<StatusTag a={started} />);
    expect(container.querySelector(".animate-pulse-dot")).toHaveClass("bg-primary");
    expect(container.querySelector(".rec-dot, .bg-error, .text-error")).toBeNull();
  });

  it("pulses while the glasses or another console send audio (audio_live)", () => {
    const { container } = render(<StatusTag a={{ ...started, audio_live: true }} />);
    expect(container.querySelector(".animate-pulse-dot")).not.toBeNull();
  });

  it("shows only what means something: Draft ready in purple, Signed with a green check, Not started nothing", () => {
    const { container, rerender } = render(
      <StatusTag a={{ ...started, visit_status: "draft_ready" } as Appointment} />,
    );
    expect(screen.getByText("Draft ready")).toHaveClass("text-ai");
    expect(container.querySelector('[data-icon="auto_awesome"]')).not.toBeNull();
    rerender(<StatusTag a={{ ...started, visit_status: "signed" } as Appointment} />);
    expect(screen.getByText("Signed")).toHaveClass("text-success");
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull();
    rerender(<StatusTag a={{ ...started, visit_status: "not_started" } as Appointment} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is red only for something broken: a text that didn't send", () => {
    render(<StatusTag a={{ ...started, visit_status: "signed" } as Appointment} broken="text" />);
    expect(screen.getByText("Text didn't send")).toHaveClass("text-error");
    expect(screen.queryByText("Signed")).not.toBeInTheDocument();
  });

  it("another visit recording doesn't make this one pulse", () => {
    useRecorder.setState({ encounterId: "enc-2" });
    const { container } = render(<StatusTag a={started} />);
    expect(container.querySelector(".animate-pulse-dot")).toBeNull();
  });
});
