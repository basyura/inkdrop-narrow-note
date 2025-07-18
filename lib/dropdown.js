"use babel";

import React from "react";

export default class CustomDropdownItem extends React.Component {
  render() {
    const { text, book, status } = this.props;
    return (
      <div className="custom-dropdown-item ">
        <span className="description">{book}</span>
        <span className="splitter"> - </span>
        {status == "completed" && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            name="status-completed"
            className="svg-icon streamline status-completed note-status-icon inline"
            color="var(--task-icon-completed)"
          >
            <path
              fill="currentColor"
              d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0Zm6.93 8.2-6.85 9.29a1 1 0 0 1-1.43.19l-4.89-3.91a1 1 0 0 1-.15-1.41A1 1 0 0 1 7 12.21l4.08 3.26L17.32 7a1 1 0 0 1 1.39-.21 1 1 0 0 1 .22 1.41Z"
            ></path>
          </svg>
        )}
        <span>{text}</span>
      </div>
    );
  }
}
