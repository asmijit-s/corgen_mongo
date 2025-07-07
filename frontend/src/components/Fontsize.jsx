import './css/Fontsize.css';
const FontSizeControl = ({ editor }) => {
  const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  const currentSize = editor?.getAttributes('textStyle')?.fontSize || '';

  const applyFontSize = (size) => {
    editor.chain().focus().setFontSize(size).run();
  };

  return (
    <div className="font-size-control">
      <button
        className="font-size-button"
        onClick={() => {
          const size = prompt('Font size (px):', currentSize.replace('px', '') || '12');
          if (size) {
            applyFontSize(`${size}px`);
          }
        }}
        title="Font size"
      >
        {currentSize || 'Size'}
      </button>
      <div className="font-size-options">
        {sizes.map(size => (
          <button
            key={size}
            className={`font-size-option ${currentSize === `${size}px` ? 'active' : ''}`}
            onClick={() => applyFontSize(`${size}px`)}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FontSizeControl;