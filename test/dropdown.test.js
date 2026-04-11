import { render, screen } from "@testing-library/react";
import React from "react";
import CustomDropdownItem from "../lib/dropdown";

describe("CustomDropdownItem", () => {
  it("ノート名とブック名を表示する", () => {
    render(<CustomDropdownItem text="Example" book="Inbox" status="none" />);

    expect(screen.getByText("Example")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("completed のとき完了アイコンを表示する", () => {
    const { container } = render(
      <CustomDropdownItem text="Done" book="Inbox" status="completed" />
    );

    expect(container.querySelector("[name='status-completed']")).not.toBeNull();
  });
});
