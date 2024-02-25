"use babel";

export default class CustomDropdownItem extends React.Component {
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
