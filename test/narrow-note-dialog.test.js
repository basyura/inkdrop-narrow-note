import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { act } from "react";
import { createInkdropMock } from "./helpers/create-inkdrop-mock";

jest.mock(
  "inkdrop",
  () => {
    const ReactModule = require("react");
  return {
    useModal() {
      const [visible, setVisible] = ReactModule.useState(false);
      return {
        state: { visible },
        show: () => setVisible(true),
        close: () => setVisible(false),
      };
    },
  };
  },
  { virtual: true }
);

jest.mock("fs", () => {
  const existsSync = jest.fn(() => false);
  const readFileSync = jest.fn();

  return {
    default: {
      existsSync,
      readFileSync,
    },
    existsSync,
    readFileSync,
  };
});

import NarrowNoteDialog from "../lib/narrow-note-dialog";

describe("NarrowNoteDialog", () => {
  it("open コマンドでノート一覧を表示する", async () => {
    const { registeredCommands, notes } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce({
        docs: [{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }],
      })
      .mockResolvedValueOnce({
        docs: [{ _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" }],
      })
      .mockResolvedValueOnce({
        docs: [{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }],
      });
    notes.findWithStatus.mockResolvedValue({ docs: [] });

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });

    expect(await screen.findByDisplayValue("")).toBeInTheDocument();
    expect(await screen.findByText("Alpha Note")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("2文字以上の検索で全ノートから絞り込む", async () => {
    jest.useFakeTimers();

    const { registeredCommands, notes } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce({
        docs: [{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }],
      })
      .mockResolvedValueOnce({
        docs: [{ _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" }],
      })
      .mockResolvedValueOnce({
        docs: [
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ],
      });
    notes.findWithStatus.mockResolvedValue({
      docs: [{ _id: "note-4", title: "Done Note", bookId: "book-1", status: "completed" }],
    });

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });

    const input = await screen.findByPlaceholderText("Select Note");
    fireEvent.change(input, { target: { value: "be" } });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText("Beta Note")).toBeInTheDocument();
    });
    expect(screen.queryByText("Alpha Note")).toBeNull();
    expect(screen.queryByText("Done Note")).toBeNull();
  });

  it("book モードでは別ブックのノートを除外する", async () => {
    jest.useFakeTimers();

    const { registeredCommands, notes } = createInkdropMock({
      books: [
        { _id: "book-1", name: "Inbox" },
        { _id: "book-2", name: "Archive" },
      ],
      currentBookId: "book-1",
    });
    notes.findInBook.mockResolvedValue({
      docs: [{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }],
    });
    notes.all
      .mockResolvedValueOnce({
        docs: [{ _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" }],
      })
      .mockResolvedValueOnce({
        docs: [
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Elsewhere", bookId: "book-2" },
        ],
      });
    notes.findWithStatus.mockResolvedValue({ docs: [] });

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:openOnlyInBook"]();
    });

    const input = await screen.findByPlaceholderText("Select Note");
    fireEvent.change(input, { target: { value: "beta" } });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText("No notes found")).toBeInTheDocument();
    });
  });

  it("Enter で選択中ノートを開く", async () => {
    jest.useFakeTimers();

    const { registeredCommands, notes, dispatch } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce({
        docs: [
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ],
      })
      .mockResolvedValueOnce({
        docs: [{ _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" }],
      })
      .mockResolvedValueOnce({
        docs: [
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ],
      });
    notes.findWithStatus.mockResolvedValue({ docs: [] });

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });

    const input = await screen.findByPlaceholderText("Select Note");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", preventDefault: jest.fn() });

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(dispatch).toHaveBeenCalledWith(document.body, "core:open-note", {
      noteId: "note-2",
      selectInNoteListBar: true,
    });
  });
});
