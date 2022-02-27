"use babel";

import React from "react";
import { CompositeDisposable } from "event-kit";
import { Dropdown } from "semantic-ui-react";
import { NoteBuilder } from "./note-builder";

export default class SwitchNoteMessageDialog extends React.Component {
  /*
   *
   */
  constructor(props) {
    super(props);
    this.state = { options: [], dictionaryHash: 0 };
    this.builder = new NoteBuilder();
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
        modalSettings={{ autofocus: true }}
        onDismiss={() => {
          inkdrop.commands.dispatch(document.body, "editor:focus");
        }}
      >
        <Dropdown
          ref="dropdown"
          options={this.state.options}
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
        if (latests.length >= 5) {
          break;
        }
      }
      options = latests;

      this.refs.dropdown.setSelectedIndex(0);
      this.setState({ all, options, copied, dictionaryHash });
    });
    this.refs.dialog.showDialog();
  }
  /*
   *
   */
  searchNotes = (options, query) => {
    // Lowercase the query to make searching easier.
    query = query.toLowerCase();

    return this.state.all.filter((option) => {
      const text = option.text.toLowerCase();
      if (text.includes(query)) {
        return true;
      }
    });

    /*
    return options.filter((option) => {
      // Lowercase the note title and each notebook in the path to make searching easier.
      const text = option.text.toLowerCase();
      const path = option.path.map((notebook) => notebook.toLowerCase());

      return query.split(" ").reduce((queryCarry, querySegment) => {
        // Check if the note title contains this segment of the query at all
        const noteTitleContainsQuerySegment = text.indexOf(querySegment) > -1;

        // Check if any path segment (notebook name) contains this query segment.
        const pathSegmentContainsQuerySegment = path.reduce((pathCarry, pathSegment) => {
          // This should return true if any path segment matches the query segment.
          return pathCarry || pathSegment.indexOf(querySegment) > -1;
        }, false);

        // This should only return true if every query segment can be matched against the note title and notebook path.
        return queryCarry && (noteTitleContainsQuerySegment || pathSegmentContainsQuerySegment);
      }, true);
    });
    */
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
      inkdrop.commands.dispatch(document.body, "editor:focus");
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
      setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: first })));
      setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: second })));
      nev.cancelBubble = true;
      nev.preventDefault();
    }
  }
}
