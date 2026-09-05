"use babel";

import React, { startTransition, useEffect, useRef, useState } from "react";
import CustomDropdownItem from "./dropdown";
import migemo from "jsmigemo";
import fs from "fs";
import { useModal } from "inkdrop";

class DummyJsm {
  query = (q) => q;
}

const NarrowNoteDialog = (_) => {
  const { Dialog } = inkdrop.components.classes;

  const modal_ = useModal();
  const inputRef_ = useRef(null);
  const activeItemRef_ = useRef(null);
  const isClosingRef_ = useRef(false);
  const openRef_ = useRef(null);
  const [options_, setOptions] = useState([]);
  const [allNotes_, setAllNotes] = useState([]);
  const [lastCreatedNoteId_, setLastCreatedNoteId] = useState("");
  const [mode_, setMode] = useState("");
  const [jsm_, setJsm] = useState(null);
  const [query_, setQuery] = useState("");
  const [debouncedQuery_, setDebouncedQuery] = useState("");
  const [activeIndex_, setActiveIndex] = useState(-1);
  const [filteredOptions_, setFilteredOptions] = useState([]);

  const ensureActiveItemVisible = () => {
    if (
      activeItemRef_.current != null &&
      typeof activeItemRef_.current.scrollIntoView === "function"
    ) {
      activeItemRef_.current.scrollIntoView({ block: "nearest" });
    }
  };

  const open = (mode) => {
    setMode(mode);
    setQuery("");
    setDebouncedQuery("");
    setActiveIndex(-1);
    isClosingRef_.current = false;

    if (jsm_ == null) {
      const dictPath = inkdrop.config.get("narrow-note.migemoDictPath");
      if (dictPath != "" && fs.existsSync(dictPath)) {
        try {
          const buf = fs.readFileSync(dictPath);
          const dict = new migemo.CompactDictionary(buf.buffer);
          const jsm = new migemo.Migemo();
          jsm.setDict(dict);
          setJsm(jsm);
        } catch (error) {
          console.error("Failed to read migemo dictionary:", error);
          setJsm(new DummyJsm());
        }
      } else {
        setJsm(new DummyJsm());
      }
    }

    buildNotes(mode);

    const editor = document.querySelector(".editor");
    const height = editor?.clientHeight ?? window.innerHeight;
    document.documentElement.style.setProperty(
      "--narrow-note-menu-height",
      (height - 200).toString(10) + "px"
    );
    modal_.show();
  };

  const buildBookMap = () => {
    const books = inkdrop.store.getState().books.all;

    const bookMap = {};
    books.forEach((notebook) => {
      bookMap[notebook._id] = notebook.name;
    });

    return bookMap;
  };

  const getCurrentBookId = () => {
    const state = inkdrop.store.getState();
    return (
      state.sidebar?.workspace?.bookId ||
      state.queryContext?.bookId ||
      state.editingNote?.bookId ||
      ""
    );
  };

  const buildNotes = async (mode) => {
    const bookMap = buildBookMap();
    const db = inkdrop.localDB;
    const currentBookId = getCurrentBookId();

    const count = inkdrop.config.get("narrow-note.defaultDisplayNumber");
    const params = { limit: count, sort: [{ updatedAt: "desc" }] };

    let initialNotes = [];
    if (mode == "book") {
      initialNotes = await db.notes.findInBook(currentBookId, params);
    } else {
      initialNotes = await db.notes.all(params);
    }

    setOptions(
      initialNotes.docs.map(({ _id, title, bookId, updatedAt, status }) => {
        const text = title === "" ? "[Untitled Note]" : title;
        return {
          key: _id,
          value: { note: _id, book: bookId },
          text,
          lowerText: text.toLowerCase(),
          book: bookMap[bookId],
          bookId,
          updatedAt,
          status,
        };
      })
    );

    const latest = await inkdrop.localDB.notes.searchWithQuery(
      [
        {
          type: "field",
          field: "pinned",
          id: ["true", "false"],
        },
      ],
      { sort: [{ createdAt: "desc" }], limit: 1 }
    )[0];

    if (latest != null && lastCreatedNoteId_ == latest._id) {
      return;
    }
    if (latest != null) {
      setLastCreatedNoteId(latest._id);
    }

    const limit = inkdrop.config.get("narrow-note.limit");
    const notes = await db.notes.all({ limit, sort: [{ updatedAt: "desc" }] });
    const completes = await db.notes.findWithStatus("completed", {
      limit,
      sort: [{ createdAt: "desc" }],
    });

    const getUpdatedAtForSort = ({ updatedAt }) => {
      if (!updatedAt) return "";
      if (typeof updatedAt === "string") return updatedAt;
      if (typeof updatedAt.toISOString === "function") {
        return updatedAt.toISOString();
      }
      return String(updatedAt);
    };

    const all = notes.docs
      .concat(completes.docs)
      .sort((a, b) =>
        getUpdatedAtForSort(b).localeCompare(getUpdatedAtForSort(a))
      );
    const options = all.map(({ _id, title, bookId, updatedAt, status }) => {
      const text = title === "" ? "[Untitled Note]" : title;
      return {
        key: _id,
        value: { note: _id, book: bookId },
        text,
        lowerText: text.toLowerCase(),
        book: bookMap[bookId],
        bookId,
        updatedAt,
        status,
      };
    });
    options.push({
      key: "narrow-note:cmd.rebuild",
      value: "narrow-note:cmd.rebuild",
      text: "🔧 cmd.rebuild",
      lowerText: "🔧 cmd.rebuild".toLowerCase(),
      book: "narrow-note",
      status: "none",
    });
    setAllNotes(options);
  };

  const buildFilteredOptions = () => {
    if (debouncedQuery_.length < 2) {
      return options_;
    }

    const currentBookId = getCurrentBookId();
    const normalizedQuery = debouncedQuery_.toLowerCase();
    const queries = normalizedQuery.split(" ").filter(Boolean);
    const jsm = jsm_ ?? new DummyJsm();
    const regexes = queries.map((query) => new RegExp(jsm.query(query)));

    return allNotes_.filter((option) => {
      if (mode_ == "book" && option.bookId != currentBookId) {
        return false;
      }

      const text = option.lowerText ?? option.text.toLowerCase();
      return regexes.every((regex) => regex.test(text));
    });
  };

  const invoke = (cmd, param, ele) => {
    if (ele == null) {
      ele = document.body;
    }
    if (param == null) {
      param = {};
    }
    inkdrop.commands.dispatch(ele, cmd, param);
  };

  const close = () => {
    modal_.close();
    invoke("editor:focus");
  };

  const selectOption = (option) => {
    if (option == null || isClosingRef_.current) {
      return;
    }

    isClosingRef_.current = true;
    close();

    if (option.value == "narrow-note:cmd.rebuild") {
      setLastCreatedNoteId("");
      return;
    }

    setTimeout(() => {
      inkdrop.commands.dispatch(document.body, "core:open-note", {
        noteId: option.value.note,
        selectInNoteListBar: true,
      });
      setTimeout(() => {
        inkdrop.commands.dispatch(document.body, "editor:focus");
      }, 100);
    }, 100);
  };

  openRef_.current = open;

  const handleKeyDown = (ev) => {
    const { key, code, ctrlKey, nativeEvent } = ev;
    const keyCode = nativeEvent?.keyCode;
    const isCtrlN =
      ctrlKey &&
      (key === "n" || key === "N" || code === "KeyN" || keyCode === 78);
    const isCtrlP =
      ctrlKey &&
      (key === "p" || key === "P" || code === "KeyP" || keyCode === 80);

    if (key === "Escape") {
      ev.preventDefault();
      close();
      return;
    }

    if (key === " ") {
      ev.stopPropagation();
      return;
    }

    if (ctrlKey && key === "w") {
      ev.preventDefault();
      setQuery("");
      return;
    }

    if (ctrlKey && key === "h") {
      ev.preventDefault();
      setQuery((current) => current.slice(0, -1));
      return;
    }

    if (key === "ArrowDown" || isCtrlN) {
      ev.preventDefault();
      ev.stopPropagation();
      setActiveIndex((current) => {
        if (filteredOptions_.length === 0) {
          return -1;
        }
        return Math.min(current + 1, filteredOptions_.length - 1);
      });
      return;
    }

    if (key === "ArrowUp" || isCtrlP) {
      ev.preventDefault();
      ev.stopPropagation();
      setActiveIndex((current) => {
        if (filteredOptions_.length === 0) {
          return -1;
        }
        if (current < 0) {
          return 0;
        }
        return Math.max(current - 1, 0);
      });
      return;
    }

    if (key === "Enter") {
      ev.preventDefault();
      selectOption(filteredOptions_[activeIndex_]);
    }
  };

  useEffect(() => {
    const sub = inkdrop.commands.add(document.body, {
      "narrow-note:open": () => openRef_.current?.("all"),
      "narrow-note:openOnlyInBook": () => openRef_.current?.("book"),
    });
    return () => sub.dispose();
  }, []);

  useEffect(() => {
    if (!modal_.state.visible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (inputRef_.current != null) {
        inputRef_.current.focus();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [modal_.state.visible]);

  useEffect(() => {
    if (!modal_.state.visible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query_);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [modal_.state.visible, query_]);

  useEffect(() => {
    if (!modal_.state.visible) {
      return;
    }

    startTransition(() => {
      setFilteredOptions(buildFilteredOptions());
    });
  }, [modal_.state.visible, debouncedQuery_, options_, allNotes_, mode_, jsm_]);

  useEffect(() => {
    if (!modal_.state.visible) {
      return;
    }

    if (filteredOptions_.length === 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((current) => {
      if (current < 0) {
        return 0;
      }
      return Math.min(current, filteredOptions_.length - 1);
    });
  }, [modal_.state.visible, filteredOptions_]);

  useEffect(() => {
    if (!modal_.state.visible || activeIndex_ < 0) {
      return;
    }

    const timeoutId = setTimeout(ensureActiveItemVisible, 0);
    return () => clearTimeout(timeoutId);
  }, [modal_.state.visible, activeIndex_, filteredOptions_]);

  return (
    <Dialog
      {...modal_.state}
      onBackdropClick={close}
      hiding={false}
      className="narrow-note-dialog"
    >
      <Dialog.Content>
        <div className="narrow-note-dropdown">
          <input
            ref={inputRef_}
            className="narrow-note-search-input native-key-bindings"
            type="text"
            value={query_}
            onChange={(event) => {
              isClosingRef_.current = false;
              setQuery(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Select Note"
            spellCheck="false"
          />
          <div className="narrow-note-menu" role="listbox">
            {filteredOptions_.length > 0 ? (
              filteredOptions_.map((option, index) => (
                <div
                  key={option.key}
                  ref={index === activeIndex_ ? activeItemRef_ : null}
                  className={
                    index === activeIndex_
                      ? "narrow-note-item active"
                      : "narrow-note-item"
                  }
                  role="option"
                  aria-selected={index === activeIndex_}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <CustomDropdownItem
                    text={option.text}
                    book={option.book}
                    status={option.status}
                  />
                </div>
              ))
            ) : (
              <div className="narrow-note-empty">No notes found</div>
            )}
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};

export default NarrowNoteDialog;
