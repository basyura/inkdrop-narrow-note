"use babel";

import React, { useState, useEffect, useRef } from "react";
import { Dropdown } from "semantic-ui-react";
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
  const dropdownRef_ = useRef(null);
  const [options_, setOptions] = useState([]);
  const [allNotes_, setAllNotes] = useState([]);
  const [lastCreatedNoteId_, setLastCreatedNoteId] = useState("");
  const [mode_, setMode] = useState("");
  const [jsm_, setJsm] = useState(null);

  let isClosing_ = false;
  let filteredNotes_ = [];
  /*
   *
   */
  const ensureActiveItemVisible = () => {
    const menu = document.querySelector(".narrow-note-dropdown .menu.visible");
    if (menu == null) {
      return;
    }
    const selected = menu.querySelector(".selected.item");
    if (selected != null && typeof selected.scrollIntoView === "function") {
      selected.scrollIntoView({ block: "nearest" });
    }
  };
  /*
   *
   */
  const open = (mode) => {
    setMode(mode);
    // generate jsm
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

    // set menu's height
    const height = document.querySelector(".editor").clientHeight;
    document.documentElement.style.setProperty(
      "--narrow-note-menu-height",
      (height - 200).toString(10) + "px"
    );
    document.documentElement.style.setProperty(
      "--narrow-note-dialog-margin-top",
      (-1 * height + 200).toString(10) + "px"
    );

    modal_.show();
  };
  /*
   *
   */
  const buildNotes = async (mode) => {
    filteredNotes_ = [];
    const bookMap = buildBookMap();
    const db = inkdrop.main.dataStore.getLocalDB();
    // 直近の変更したノートだけを設定値だけ表示する

    const { editingNote } = inkdrop.store.getState();
    const currentBookId = editingNote?.bookId;

    const count = inkdrop.config.get("narrow-note.defaultDisplayNumber");

    const params = { limit: count, sort: [{ updatedAt: "desc" }] };

    let initialNotes = [];
    if (mode == "book") {
      initialNotes = await db.notes.findInBook(currentBookId, params);
    } else {
      initialNotes = await db.notes.all(params);
    }

    setOptions(
      initialNotes.docs.map(({ _id, title, bookId, updatedAt, status }) => ({
        key: _id,
        value: { note: _id, book: bookId },
        text: title === "" ? "[Untitled Note]" : title,
        book: bookMap[bookId],
        bookId,
        updatedAt,
        status,
      }))
    );

    // 新規ノートを作成していない場合は取り直さない
    const latests = await db.notes.all({ limit: 1, sort: [{ createdAt: "desc" }] });
    const doc = latests.docs[0];
    if (lastCreatedNoteId_ == doc._id) {
      return;
    }
    setLastCreatedNoteId(doc._id);

    // 取り直す
    const limit = inkdrop.config.get("narrow-note.limit");
    const notes = await db.notes.all({ limit, sort: [{ updatedAt: "desc" }] });
    const completes = await db.notes.findWithStatus("completed", {
      limit,
      sort: [{ createdAt: "desc" }],
    });

    const getUpdatedAtForSort = ({ updatedAt }) => {
      if (!updatedAt) return "";
      if (typeof updatedAt === "string") return updatedAt;
      if (typeof updatedAt.toISOString === "function") return updatedAt.toISOString();
      return String(updatedAt);
    };

    const all = notes.docs
      .concat(completes.docs)
      .sort((a, b) => getUpdatedAtForSort(b).localeCompare(getUpdatedAtForSort(a)));
    const options = all.map(({ _id, title, bookId, updatedAt, status }) => ({
      key: _id,
      value: { note: _id, book: bookId },
      text: title === "" ? "[Untitled Note]" : title,
      book: bookMap[bookId],
      bookId,
      updatedAt,
      status,
    }));
    options.push({
      key: "narrow-note:cmd.rebuild",
      value: "narrow-note:cmd.rebuild",
      text: "🔧 cmd.rebuild",
      book: "narrow-note",
      status: "none",
    });
    setAllNotes(options);
  };
  /*
   *
   */
  useEffect(() => {
    const sub = inkdrop.commands.add(document.body, {
      "narrow-note:open": () => open("all"),
      "narrow-note:openOnlyInBook": () => open("book"),
    });
    return () => sub.dispose();
  }, [open]);
  /*
   *
   */
  useEffect(() => {
    // check state
    if (!modal_.state.visible) {
      return;
    }

    const handleMouseDown = (e) => e.preventDefault();

    // to avoid invoke handleOnChange - add immediately
    const dialog = document.querySelector(".narrow-note-dialog");
    if (dialog) {
      dialog.addEventListener("mousedown", handleMouseDown, true);
    }

    // how to focus? wait for ui
    const timeoutId = setTimeout(() => {
      const ele = document.querySelector(".narrow-note-dropdown input");
      if (ele != null) {
        ele.focus();
      }
    }, 100);

    // return cleanup function for useEffect
    return () => {
      clearTimeout(timeoutId);
      if (dialog) {
        dialog.removeEventListener("mousedown", handleMouseDown, true);
      }
    };
  }, [modal_.state.visible]);
  /*
   *
   */
  const close = () => {
    modal_.close();
    invoke("editor:focus");
  };
  /*
   *
   */
  const handleKeyDown = (ev) => {
    const nev = ev.nativeEvent;

    if (
      nev.key === "ArrowDown" ||
      nev.key === "ArrowUp" ||
      nev.keyCode === 40 ||
      nev.keyCode === 38
    ) {
      setTimeout(ensureActiveItemVisible, 0);
      return;
    }

    if (nev.key == "Escape") {
      close();
      return;
    }

    // input space
    if (nev.keyCode == 32) {
      ev.stopPropagation();
      return;
    }

    // delete single char
    if ((nev.ctrlKey && nev.key == "h") || nev.key == "Backspace") {
      filteredNotes_ = [];
      return;
    }

    if (!nev.ctrlKey) {
      return;
    }

    // delete word (clear)
    if (nev.key == "w") {
      dropdownRef_.current.clearSearchQuery();
      filteredNotes_ = [];
      return;
    }

    let first = -1;
    // check keyCode
    if (nev.key == "n") {
      first = 40;
    } else if (nev.key == "p") {
      first = 38;
    }
    // fire
    if (first > 0) {
      document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: first }));
      nev.cancelBubble = true;
      nev.preventDefault();
      setTimeout(ensureActiveItemVisible, 0);
    }
  };
  /*
   *
   */
  const handleOnChange = (_, data) => {
    if (isClosing_) {
      return;
    }
    isClosing_ = true;
    close();

    if (data.value == "narrow-note:cmd.rebuild") {
      setLastCreatedNoteId("");
      return;
    }

    setTimeout(() => {
      inkdrop.commands.dispatch(document.body, "core:open-note", {
        noteId: data.value.note,
        selectInNoteListBar: true,
      });
      setTimeout(() => {
        inkdrop.commands.dispatch(document.body, "editor:focus");
      }, 100);
    }, 100);
  };
  /*
   *
   */
  const searchNotes = (options, query) => {
    if (query.length < 2) {
      return options;
    }

    let targets = filteredNotes_;
    if (targets.length == 0) {
      targets = allNotes_;
    }

    const { editingNote } = inkdrop.store.getState();
    const currentBookId = editingNote?.bookId;

    query = query.toLowerCase();
    // match multi words
    let queries = query.split(" ");
    for (let i = 0; i < queries.length; i++) {
      const regex = new RegExp(jsm_.query(queries[i]));
      targets = targets.filter((option) => {
        // check bookId
        if (mode_ == "book" && option.bookId != currentBookId) {
          return false;
        }

        // check title
        const text = option.text.toLowerCase();
        if (regex.test(text)) {
          return true;
        }
      });
    }

    filteredNotes_ = targets;

    // 検索結果を CustomDropdownItem 形式に変換
    return filteredNotes_.map((option) => ({
      key: option.key,
      value: option.value,
      text: option.text,
      content: <CustomDropdownItem text={option.text} book={option.book} status={option.status} />,
    }));
  };

  const buildBookMap = () => {
    const books = inkdrop.store.getState().books.all;

    const bookMap = {};
    books.forEach((notebook) => {
      bookMap[notebook._id] = notebook.name;
    });

    return bookMap;
  };
  /*
   *
   */
  const invoke = (cmd, param, ele) => {
    if (ele == null) {
      ele = document.body;
    }
    if (param == null) {
      param = {};
    }
    inkdrop.commands.dispatch(ele, cmd, param);
  };
  /*
   *
   */
  return (
    <Dialog {...modal_.state} onBackdropClick={close} hiding={false} className="narrow-note-dialog">
      <Dialog.Content>
        <Dropdown
          ref={dropdownRef_}
          className="narrow-note-dropdown"
          placeholder="Select Note"
          selectOnNavigation={false}
          onChange={handleOnChange}
          search={searchNotes}
          searchInput={
            <Dropdown.SearchInput
              className="ui input"
              onKeyDown={handleKeyDown}
              spellCheck="false"
            />
          }
          options={options_.map((option) => ({
            key: option.key,
            value: option.value,
            content: <CustomDropdownItem text={option.text} book={option.book} />,
          }))}
          fluid
          selection
        />
      </Dialog.Content>
    </Dialog>
  );
};

export default NarrowNoteDialog;
