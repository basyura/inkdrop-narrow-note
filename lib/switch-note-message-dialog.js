"use babel";

import { CompositeDisposable } from "event-kit";
import { Dropdown } from "semantic-ui-react";
import { NoteBuilder } from "./note-builder";
import migemo from "jsmigemo";
import fs from "fs";

class CustomDropdownItem extends React.Component {
  render() {
    const { text, description } = this.props;
    return (
      <div className="custom-dropdown-item ">
        <span className="description">{description}</span>
        <span className="splitter"> - </span>
        <span>{text}</span>
      </div>
    );
  }
}

export default class SwitchNoteMessageDialog extends React.Component {
  /*
   *
   */
  constructor(props) {
    super(props);
    this.state = { options: [], dictionaryHash: 0 };
    this.builder = new NoteBuilder();

    const dictPath = inkdrop.config.get("switch-note.migemoDictPath");
    if (dictPath != "") {
      const buf = fs.readFileSync(dictPath);
      const dict = new migemo.CompactDictionary(buf.buffer);
      const jsm = new migemo.Migemo();
      jsm.setDict(dict);
      this.jsm = jsm;
    }
  }
  /*
   *
   */
  componentWillMount() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      inkdrop.commands.add(document.body, {
        "switch-note:open": () => this.open(),
      })
    );
  }
  /*
   *
   */
  componentWillUnmount() {
    this.subscriptions.dispose();
  }
  /*
   *
   */
  render() {
    const { MessageDialog } = inkdrop.components.classes;

    const count = this.state.options != null ? this.state.options.length : 0;
    let title = "Open Note";
    if (count > 0) {
      title += ` (${count})`;
    }

    return (
      <MessageDialog
        ref="dialog"
        title={title}
        buttons={[]}
        modalSettings={{ autofocus: true, duration: 0, transition: "fade" }}
        onDismiss={() => {
          inkdrop.commands.dispatch(document.body, "editor:focus");
        }}
      >
        <Dropdown
          ref="dropdown"
          placeholder="Select Note"
          onChange={this.switchNote}
          search={this.searchNotes}
          searchInput={
            <Dropdown.SearchInput className="ui input" onKeyDown={this.handleKeyDown.bind(this)} />
          }
          selectOnNavigation={false}
          fluid
          selection
          // search
          options={this.state.options.map((option) => ({
            key: option.key,
            value: option.value,
            content: <CustomDropdownItem text={option.text} description={option.book} />,
          }))}
        />
      </MessageDialog>
    );
  }
  /*
   *
   */
  open() {
    this.builder.build(this.state, (v) => {
      let { options, copied, dictionaryHash } = v;
      let all = options;
      let currentId = inkdrop.getActiveEditor().props.noteId;
      // 開いているノートを除いて直近に編集した n 個だけをデフォルト表示対象とする
      let latests = [];
      for (let i = 0, max = options.length; i < max; i++) {
        let opt = options[i];
        if (currentId != opt.value.note) {
          latests.push(opt);
        }
        if (latests.length >= 20) {
          break;
        }
      }

      options = latests.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

      this.refs.dropdown.setSelectedIndex(0);
      this.setState({ all, options, copied, dictionaryHash });
    });
    this.refs.dialog.showDialog();
  }
  /*
   *
   */
  searchNotes = (_options, query) => {
    // Lowercase the query to make searching easier.
    if (this.state.all == null) {
      return [];
    }

    query = query.toLowerCase();
    let filteredOptions;
    // use migemo
    if (this.jsm != null) {
      let queries = query.split(" ");
      let targets = this.state.all;
      for (let i = 0; i < queries.length; i++) {
        const regex = new RegExp(this.jsm.query(queries[i]));
        targets = targets.filter((option) => {
          const text = option.text.toLowerCase();
          if (regex.test(text)) {
            return true;
          }
        });
      }
      filteredOptions = targets;
    } else {
      filteredOptions = this.state.all.filter((option) =>
        option.text.toLowerCase().includes(query)
      );
    }
    // 検索結果を CustomDropdownItem 形式に変換
    return filteredOptions.map((option) => ({
      key: option.key,
      value: option.value,
      text: option.text,
      content: <CustomDropdownItem text={option.text} description={option.book} />, // CustomDropdownItem を使用
    }));
  };
  /*
   *
   */
  switchNote = (_, data) => {
    if (!this.refs.dialog.state.isShown) {
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

    this.refs.dialog.dismissDialog();
  };
  /*
   *
   */
  handleKeyDown(ev) {
    const nev = ev.nativeEvent;
    if (!nev.ctrlKey) {
      return;
    }
    // delete word (clear)
    if (nev.key == "w") {
      this.refs.dropdown.clearSearchQuery();
      return;
    }

    let first = -1;
    let second = -1;
    // check keyCode
    if (nev.key == "n") {
      first = 40;
      second = 38;
    } else if (nev.key == "p") {
      first = 38;
      second = 40;
    }
    // fire
    if (first > 0) {
      document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: first }));
      // to scroll into view
      // setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: first })));
      // setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: second })));
      nev.cancelBubble = true;
      nev.preventDefault();
    }
  }
}
