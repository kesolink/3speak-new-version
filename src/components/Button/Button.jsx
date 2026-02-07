import './Button.scss';

function Button({ text, onClick, prominent, disabled, className }) {
  return (
    <button
      className={`btn-default${prominent ? ' prominent' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </button>
  );
}

export default Button;
