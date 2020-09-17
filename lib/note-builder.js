"use babel";

export class NoteBuilder {
  /*
   *
   */
  build = (state, callback) => {
    const db = inkdrop.main.dataStore.getLocalDB();
    const notebookPaths = this.buildNotebookPaths(inkdrop.store.getState().books.all);
    const dictionaryHash = this.dictionaryHash(inkdrop.store.getState());

    // If this hash hasn't changed, there's little point rebuilding the internal dictionary.
    // Aim is to provide a slight optimisation for people with a large number of notes!
    if (dictionaryHash === state.dictionaryHash) {
      // To re-select same option
      const copied = JSON.parse(JSON.stringify(state.copied));
      callback({ options: copied });
    }

    db.notes.all({ limit: 1000, sort: [{ updatedAt: "desc" }] }).then((notes) => {
      const options = notes.docs.map(({ _id, title, bookId }) => ({
        key: _id,
        value: { note: _id, book: bookId },
        text: title === "" ? "[Untitled Note]" : title,
        description: this.pathToString(notebookPaths[bookId]),
        path: notebookPaths[bookId],
      }));

      const copied = JSON.parse(JSON.stringify(options));

      callback({
        options,
        copied,
        dictionaryHash,
      });
    });
  };

  dictionaryHash = (state) => {
    const { books, db, notes, config } = state;

    // Ok, so not really a hash, but same principle.
    return [books.lastUpdatedAt, notes.timestamp, db.lastSyncTime, config.updatedAt].join("-");
  };

  buildNotebookPaths = (notebooks) => {
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

  pathToString = (path) => {
    if (path.length > 3) {
      // Truncate long ptahs with a ... in the middle
      path = [path[0], path[1], "...", path[path.length - 1]];
    }

    return path.slice().reverse().join(" > ");
  };
}
