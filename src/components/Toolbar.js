import React, { useState } from "react";
import "./Toolbar.css";

const Toolbar = ({ onFormatChange, onColorChange, onModifyGrid }) => {
  const [fontSize, setFontSize] = useState("14px");
  const [fontFamily, setFontFamily] = useState("Arial");

  return (
    <div className="toolbar">
      <button onClick={() => onFormatChange("fontWeight", "bold")}><b>B</b></button>
      <button onClick={() => onFormatChange("fontStyle", "italic")}><i>I</i></button>

      <select onChange={(e) => { setFontSize(e.target.value); onFormatChange("fontSize", e.target.value); }}>
        {[10, 12, 14, 16, 18, 20].map((size) => (
          <option key={size} value={`${size}px`}>{size}</option>
        ))}
      </select>

      <select onChange={(e) => { setFontFamily(e.target.value); onFormatChange("fontFamily", e.target.value); }}>
        {["Arial", "Times New Roman", "Courier New", "Verdana"].map((font) => (
          <option key={font} value={font}>{font}</option>
        ))}
      </select>

      <input type="color" onChange={(e) => onColorChange("color", e.target.value)} title="Text Color" />
      <input type="color" onChange={(e) => onColorChange("backgroundColor", e.target.value)} title="Background Color" />

      <button onClick={() => onModifyGrid("addColumn")}>➕ Add Column</button>
      <button onClick={() => onModifyGrid("deleteColumn")}>➖ Delete Column</button>
      <button onClick={() => onModifyGrid("addRow")}>➕ Add Row</button>
      <button onClick={() => onModifyGrid("deleteRow")}>➖ Delete Row</button>
    </div>
  );
};

export default Toolbar;
