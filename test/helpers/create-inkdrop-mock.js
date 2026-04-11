import React from "react";

function Dialog({ children, visible, className, onBackdropClick }) {
  if (!visible) {
    return null;
  }

  return (
    <div className={className} data-testid="dialog" onClick={onBackdropClick}>
      {children}
    </div>
  );
}

Dialog.Content = function DialogContent({ children }) {
  return <div>{children}</div>;
};

export function createInkdropMock({
  books = [{ _id: "book-1", name: "Inbox" }],
  currentBookId = "book-1",
} = {}) {
  const registeredCommands = {};
  const add = jest.fn((element, commands) => {
    Object.assign(registeredCommands, commands);
    return { dispose: jest.fn() };
  });
  const dispatch = jest.fn();

  const notes = {
    all: jest.fn(),
    findInBook: jest.fn(),
    findWithStatus: jest.fn(),
  };

  const inkdrop = {
    commands: {
      add,
      dispatch,
    },
    components: {
      classes: {
        Dialog,
      },
      registerClass: jest.fn(),
      deleteClass: jest.fn(),
    },
    config: {
      get: jest.fn((key) => {
        switch (key) {
          case "narrow-note.migemoDictPath":
            return "";
          case "narrow-note.defaultDisplayNumber":
            return 10;
          case "narrow-note.limit":
            return 2000;
          default:
            return undefined;
        }
      }),
    },
    layouts: {
      addComponentToLayout: jest.fn(),
      removeComponentFromLayout: jest.fn(),
    },
    localDB: {
      notes,
    },
    store: {
      getState: jest.fn(() => ({
        books: { all: books },
        sidebar: { workspace: { bookId: currentBookId } },
        queryContext: {},
        editingNote: {},
      })),
    },
  };

  globalThis.inkdrop = inkdrop;

  return {
    inkdrop,
    registeredCommands,
    notes,
    dispatch,
  };
}
