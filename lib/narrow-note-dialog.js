"use babel";

import React, { useState, useEffect } from "react";
import { Dropdown } from "semantic-ui-react";
import CustomDropdownItem from "./dropdown";
import migemo from "jsmigemo";
import fs from "fs";
import { useModal } from "inkdrop";

const NarrowNoteDialog = (_) => {
  const { Dialog } = inkdrop.components.classes;

  const modal_ = useModal();
  const [options_, setOptions] = useState([]);
  const [allNotes_, setAllNotes] = useState([]);
  const [lastCreatedNoteId_, setLastCreatedNoteId] = useState("");

  let filteredNotes_ = [];
  let jsm_ = null;

  const dictPath = inkdrop.config.get("narrow-note.migemoDictPath");
  if (dictPath != "" && fs.existsSync(dictPath)) {
    const buf = fs.readFileSync(dictPath);
    const dict = new migemo.CompactDictionary(buf.buffer);
    jsm_ = new migemo.Migemo();
    jsm_.setDict(dict);
  }
  /*
   *
   */
  const open = () => {
    filteredNotes_ = [];
    const bookMap = buildBookMap();
    const db = inkdrop.main.dataStore.getLocalDB();
    // 直近の変更したノートだけを表示する
    db.notes.all({ limit: 5, sort: [{ updatedAt: "desc" }] }).then((notes) => {
      const options = notes.docs.map(({ _id, title, bookId, updatedAt }) => ({
        key: _id,
        value: { note: _id, book: bookId },
        text: title === "" ? "[Untitled Note]" : title,
        book: bookMap[bookId],
        updatedAt,
      }));
      setOptions(options);
    });

    // 新規ノートを作成していない場合は取り直さない
    db.notes.all({ limit: 1, sort: [{ createdAt: "desc" }] }).then((notes) => {
      const doc = notes.docs[0];
      if (lastCreatedNoteId_ == doc._id) {
        return;
      }
      setLastCreatedNoteId(doc._id);

      // 取り直す
      db.notes.all({ limit: 2000, sort: [{ updatedAt: "desc" }] }).then((notes) => {
        const options = notes.docs.map(({ _id, title, bookId, updatedAt }) => ({
          key: _id,
          value: { note: _id, book: bookId },
          text: title === "" ? "[Untitled Note]" : title,
          book: bookMap[bookId],
          updatedAt,
        }));
        setAllNotes(options);
      });
    });

    // set menu's height
    const height = document.querySelector(".editor").clientHeight;
    document.documentElement.style.setProperty(
      "--narrow-note-menu-height",
      (height - 100).toString(10) + "px"
    );
    document.documentElement.style.setProperty(
      "--narrow-note-dialog-margin-top",
      (-1 * height + 100).toString(10) + "px"
    );

    modal_.show();
  };
  /*
   *
   */
  useEffect(() => {
    const sub = inkdrop.commands.add(document.body, {
      "narrow-note:open": () => open(),
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

    // how to focus? wait for ui
    setTimeout(() => {
      const ele = document.querySelector(".narrow-note-dropdown input");
      if (ele != null) {
        ele.focus();
      }
    }, 100);
  });
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

    if (nev.key == "Escape") {
      close();
      return;
    }

    // input space
    if (nev.keyCode == 32) {
      ev.stopPropagation();
      return;
    }

    if (!nev.ctrlKey) {
      return;
    }
    // delete word (clear)
    if (nev.key == "w") {
      nev.srcElement.value = "";
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

    let targets = filteredNotes_;
    if (targets.length == 0) {
      targets = allNotes_;
    }

    query = query.toLowerCase();
    // use migemo
    if (jsm_ != null) {
      let queries = query.split(" ");
      for (let i = 0; i < queries.length; i++) {
        const regex = new RegExp(jsm_.query(queries[i]));
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

    filteredNotes_ = targets;

    // 検索結果を CustomDropdownItem 形式に変換
    return filteredNotes_.map((option) => ({
      key: option.key,
      value: option.value,
      text: option.text,
      content: <CustomDropdownItem text={option.text} description={option.book} />,
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

  return (
    <Dialog {...modal_.state} onBackdropClick={close} hiding={false} className="narrow-note-dialog">
      <Dialog.Content>
        <Dropdown
          className="narrow-note-dropdown"
          placeholder="Select Note"
          selectOnNavigation={false}
          onChange={handleOnChange}
          search={searchNotes}
          searchInput={
            <Dropdown.SearchInput
              className="ui input"
              onKeyDown={handleKeyDown.bind(this)}
              spellCheck="false"
            />
          }
          options={options_.map((option) => ({
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

export default NarrowNoteDialog;
