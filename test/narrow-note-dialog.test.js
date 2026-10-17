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

const queryResult = (docs) => ({ rows: docs.map((doc) => ({ doc })) });

describe("NarrowNoteDialog", () => {
  it("open コマンドでノート一覧を表示する", async () => {
    const { inkdrop, registeredCommands, notes } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce(
        queryResult([{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" },
        ])
      )
      .mockResolvedValueOnce(
        queryResult([{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }])
      );
    notes.findWithStatus.mockResolvedValue(queryResult([]));

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });

    expect(await screen.findByDisplayValue("")).toBeInTheDocument();
    expect(await screen.findByText("Alpha Note")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(inkdrop.components.getComponentClass).toHaveBeenCalledWith("Dialog");
    expect(notes.all).toHaveBeenNthCalledWith(1, {
      limit: 10,
      sort: [{ updatedAt: "desc" }],
      pinnedFirst: false,
    });
    expect(notes.all).toHaveBeenNthCalledWith(2, {
      limit: 1,
      sort: [{ createdAt: "desc" }],
      pinnedFirst: false,
    });
    expect(notes.all).toHaveBeenNthCalledWith(3, {
      limit: 2000,
      sort: [{ updatedAt: "desc" }],
      pinnedFirst: false,
    });
  });

  it("2文字以上の検索で全ノートから絞り込む", async () => {
    jest.useFakeTimers();

    const { registeredCommands, notes } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce(
        queryResult([{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" },
        ])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ])
      );
    notes.findWithStatus.mockResolvedValue(
      queryResult([
        {
          _id: "note-4",
          title: "Done Note",
          bookId: "book-1",
          status: "completed",
        },
      ])
    );

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
    notes.findInBook.mockResolvedValue(
      queryResult([{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }])
    );
    notes.all
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" },
        ])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Elsewhere", bookId: "book-2" },
        ])
      );
    notes.findWithStatus.mockResolvedValue(queryResult([]));

    render(<NarrowNoteDialog />);

    await act(async () => {
      registeredCommands["narrow-note:openOnlyInBook"]();
    });

    expect(notes.findInBook).toHaveBeenCalledWith("book-1", {
      limit: 10,
      sort: [{ updatedAt: "desc" }],
      pinnedFirst: false,
    });
    expect(screen.getByText("Alpha Note")).toBeInTheDocument();

    const input = await screen.findByPlaceholderText("Select Note");
    fireEvent.change(input, { target: { value: "beta" } });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(screen.getByText("No notes found")).toBeInTheDocument();
    });
  });

  it.each(["narrow-note:open", "narrow-note:openOnlyInBook"])(
    "%s で取得結果が空でも表示できる",
    async (command) => {
      const { registeredCommands, notes } = createInkdropMock();
      notes.all.mockResolvedValue(queryResult([]));
      notes.findInBook.mockResolvedValue(queryResult([]));
      notes.findWithStatus.mockResolvedValue(queryResult([]));

      render(<NarrowNoteDialog />);
      await act(async () => {
        registeredCommands[command]();
      });

      expect(screen.getByText("No notes found")).toBeInTheDocument();
      expect(notes.findWithStatus).toHaveBeenCalledTimes(1);
    }
  );

  it("完了ノートを検索対象に含め、更新日時順に表示する", async () => {
    jest.useFakeTimers();
    const { registeredCommands, notes } = createInkdropMock();
    notes.all.mockResolvedValue(
      queryResult([
        {
          _id: "note-1",
          title: "Match Active",
          bookId: "book-1",
          updatedAt: 1000,
        },
      ])
    );
    notes.findWithStatus.mockResolvedValue(
      queryResult([
        {
          _id: "note-2",
          title: "Match Done",
          bookId: "book-1",
          updatedAt: 2000,
          status: "completed",
        },
      ])
    );

    render(<NarrowNoteDialog />);
    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });
    fireEvent.change(screen.getByPlaceholderText("Select Note"), {
      target: { value: "match" },
    });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Match Done");
    expect(options[1]).toHaveTextContent("Match Active");
    expect(notes.findWithStatus).toHaveBeenCalledWith("completed", {
      limit: 2000,
      sort: [{ createdAt: "desc" }],
      pinnedFirst: false,
    });
  });

  it("最新作成ノートを取得後、同じノートなら検索キャッシュを再利用する", async () => {
    const { registeredCommands, notes } = createInkdropMock();
    notes.all.mockResolvedValue(
      queryResult([{ _id: "note-1", title: "Alpha Note", bookId: "book-1" }])
    );
    notes.findWithStatus.mockResolvedValue(queryResult([]));

    render(<NarrowNoteDialog />);
    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });
    expect(notes.all).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(screen.getByPlaceholderText("Select Note"), {
      key: "Escape",
    });
    await act(async () => {
      registeredCommands["narrow-note:open"]();
    });

    expect(screen.getByText("Alpha Note")).toBeInTheDocument();
    expect(notes.all).toHaveBeenCalledTimes(5);
    expect(notes.findWithStatus).toHaveBeenCalledTimes(1);
  });

  it("Enter で選択中ノートを開く", async () => {
    jest.useFakeTimers();

    const { registeredCommands, notes, dispatch } = createInkdropMock();
    notes.all
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-3", title: "Gamma Note", createdAt: "2025-01-01" },
        ])
      )
      .mockResolvedValueOnce(
        queryResult([
          { _id: "note-1", title: "Alpha Note", bookId: "book-1" },
          { _id: "note-2", title: "Beta Note", bookId: "book-1" },
        ])
      );
    notes.findWithStatus.mockResolvedValue(queryResult([]));

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
