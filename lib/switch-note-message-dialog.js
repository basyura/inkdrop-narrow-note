"use babel";

import React, { useState, useEffect } from "react";
import { Dropdown } from "semantic-ui-react";
import CustomDropdownItem from "./dropdown";
import migemo from "jsmigemo";
import fs from "fs";
import { useModal } from "inkdrop";

const SwitchNoteMessageDialog = (_) => {
  const { Dialog } = inkdrop.components.classes;

  const modal = useModal();
  const [options, setOptions] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [lastCreatedNoteId, setLastCreatedNoteId] = useState("");
  let filteredNotes = [];
  let jsm = null;
  // const builder = new NoteBuilder();

  const dictPath = inkdrop.config.get("switch-note.migemoDictPath");
  if (dictPath != "" && fs.existsSync(dictPath)) {
    const buf = fs.readFileSync(dictPath);
    const dict = new migemo.CompactDictionary(buf.buffer);
    jsm = new migemo.Migemo();
    jsm.setDict(dict);
  } else {
    console.log("not found : " + dictPath);
  }
  /*
   *
   */
  const open = () => {
    filteredNotes = [];
    const db = inkdrop.main.dataStore.getLocalDB();
    const notebookPaths = buildNotebookPaths(inkdrop.store.getState().books.all);
    // 直近の変更したノートだけを表示する
    db.notes.all({ limit: 5, sort: [{ updatedAt: "desc" }] }).then((notes) => {
      const options = notes.docs.map(({ _id, title, bookId, updatedAt }) => ({
        key: _id,
        value: { note: _id, book: bookId },
        text: title === "" ? "[Untitled Note]" : title,
        book: pathToString(notebookPaths[bookId]),
        updatedAt,
        path: notebookPaths[bookId],
      }));
      setOptions(options);
    });

    // 新規ノートを作成していない場合は取り直さない
    db.notes.all({ limit: 1, sort: [{ createdAt: "desc" }] }).then((notes) => {
      const doc = notes.docs[0];
      if (lastCreatedNoteId == doc._id) {
        return;
      }
      setLastCreatedNoteId(doc._id);

      // 取り直す
      db.notes.all({ limit: 2000, sort: [{ updatedAt: "desc" }] }).then((notes) => {
        const options = notes.docs.map(({ _id, title, bookId, updatedAt }) => ({
          key: _id,
          value: { note: _id, book: bookId },
          text: title === "" ? "[Untitled Note]" : title,
          book: pathToString(notebookPaths[bookId]),
          updatedAt,
          path: notebookPaths[bookId],
        }));
        setAllNotes(options);
      });
    });

    // set menu's height
    const height = document.querySelector(".editor").clientHeight;
    document.documentElement.style.setProperty(
      "--switch-note-menu-height",
      (height - 100).toString(10) + "px"
    );
    document.documentElement.style.setProperty(
      "--switch-note-dialog-margin-top",
      (-1 * height + 100).toString(10) + "px"
    );

    modal.show();
  };
  /*
   *
   */
  useEffect(() => {
    const sub = inkdrop.commands.add(document.body, {
      "switch-note:open": () => open(),
    });
    return () => sub.dispose();
  }, [open]);
  /*
   *
   */
  useEffect(() => {
    // check state
    if (!modal.state.visible) {
      return;
    }

    // how to focus? wait for ui
    setTimeout(() => {
      const ele = document.querySelector(".switch-note-dropdown input");
      if (ele != null) {
        ele.focus();
      }
    }, 100);
  });
  /*
   *
   */
  const close = () => {
    modal.close();
    invoke("editor:focus");
  };
  /*
   *
   */
  const handleKeyDown = (ev) => {
    const nev = ev.nativeEvent;

    if (nev.key == "Escape") {
      close();
    }

    if (!nev.ctrlKey) {
      return;
    }
    // delete word (clear)
    if (nev.key == "w") {
      nev.srcElement.value = "";
      filteredNotes = [];
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
    }
  };
  /*
   *
   */
  const handleOnChange = (_, data) => {
    close();
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
  const searchNotes = (_, query) => {
    if (query.length < 2) {
      return [];
    }

    let targets = filteredNotes;
    if (targets.length == 0) {
      targets = allNotes;
    }

    query = query.toLowerCase();
    // use migemo
    if (jsm != null) {
      let queries = query.split("|");
      for (let i = 0; i < queries.length; i++) {
        const regex = new RegExp(jsm.query(queries[i]));
        targets = targets.filter((option) => {
          const text = option.text.toLowerCase();
          if (regex.test(text)) {
            return true;
          }
        });
      }
    } else {
      targets = targets.filter((option) => option.text.toLowerCase().includes(query));
    }

    filteredNotes = targets;

    // 検索結果を CustomDropdownItem 形式に変換
    return filteredNotes.map((option) => ({
      key: option.key,
      value: option.value,
      text: option.text,
      content: <CustomDropdownItem text={option.text} description={option.book} />, // CustomDropdownItem を使用
    }));
  };

  const pathToString = (path) => {
    return path[0];
    /*
    if (path.length > 3) {
      // Truncate long ptahs with a ... in the middle
      path = [path[0], path[1], "...", path[path.length - 1]];
    }

    return path.slice().reverse().join(" > ");
    */
  };

  const buildNotebookPaths = (notebooks) => {
    const lookup = {};
    const tree = {};

    // Build a quick lookup to make finding book details easier.
    notebooks.forEach((notebook) => {
      lookup[notebook._id] = notebook;
    });

    Object.keys(lookup).map((key) => {
      let book = lookup[key];

      // The book for which this note is directly conained in
      let path = [book.name];

      // Build a reverse path of each parent book until we reach the root
      while (book.parentBookId) {
        const oldBook = book;
        book = lookup[book.parentBookId];

        if (book === undefined) {
          console.log({ book, oldBook, lookup, notebooks });
        }

        path.push(book.name);
      }

      tree[key] = path;
    });

    return tree;
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

  return (
    <Dialog {...modal.state} onBackdropClick={close} hiding={false} className="switch-note-dialog">
      <Dialog.Content>
        <Dropdown
          className="switch-note-dropdown"
          placeholder="Select Note"
          selectOnNavigation={false}
          onChange={handleOnChange}
          search={searchNotes}
          searchInput={
            <Dropdown.SearchInput className="ui input" onKeyDown={handleKeyDown.bind(this)} />
          }
          options={options.map((option) => ({
            key: option.key,
            value: option.value,
            content: <CustomDropdownItem text={option.text} description={option.book} />,
          }))}
          fluid
          selection
        />
      </Dialog.Content>
    </Dialog>
  );
};

export default SwitchNoteMessageDialog;
